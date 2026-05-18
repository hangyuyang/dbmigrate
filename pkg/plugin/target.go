package plugin

import "context"

// TargetPlugin 目标端数据库插件接口
type TargetPlugin interface {
	// Name 插件名称，如 "polardbx"、"mysql"
	Name() string

	// Version 插件版本
	Version() string

	// SupportedDBTypes 支持的数据库类型
	SupportedDBTypes() []DBType

	// Connect 建立连接
	Connect(ctx context.Context, config ConnectionConfig) error

	// Close 关闭连接
	Close() error

	// Ping 连接检查
	Ping(ctx context.Context) error

	// CreateTable 建表
	CreateTable(ctx context.Context, ddl *DDLObject) error

	// ApplyDDL 应用 DDL
	ApplyDDL(ctx context.Context, ddl *DDLObject) (*DDLResult, error)

	// BatchWrite 批量写入（全量迁移用）
	BatchWrite(ctx context.Context, batch *RowBatch) (*WriteResult, error)

	// Write 单行/小批量写入（CDC 回放用）
	Write(ctx context.Context, events []*CDCEvent) (*WriteResult, error)

	// GetChecksum 计算表分块校验值（用于数据校验）
	GetChecksum(ctx context.Context, table string, pkCol string, min, max string) (string, error)

	// PreCheck 迁移前检查
	PreCheck(ctx context.Context, tables []TableMetadata) ([]PreCheckWarning, error)
}
