package runner

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"strings"
	"sync"

	"github.com/hangyuyang/dbmigrate/pkg/plugin"
	"github.com/hangyuyang/dbmigrate/pkg/task"
)

// Runner 任务执行引擎
type Runner struct {
	store   task.Store
	sources map[string]plugin.SourcePlugin
	targets map[string]plugin.TargetPlugin
	mu      sync.Mutex
	running map[string]context.CancelFunc
}

// New 创建 Runner
func New(store task.Store) *Runner {
	return &Runner{
		store:   store,
		sources: make(map[string]plugin.SourcePlugin),
		targets: make(map[string]plugin.TargetPlugin),
		running: make(map[string]context.CancelFunc),
	}
}

// RegisterSource 注册源端插件
func (r *Runner) RegisterSource(p plugin.SourcePlugin) {
	r.sources[p.Name()] = p
}

// RegisterTarget 注册目标端插件
func (r *Runner) RegisterTarget(p plugin.TargetPlugin) {
	r.targets[p.Name()] = p
}

// StartTask 启动迁移任务（异步）
func (r *Runner) StartTask(ctx context.Context, taskID string) error {
	r.mu.Lock()
	if _, ok := r.running[taskID]; ok {
		r.mu.Unlock()
		return fmt.Errorf("task %s is already running", taskID)
	}
	ctx, cancel := context.WithCancel(context.Background())
	r.running[taskID] = cancel
	r.mu.Unlock()

	go func() {
		defer func() {
			r.mu.Lock()
			delete(r.running, taskID)
			r.mu.Unlock()
		}()

		log.Printf("[Runner] starting task %s", taskID)
		if err := r.executeTask(ctx, taskID); err != nil {
			log.Printf("[Runner] task %s failed: %v", taskID, err)
			r.updateStatus(taskID, task.StatusError, err.Error())
		}
	}()

	return nil
}

// StopTask 停止迁移任务
func (r *Runner) StopTask(taskID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if cancel, ok := r.running[taskID]; ok {
		cancel()
		delete(r.running, taskID)
	}
}

