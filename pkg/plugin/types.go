package plugin

// DBType 数据库类型
type DBType string

const (
	DBTypeMySQL     DBType = "mysql"
	DBTypeOceanBase DBType = "oceanbase"
	DBTypeTiDB      DBType = "tidb"
	DBTypePolarDBX  DBType = "polardbx"
	DBTypeOracle    DBType = "oracle"
	DBTypePostgreSQL DBType = "postgresql"
)

// ConnectionConfig 数据库连接配置
type ConnectionConfig struct {
	Type     DBType `json:"type" yaml:"type"`
	Host     string `json:"host" yaml:"host"`
	Port     int    `json:"port" yaml:"port"`
	User     string `json:"user" yaml:"user"`
	Password string `json:"password" yaml:"password"`
	Database string `json:"database" yaml:"database"`
	Extra    map[string]string `json:"extra,omitempty" yaml:"extra,omitempty"`
}

// TableFilter 表过滤条件
type TableFilter struct {
	IncludeTables []string `json:"include_tables"` // 为空表示全部
	ExcludeTables []string `json:"exclude_tables"`
	IncludeSchemas []string `json:"include_schemas"`
}

// ObjectFilter 对象过滤条件（表、视图、索引等）
type ObjectFilter struct {
	Tables  TableFilter `json:"tables"`
	IncludeIndexes  bool `json:"include_indexes"`
	IncludeViews    bool `json:"include_views"`
	IncludeTriggers bool `json:"include_triggers"`
}

// TableMetadata 表元数据
type TableMetadata struct {
	Schema    string `json:"schema"`
	Name      string `json:"name"`
	RowCount  int64  `json:"row_count"`
	DataSize  int64  `json:"data_size"`
	PKColumns []string `json:"pk_columns"`
	Engine    string `json:"engine"`
	Charset   string `json:"charset"`
}

// ColumnDef 列定义
type ColumnDef struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	Nullable   bool   `json:"nullable"`
	Default    string `json:"default,omitempty"`
	AutoIncr   bool   `json:"auto_incr"`
	Comment    string `json:"comment,omitempty"`
}

// ChunkRange 分块范围
type ChunkRange struct {
	Table    string `json:"table"`
	PKColumn string `json:"pk_column"`
	Min      string `json:"min"`
	Max      string `json:"max"`
	Index    int    `json:"index"`
}

// RowBatch 行数据批次
type RowBatch struct {
	Table   string                 `json:"table"`
	Columns []string               `json:"columns"`
	Rows    [][]interface{}        `json:"rows"`
	Chunk   *ChunkRange            `json:"chunk,omitempty"`
}

// CDCEvent CDC 变更事件
type CDCEvent struct {
	SourceDB  DBType                `json:"source_db"`
	Timestamp int64                 `json:"timestamp"`
	GTID      string                `json:"gtid"`
	Position  uint64                `json:"position"`
	Op        OpType                `json:"op"`
	Schema    string                `json:"schema"`
	Table     string                `json:"table"`
	Before    map[string]interface{} `json:"before,omitempty"`
	After     map[string]interface{} `json:"after,omitempty"`
	DDLSQL    string                `json:"ddl_sql,omitempty"`
}

// OpType 操作类型
type OpType string

const (
	OpInsert OpType = "INSERT"
	OpUpdate OpType = "UPDATE"
	OpDelete OpType = "DELETE"
	OpDDL    OpType = "DDL"
)

// Position CDC 位点
type Position struct {
	Name string `json:"name"` // binlog 文件名
	Pos  uint32 `json:"pos"`  // binlog 位点
	GTID string `json:"gtid"` // GTID
}

// DDLObject DDL 对象
type DDLObject struct {
	Type    string `json:"type"` // TABLE, VIEW, INDEX
	Schema  string `json:"schema"`
	Name    string `json:"name"`
	SQL     string `json:"sql"`
	Status  string `json:"status"` // original, converted, warning, error
	Warning string `json:"warning,omitempty"`
}

// FullExportConfig 全量导出配置
type FullExportConfig struct {
	Tables     []TableMetadata `json:"tables"`
	ChunkSize  int64           `json:"chunk_size"`   // 每个分块的行数
	Parallel   int             `json:"parallel"`      // 并发线程数
	Where      string          `json:"where,omitempty"` // 全局过滤条件
}

// WriteResult 写入结果
type WriteResult struct {
	RowsAffected int64  `json:"rows_affected"`
	DurationMs   int64  `json:"duration_ms"`
	Error        string `json:"error,omitempty"`
}

// DDLResult DDL 执行结果
type DDLResult struct {
	Success  bool   `json:"success"`
	Message  string `json:"message"`
	Warning  string `json:"warning,omitempty"`
}

// PreCheckWarning 迁移前检查告警
type PreCheckWarning struct {
	Level    string `json:"level"` // info, warning, error
	Table    string `json:"table"`
	Message  string `json:"message"`
	Suggestion string `json:"suggestion"`
}
