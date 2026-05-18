package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	_ "github.com/go-sql-driver/mysql"
	"github.com/hangyuyang/dbmigrate/pkg/plugin"
)

// Target MySQL 目标端插件（也兼容 PolarDB-X MySQL 协议）
type Target struct {
	db     *sql.DB
	config plugin.ConnectionConfig
}

func NewTarget() *Target {
	return &Target{}
}

func (t *Target) Name() string                       { return "mysql" }
func (t *Target) Version() string                    { return "0.1.0" }
func (t *Target) SupportedDBTypes() []plugin.DBType  { return []plugin.DBType{plugin.DBTypeMySQL, plugin.DBTypePolarDBX} }

func (t *Target) Connect(ctx context.Context, config plugin.ConnectionConfig) error {
	cfg := mysql.NewConfig()
	cfg.User = config.User
	cfg.Passwd = config.Password
	cfg.Net = "tcp"
	cfg.Addr = fmt.Sprintf("%s:%d", config.Host, config.Port)
	cfg.DBName = config.Database
	cfg.Params = map[string]string{
		"charset":         "utf8mb4",
		"parseTime":       "true",
		"multiStatements": "true",
	}
	cfg.Timeout = 10 * time.Second

	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return fmt.Errorf("connect mysql: %w", err)
	}

	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(10)

	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("ping mysql: %w", err)
	}

	t.db = db
	t.config = config
	return nil
}

func (t *Target) Close() error {
	if t.db != nil {
		return t.db.Close()
	}
	return nil
}

func (t *Target) Ping(ctx context.Context) error {
	return t.db.PingContext(ctx)
}

func (t *Target) CreateTable(ctx context.Context, ddl *plugin.DDLObject) error {
	_, err := t.db.ExecContext(ctx, ddl.SQL)
	return err
}

func (t *Target) ApplyDDL(ctx context.Context, ddl *plugin.DDLObject) (*plugin.DDLResult, error) {
	_, err := t.db.ExecContext(ctx, ddl.SQL)
	if err != nil {
		return &plugin.DDLResult{Success: false, Message: err.Error()}, err
	}
	return &plugin.DDLResult{Success: true}, nil
}

func (t *Target) BatchWrite(ctx context.Context, batch *plugin.RowBatch) (*plugin.WriteResult, error) {
	if len(batch.Rows) == 0 {
		return &plugin.WriteResult{}, nil
	}

	// 构建批量 INSERT
	colNames := make([]string, len(batch.Columns))
	for i, c := range batch.Columns {
		colNames[i] = fmt.Sprintf("`%s`", c)
	}

	placeholders := make([]string, len(batch.Columns))
	for i := range placeholders {
		placeholders[i] = "?"
	}

	rowPlaceholders := make([]string, len(batch.Rows))
	args := make([]interface{}, 0, len(batch.Rows)*len(batch.Columns))
	for i, row := range batch.Rows {
		rowPlaceholders[i] = "(" + strings.Join(placeholders, ",") + ")"
		args = append(args, row...)
	}

	query := fmt.Sprintf("INSERT INTO `%s` (%s) VALUES %s",
		batch.Table,
		strings.Join(colNames, ","),
		strings.Join(rowPlaceholders, ","),
	)

	result, err := t.db.ExecContext(ctx, query, args...)
	if err != nil {
		return &plugin.WriteResult{Error: err.Error()}, err
	}

	rowsAffected, _ := result.RowsAffected()
	return &plugin.WriteResult{RowsAffected: rowsAffected}, nil
}

func (t *Target) Write(ctx context.Context, events []*plugin.CDCEvent) (*plugin.WriteResult, error) {
	// CDC 回放：逐条 INSERT/UPDATE/DELETE
	var totalAffected int64
	for _, ev := range events {
		switch ev.Op {
		case plugin.OpInsert:
			result, err := t.execInsert(ctx, ev)
			if err != nil {
				return &plugin.WriteResult{Error: err.Error()}, err
			}
			n, _ := result.RowsAffected()
			totalAffected += n
		case plugin.OpUpdate:
			result, err := t.execUpdate(ctx, ev)
			if err != nil {
				return &plugin.WriteResult{Error: err.Error()}, err
			}
			n, _ := result.RowsAffected()
			totalAffected += n
		case plugin.OpDelete:
			result, err := t.execDelete(ctx, ev)
			if err != nil {
				return &plugin.WriteResult{Error: err.Error()}, err
			}
			n, _ := result.RowsAffected()
			totalAffected += n
		}
	}
	return &plugin.WriteResult{RowsAffected: totalAffected}, nil
}