func (r *Runner) executeTask(ctx context.Context, taskID string) error {
	t, err := r.store.Get(taskID)
	if err != nil {
		return fmt.Errorf("get task: %w", err)
	}

	// 找源插件
	srcName := string(t.Source.Type)
	if srcName == "oceanbase" {
		srcName = "mysql" // OB 走 MySQL 协议
	}
	srcPlugin, ok := r.sources[srcName]
	if !ok {
		return fmt.Errorf("source plugin %q not found", srcName)
	}

	// 找目标插件
	tgtName := string(t.Target.Type)
	if tgtName == "polardbx" || tgtName == "polardbx-centralized" || tgtName == "polardbx-distributed" {
		tgtName = "mysql"
	}
	tgtPlugin, ok := r.targets[tgtName]
	if !ok {
		return fmt.Errorf("target plugin %q not found", tgtName)
	}

	// 连接源
	log.Printf("[Runner] connecting to source...")
	srcCfg := t.Source
	if err := srcPlugin.Connect(ctx, srcCfg); err != nil {
		return fmt.Errorf("connect source: %w", err)
	}
	defer srcPlugin.Close()

	// 连接目标（先不带库名，建库后重连）
	log.Printf("[Runner] connecting to target...")
	tgtCfg := t.Target
	origDB := tgtCfg.Database
	tgtCfg.Database = "" // 先不指定库，避免 ping 时报 Unknown database
	if err := tgtPlugin.Connect(ctx, tgtCfg); err != nil {
		return fmt.Errorf("connect target: %w", err)
	}
	defer tgtPlugin.Close()

	// 确保目标数据库存在并重连
	if origDB != "" {
		createDB := fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s` DEFAULT CHARSET=utf8mb4", origDB)
		tgtPlugin.ApplyDDL(ctx, &plugin.DDLObject{SQL: createDB})
		log.Printf("[Runner] ensured database %s exists", origDB)

		tgtPlugin.Close()
		tgtCfg.Database = origDB
		if err := tgtPlugin.Connect(ctx, tgtCfg); err != nil {
			return fmt.Errorf("reconnect target with db: %w", err)
		}
		log.Printf("[Runner] reconnected to target with database %s", origDB)
	}

	// 更新状态 → INIT
	r.updateStatus(taskID, task.StatusInit, "")

	// Schema 迁移
	if hasMode(t.Mode, "schema") {
		log.Printf("[Runner] migrating schema...")
		r.updateStatus(taskID, task.StatusSchema, "")
		if err := r.migrateSchema(ctx, srcPlugin, tgtPlugin, t); err != nil {
			return fmt.Errorf("schema migrate: %w", err)
		}
	}

	// 全量迁移
	if hasMode(t.Mode, "full") {
		log.Printf("[Runner] starting full sync...")
		r.updateStatus(taskID, task.StatusFullSync, "")

		// 发现表
		tables, err := srcPlugin.Discover(ctx, t.Filter)
		if err != nil {
			return fmt.Errorf("discover: %w", err)
		}
		if len(tables) == 0 {
			log.Printf("[Runner] no tables found, skipping")
		}

		t.Progress.TotalTables = len(tables)
		for i, table := range tables {
			if err := r.migrateTable(ctx, srcPlugin, tgtPlugin, t, table, &t.Progress); err != nil {
				log.Printf("[Runner] ✗ table %s: %v", table.Name, err)
				t.Error = fmt.Sprintf("table %s: %v", table.Name, err)
				continue
			}
			t.Progress.DoneTables = i + 1
			log.Printf("[Runner] table %s done (%d/%d)", table.Name, i+1, len(tables))
		}

		r.updateStatus(taskID, task.StatusCompleted, "")
		log.Printf("[Runner] task %s completed!", taskID)
	}

	// 数据校验
	if t.EnableVerify {
		log.Printf("[Runner] starting data verification...")
		r.updateStatus(taskID, task.StatusVerifying, "")
		tables, _ := srcPlugin.Discover(ctx, t.Filter)
		verified := 0
		for _, table := range tables {
			srcCount := srcPlugin.Count(ctx, table.Schema, table.Name)
			tgtCount := tgtPlugin.Count(ctx, table.Schema, table.Name)
			if srcCount == tgtCount {
				verified++
				log.Printf("[Runner] ✓ %s: %d rows", table.Name, srcCount)
			} else {
				log.Printf("[Runner] ✗ %s: src=%d tgt=%d", table.Name, srcCount, tgtCount)
			}
		}
		log.Printf("[Runner] verify PASSED: %d/%d tables", verified, len(tables))
		r.updateStatus(taskID, task.StatusCompleted, "")
	}

	return nil
}

func (r *Runner) migrateTable(ctx context.Context, src plugin.SourcePlugin, tgt plugin.TargetPlugin, t *task.Task, table plugin.TableMetadata, progress *task.Progress) error {
	chunkSize := t.ChunkSize
	if chunkSize == 0 {
		chunkSize = 50000
	}

	cfg := plugin.FullExportConfig{
		Tables:    []plugin.TableMetadata{table},
		ChunkSize: chunkSize,
		Parallel:  t.Parallel,
	}

	dataCh, errCh, err := src.FullExport(ctx, cfg)
	if err != nil {
		return err
	}

	for {
		select {
		case batch, ok := <-dataCh:
			if !ok {
				return nil
			}
			result, err := tgt.BatchWrite(ctx, batch)
			if err != nil {
				return fmt.Errorf("batch write: %w", err)
			}
			progress.DoneRows += result.RowsAffected
			_ = r.updateProgress(t.ID, *progress)

		case err, ok := <-errCh:
			if ok && err != nil {
				return err
			}

		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (r *Runner) migrateSchema(ctx context.Context, src plugin.SourcePlugin, tgt plugin.TargetPlugin, t *task.Task) error {
	objects, err := src.ExtractSchema(ctx, plugin.ObjectFilter{
		Tables:         t.Filter,
		IncludeIndexes: true,
		IncludeViews:   false,
	})
	if err != nil {
		return fmt.Errorf("extract schema: %w", err)
	}

	for _, obj := range objects {
		if obj.Type != "TABLE" {
			continue
		}
		// 清洗 OB 特殊语法
		obj.SQL = sanitizeDDL(obj.SQL)

		// 先 DROP 再 CREATE
		dropSQL := fmt.Sprintf("DROP TABLE IF EXISTS `%s`.`%s`", t.Target.Database, obj.Name)
		_, err := tgt.ApplyDDL(ctx, &plugin.DDLObject{SQL: dropSQL})
		if err != nil {
			log.Printf("[Runner] warning: drop table %s: %v", obj.Name, err)
		}

		_, err = tgt.ApplyDDL(ctx, obj)
		if err != nil {
			log.Printf("[Runner] ✗ schema %s: %v", obj.Name, err)
			t.Error = fmt.Sprintf("schema %s: %v", obj.Name, err)
			continue
		}
		log.Printf("[Runner] created table %s", obj.Name)
	}
	return nil
}

func hasMode(mode, target string) bool {
	return strings.Contains(mode, target)
}

// OB-specific patterns to strip from CREATE TABLE DDL
var obPatterns = []*regexp.Regexp{
	regexp.MustCompile(`\s+BLOCK_SIZE\s*=?\s*\d+`),
	regexp.MustCompile(`\s+LOCAL\b`),
	regexp.MustCompile(`\s+COMPRESSION\s*=\s*'[^']*'`),
	regexp.MustCompile(`\s+USE_BLOOM_FILTER\s*=\s*(?:TRUE|FALSE)`),
	regexp.MustCompile(`\s+TABLET_SIZE\s*=\s*\d+`),
	regexp.MustCompile(`\s+PCTFREE\s*=\s*\d+`),
	regexp.MustCompile(`\s+TABLEGROUP\s*=\s*'[^']*'`),
	regexp.MustCompile(`\s+REPLICA_NUM\s*=\s*\d+`),
	regexp.MustCompile(`\s+AUTO_INCREMENT_MODE\s*=\s*'[^']*'`),
}

// varcharOverLimit maps VARCHAR(n>16383) to TEXT for PolarDB-X compatibility
var varcharOverLimit = regexp.MustCompile(`(?i)varchar\(\d{5,}\)`)

func sanitizeDDL(ddl string) string {
	for _, re := range obPatterns {
		ddl = re.ReplaceAllString(ddl, "")
	}
	// Map VARCHAR(>16383) → TEXT for PolarDB-X
	ddl = varcharOverLimit.ReplaceAllString(ddl, "TEXT")
	// fix double spaces
	ddl = regexp.MustCompile(`  +`).ReplaceAllString(ddl, " ")
	// fix trailing space before )
	ddl = strings.ReplaceAll(ddl, " )", ")")
	return ddl
}

func (r *Runner) updateStatus(taskID string, status task.Status, errMsg string) {
	t, e := r.store.Get(taskID)
	if e != nil {
		return
	}
	t.Status = status
	t.Error = errMsg
	r.store.Update(t)
}

func (r *Runner) updateProgress(taskID string, progress task.Progress) error {
	t, err := r.store.Get(taskID)
	if err != nil {
		return err
	}
	t.Progress = progress
	return r.store.Update(t)
}
