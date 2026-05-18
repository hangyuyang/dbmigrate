package plugin

import "context"

// SourcePlugin 源端数据库插件接口
type SourcePlugin interface {
	// Name 插件名称，如 "oceanbase"、"tidb"、"mysql"
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

	// Discover 发现表元数据
	Discover(ctx context.Context, filter TableFilter) ([]TableMetadata, error)

	// FullExport 全量导出
	FullExport(ctx context.Context, config FullExportConfig) (<-chan *RowBatch, <-chan error, error)

	// Subscribe CDC 订阅（需要全量完成时的位置信息）
	Subscribe(ctx context.Context, position Position) (<-chan *CDCEvent, <-chan error, error)

	// ExtractSchema 提取 DDL 对象
	ExtractSchema(ctx context.Context, filter ObjectFilter) ([]*DDLObject, error)

	// CurrentPosition 获取当前 CDC 位置
	CurrentPosition(ctx context.Context) (Position, error)
}
