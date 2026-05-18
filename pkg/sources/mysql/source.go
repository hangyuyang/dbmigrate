package mysql

import (
	"context"
	"crypto/tls"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/go-sql-driver/mysql"
	_ "github.com/go-sql-driver/mysql"
	"github.com/hangyuyang/dbmigrate/pkg/plugin"
)

// Source MySQL 源端插件（兼容 OceanBase/TiDB MySQL 模式）
type Source struct {
	db     *sql.DB
	config plugin.ConnectionConfig
}

func NewSource() *Source {
	return &Source{}
}

func (s *Source) Name() string                      { return "mysql" }
func (s *Source) Version() string                   { return "0.1.0" }
func (s *Source) SupportedDBTypes() []plugin.DBType { return []plugin.DBType{plugin.DBTypeMySQL, plugin.DBTypeOceanBase, plugin.DBTypeTiDB} }

func (s *Source) Connect(ctx context.Context, config plugin.ConnectionConfig) error {
	cfg := mysql.NewConfig()
	cfg.User = config.User
	cfg.Passwd = config.Password
	cfg.Net = "tcp"
	cfg.Addr = fmt.Sprintf("%s:%d", config.Host, config.Port)
	cfg.DBName = config.Database
	cfg.Params = map[string]string{
		"charset":   "utf8mb4",
		"parseTime": "true",
	}
	cfg.Timeout = 10 * time.Second
	cfg.ReadTimeout = 60 * time.Second
	cfg.TLS = &tls.Config{InsecureSkipVerify: true}

	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return fmt.Errorf("connect mysql: %w", err)
	}

	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("ping mysql: %w", err)
	}

	s.db = db
	s.config = config
	return nil
}

func (s *Source) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

func (s *Source) Ping(ctx context.Context) error {
	return s.db.PingContext(ctx)
}

func (s *Source) Discover(ctx context.Context, filter plugin.TableFilter) ([]plugin.TableMetadata, error) {
	query := `SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, ENGINE, TABLE_COLLATION
			  FROM information_schema.TABLES
			  WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`
	args := []interface{}{s.config.Database}

	if len(filter.IncludeTables) > 0 {
		query += " AND TABLE_NAME IN ("
		for i, t := range filter.IncludeTables {
			if i > 0 { query += "," }
			query += "?"
			args = append(args, t)
		}
		query += ")"
	}
	if len(filter.ExcludeTables) > 0 {
		query += " AND TABLE_NAME NOT IN ("
		for i, t := range filter.ExcludeTables {
			if i > 0 { query += "," }
			query += "?"
			args = append(args, t)
		}
		query += ")"
	}

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []plugin.TableMetadata
	for rows.Next() {
		var t plugin.TableMetadata
		t.Schema = s.config.Database
		if err := rows.Scan(&t.Name, &t.RowCount, &t.DataSize, &t.Engine, &t.Charset); err != nil {
			return nil, err
		}
		tables = append(tables, t)
	}

	// 查询主键
	for i := range tables {
		pkQuery := `SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
					WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
					ORDER BY ORDINAL_POSITION`
		pkRows, err := s.db.QueryContext(ctx, pkQuery, s.config.Database, tables[i].Name)
		if err != nil {
			continue
		}
		for pkRows.Next() {
			var col string
			pkRows.Scan(&col)
			tables[i].PKColumns = append(tables[i].PKColumns, col)
		}
		pkRows.Close()
	}

	return tables, nil
}

func (s *Source) FullExport(ctx context.Context, config plugin.FullExportConfig) (<-chan *plugin.RowBatch, <-chan error, error) {
	batchCh := make(chan *plugin.RowBatch, 100)
	errCh := make(chan error, 1)

	go func() {
		defer close(batchCh)
		defer close(errCh)

		for _, table := range config.Tables {
			if err := s.exportTable(ctx, table, config, batchCh); err != nil {
				errCh <- fmt.Errorf("export table %s: %w", table.Name, err)
				return
			}
		}
	}()

	return batchCh, errCh, nil
}

func (s *Source) exportTable(ctx context.Context, table plugin.TableMetadata, config plugin.FullExportConfig, out chan<- *plugin.RowBatch) error {
	columns, err := s.getColumns(ctx, table.Name)
	if err != nil {
		return err
	}

	chunkSize := config.ChunkSize
	if chunkSize == 0 {
		chunkSize = 50000
	}

	offset := 0
	for {
		query := fmt.Sprintf("SELECT * FROM `%s` LIMIT %d OFFSET %d",
			table.Name, chunkSize, offset)

		rows, err := s.db.QueryContext(ctx, query)
		if err != nil {
			return err
		}

		batch := &plugin.RowBatch{
			Table:   table.Name,
			Columns: columns,
		}

		hasRows := false
		for rows.Next() {
			hasRows = true
			values := make([]interface{}, len(columns))
			ptrs := make([]interface{}, len(columns))
			for i := range values {
				ptrs[i] = &values[i]
			}
			if err := rows.Scan(ptrs...); err != nil {
				rows.Close()
				return err
			}
			batch.Rows = append(batch.Rows, values)
		}
		rows.Close()

		if !hasRows {
			break
		}

		select {
		case out <- batch:
		case <-ctx.Done():
			return ctx.Err()
		}

		offset += len(batch.Rows)
		log.Printf("[MySQL Source] table=%s offset=%d rows=%d", table.Name, offset, len(batch.Rows))
	}

	return nil
}

func (s *Source) getColumns(ctx context.Context, table string) ([]string, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT COLUMN_NAME FROM information_schema.COLUMNS
		 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
		s.config.Database, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cols []string
	for rows.Next() {
		var c string
		rows.Scan(&c)
		cols = append(cols, c)
	}
	return cols, nil
}

func (s *Source) Subscribe(ctx context.Context, position plugin.Position) (<-chan *plugin.CDCEvent, <-chan error, error) {
	return nil, nil, fmt.Errorf("CDC not implemented yet for MySQL source")
}

func (s *Source) ExtractSchema(ctx context.Context, filter plugin.ObjectFilter) ([]*plugin.DDLObject, error) {
	objects := []*plugin.DDLObject{}

	tableQuery := `SELECT TABLE_NAME FROM information_schema.TABLES
				   WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`
	tableRows, err := s.db.QueryContext(ctx, tableQuery, s.config.Database)
	if err != nil {
		return nil, err
	}
	defer tableRows.Close()

	var tableNames []string
	for tableRows.Next() {
		var n string
		tableRows.Scan(&n)
		tableNames = append(tableNames, n)
	}

	for _, tn := range tableNames {
		var tableName, createSQL string
		err := s.db.QueryRowContext(ctx, fmt.Sprintf("SHOW CREATE TABLE `%s`", tn)).Scan(&tableName, &createSQL)
		if err != nil {
			continue
		}
		objects = append(objects, &plugin.DDLObject{
			Type:   "TABLE",
			Schema: s.config.Database,
			Name:   tn,
			SQL:    createSQL,
			Status: "original",
		})
	}

	return objects, nil
}

func (s *Source) CurrentPosition(ctx context.Context) (plugin.Position, error) {
	var file string
	var pos uint32
	err := s.db.QueryRowContext(ctx, "SHOW MASTER STATUS").Scan(&file, &pos, nil, nil, nil)
	if err != nil {
		return plugin.Position{}, err
	}
	return plugin.Position{Name: file, Pos: pos}, nil
}