func (t *Target) execInsert(ctx context.Context, ev *plugin.CDCEvent) (sql.Result, error) {
	if ev.After == nil {
		return nil, fmt.Errorf("INSERT event has no after data")
	}
	cols := make([]string, 0, len(ev.After))
	vals := make([]interface{}, 0, len(ev.After))
	phs := make([]string, 0, len(ev.After))
	for k, v := range ev.After {
		cols = append(cols, fmt.Sprintf("`%s`", k))
		vals = append(vals, v)
		phs = append(phs, "?")
	}
	query := fmt.Sprintf("REPLACE INTO `%s`.`%s` (%s) VALUES (%s)",
		ev.Schema, ev.Table, strings.Join(cols, ","), strings.Join(phs, ","))
	return t.db.ExecContext(ctx, query, vals...)
}

func (t *Target) execUpdate(ctx context.Context, ev *plugin.CDCEvent) (sql.Result, error) {
	// INSERT ... ON DUPLICATE KEY UPDATE
	if ev.After == nil {
		return nil, fmt.Errorf("UPDATE event has no after data")
	}
	cols := make([]string, 0, len(ev.After))
	vals := make([]interface{}, 0, len(ev.After))
	phs := make([]string, 0, len(ev.After))
	updates := make([]string, 0, len(ev.After))
	for k, v := range ev.After {
		cols = append(cols, fmt.Sprintf("`%s`", k))
		vals = append(vals, v)
		phs = append(phs, "?")
		updates = append(updates, fmt.Sprintf("`%s`=VALUES(`%s`)", k, k))
	}
	query := fmt.Sprintf("INSERT INTO `%s`.`%s` (%s) VALUES (%s) ON DUPLICATE KEY UPDATE %s",
		ev.Schema, ev.Table, strings.Join(cols, ","), strings.Join(phs, ","), strings.Join(updates, ","))
	return t.db.ExecContext(ctx, query, vals...)
}

func (t *Target) execDelete(ctx context.Context, ev *plugin.CDCEvent) (sql.Result, error) {
	if ev.Before == nil {
		return nil, fmt.Errorf("DELETE event has no before data")
	}
	// 用所有列作为 WHERE 条件（稳妥但慢）
	conds := make([]string, 0, len(ev.Before))
	vals := make([]interface{}, 0, len(ev.Before))
	for k, v := range ev.Before {
		conds = append(conds, fmt.Sprintf("`%s`=?", k))
		vals = append(vals, v)
	}
	query := fmt.Sprintf("DELETE FROM `%s`.`%s` WHERE %s LIMIT 1",
		ev.Schema, ev.Table, strings.Join(conds, " AND "))
	return t.db.ExecContext(ctx, query, vals...)
}

func (t *Target) GetChecksum(ctx context.Context, table, pkCol, min, max string) (string, error) {
	query := fmt.Sprintf("SELECT COALESCE(SUM(CRC32(CONCAT_WS(',', *))), 0) FROM `%s` WHERE `%s` BETWEEN ? AND ?", table, pkCol)
	var checksum sql.NullString
	err := t.db.QueryRowContext(ctx, query, min, max).Scan(&checksum)
	if err != nil {
		return "", err
	}
	if checksum.Valid {
		return checksum.String, nil
	}
	return "0", nil
}

func (t *Target) Count(ctx context.Context, schema, table string) int64 {
	var count int64
	err := t.db.QueryRowContext(ctx, fmt.Sprintf("SELECT COUNT(*) FROM `%s`.`%s`", schema, table)).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

func (t *Target) PreCheck(ctx context.Context, tables []plugin.TableMetadata) ([]plugin.PreCheckWarning, error) {
	var warnings []plugin.PreCheckWarning
	for _, tbl := range tables {
		if len(tbl.PKColumns) == 0 {
			warnings = append(warnings, plugin.PreCheckWarning{
				Level:   "error",
				Table:   tbl.Name,
				Message: fmt.Sprintf("table %s has no primary key", tbl.Name),
				Suggestion: "PolarDB-X requires all tables to have a primary key. Add a primary key before migration.",
			})
		}
	}
	return warnings, nil
}

// ensureColumns 确保列名不为空（辅助函数）
func ensureColumns(columns []string, count int) []string {
	if len(columns) > 0 {
		return columns
	}
	// fallback: generate column placeholder (should not happen)
	result := make([]string, count)
	for i := range result {
		result[i] = fmt.Sprintf("col_%d", i)
	}
	return result
}
