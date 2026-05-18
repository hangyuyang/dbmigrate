# DBMigrate — 异构数据库迁移工具 设计方案 v0.1.1

> **日期:** 2026-05-18  
> **目标:** 插件化、可扩展的异构数据库迁移平台，首批支持 OceanBase/TiDB → PolarDB-X
> **协议:** 闭源（团队内部使用）
> **仓库:** GitHub Private — hangyuyang/dbmigrate
> **范围:** v1 表 + 索引 + 视图；v2 存储过程/函数/触发器

---

## 一、项目定位

DBMigrate 是一个**插件化异构数据库迁移工具**，对标 DBMotion / NineData / DSG，核心能力：

1. **全量迁移** — 并行分块导出 + 批量写入，支持断点续传
2. **增量同步** — 基于 CDC 的实时变更捕获与回放
3. **对象迁移** — Schema、索引、视图、存储过程等 DDL 对象的转换与迁移
4. **数据校验** — 分块 Checksum 比对，全量 + 持续校验

Docker 部署，Web UI 操作，插件化扩展新数据库。

---

## 二、参考工具架构分析

| 特性 | DBMotion | NineData | DSG SuperSync | DBMigrate（目标） |
|------|----------|----------|---------------|-------------------|
| 部署 | Docker Compose | SaaS + Agent | 私有化部署 | Docker Compose |
| UI | Web (React) | Web (SaaS) | Web | Web (Vue/React) |
| CDC 机制 | 多源 Log 解析 | Agent 内置解析 | 逆向 Log 解析 | Plugin 可插拔 |
| 扩展性 | 内置数据库适配 | Agent 级别 | 内置适配器 | Go Plugin / 进程级 |
| 开源 | 否 | 否 | 否 | **是** |

---

## 三、总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                       Web UI (React)                        │
│             任务管理 / 监控 / 配置 / 数据校验                │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API / WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│                      API Server                             │
│            任务调度 / 状态机 / 告警 / 统计                   │
└──────┬──────────┬──────────┬──────────┬─────────────────────┘
       │          │          │          │
  ┌────▼───┐ ┌───▼────┐ ┌──▼─────┐ ┌──▼──────┐
  │ Source │ │ Target │ │ Schema │ │Verify   │
  │ Plugin │ │ Plugin │ │ Engine │ │Engine   │
  │ (CDC)  │ │(Writer)│ │        │ │         │
  └────┬───┘ └───┬────┘ └───┬────┘ └────┬────┘
       │         │          │            │
       └─────────┼──────────┼────────────┘
                 │          │
         ┌───────▼──────────▼───────────┐
         │       Message Pipeline       │
         │  (NATS / Go Channel / Kafka) │
         │  缓冲 / 排序 / 去重 / 转换   │
         └──────────────────────────────┘
```

### 3.1 核心组件

#### A. Source Plugin（源端插件）
每种数据库实现一个 Source Plugin，提供两个接口：

```
SourcePlugin interface {
    // 全量导出：分块读取表数据，输出行流
    FullExport(ctx, TableFilter) → RowStream
    
    // CDC 订阅：订阅增量变更，输出事件流
    Subscribe(ctx, Position) → EventStream
    
    // Schema 导出：提取 DDL
    ExtractSchema(ctx, TableFilter) → SchemaDef
    
    // 元数据：表清单、行数估算
    Discover(ctx) → TableMetadata[]
}
```

**OB Source 实现：**
- 全量：JDBC 分块读取（`WHERE id >= ? AND id < ?`），利用 OB 分布式并行
- CDC：通过 OBLogProxy（binlog 兼容协议）订阅，Canal 协议解析
- 特殊处理：VARCHAR(262144) → TEXT 映射提示

**TiDB Source 实现：**
- 全量：Dumpling 协议兼容的并行导出（TiDB 原生支持 `TIDB_SNAPSHOT`）
- CDC：通过 TiCDC MySQL Sink 模式，将 PolarDB-X 作为下游
- 特殊处理：AUTO_RANDOM → BIGINT AUTO_INCREMENT 映射

#### B. Target Plugin（目标端插件）

```
TargetPlugin interface {
    // 批量写入
    BatchWrite(ctx, RowBatch) → WriteResult
    
    // 应用 DDL
    ApplyDDL(ctx, DDLStatement) → DDLResult
    
    // 单行操作（CDC 回放）
    ApplyMutation(ctx, Mutation) → WriteResult
    
    // 连接测试
    Ping(ctx) → error
}
```

**PolarDB-X Target 实现：**
- 全量：LOAD DATA INFILE（最快）→ 批量 INSERT → 单行 INSERT（降级链）
- CDC：事务级批量 INSERT/UPDATE/DELETE
- 自动处理：主键检查（无主键表报错提示）、Shard Key 推荐

#### C. Schema Engine（Schema 转换引擎）

```
SchemaEngine interface {
    // 源 DDL 转换为目标兼容 DDL
    Convert(source DDLStatement, from DBType, to DBType) → DDLStatement
    
    // 类型映射
    MapType(col ColumnDef, from DBType, to DBType) → ColumnDef
}
```

核心能力：
- 内置类型映射表（yaml/json 可配置）
- PARTITION 语法转换
- INDEX / CONSTRAINT 适配
- AUTO_INCREMENT / SEQUENCE 兼容
- 不兼容项 WARNING + 建议

#### D. Verify Engine（数据校验引擎）

```
VerifyEngine interface {
    // 全量校验
    FullVerify(source, target, TableConfig) → VerifyReport
    
    // 持续校验（CDC 阶段）
    ContinuousVerify(stream ReadStream, source, target) → VerifyStream
    
    // 修复（可选）
    Repair(diff DiffReport, source, target) → RepairReport
}
```

参考 NineData/DSG 方式：
- 分块 CRC32/MD5 checksum 比对
- 行级精确比对（对于不匹配的 chunk）
- 支持校验窗口配置（避免影响业务峰值）

#### E. Message Pipeline（消息管道）

```
MessagePipeline interface {
    // 发布数据变更事件
    Publish(ctx, Event) → error
    
    // 订阅（按表/事务）
    Subscribe(ctx, TopicPattern) → EventStream
    
    // 事务排序
    // 去重（幂等 key：source + gtid/binlog_pos + table + pk）
}
```

内置实现：
- Go Channel（单机，默认）
- NATS（多节点，可选）
- Kafka（大规模，可选）

---

## 四、数据流设计

### 4.1 全量迁移流程

```
1. 用户配置任务 → API Server
2. Schema Engine: 导出源 DDL → 转换 → ApplyTarget
3. Source Plugin: Discover → 生成分块任务
4. 任务分发：Chunk{Table, PK_Range} → Worker Pool
5. Worker: Source.FullExport(chunk) → Message Pipeline
6. Target Plugin: BatchWrite (LOAD DATA / INSERT)
7. 状态上报：进度、RPS、字节数 → WebSocket → Web UI
8. 完成：触发可选验证任务
```

**并行策略：**
- 表级并行：多张表同时迁移
- Chunk 级并行：一张表的多个分块并行读取 + 写入
- Worker Pool 可配置并发数，避免压垮源库（QPS 限流）

**断点续传：**
- Chunk 状态持久化到 SQLite/etcd
- 任务中断后从已完成 Chunk 的下一个继续
- GTID/Binlog Position 持久化用于 CDC 续接

### 4.2 增量同步（CDC）流程

```
1. 全量迁移完成后，记录当前 CDC Position
2. Source Plugin: Subscribe(from=position)
3. 事件流：INSERT/UPDATE/DELETE + DDL
4. Pipeline: 
   - 解析为统一事件格式
   - 按事务排序（事务 ID + 提交时间）
   - 去重（幂等 key）
   - 转换为目标兼容格式
5. Target Plugin: ApplyMutation (批量，按事务边界)
6. 持续监控：延迟、RPS、错误数
```

**统一事件格式（Canonical Event）：**

```protobuf
message DataEvent {
    // 元信息
    string source_db = 1;
    uint64 timestamp = 2;
    string gtid = 3;
    uint64 position = 4;
    
    // 操作
    enum OpType { INSERT=0; UPDATE=1; DELETE=2; DDL=3; }
    OpType op = 5;
    
    // 数据
    string schema = 6;
    string table = 7;
    repeated Column before = 8;  // DELETE / UPDATE-before
    repeated Column after = 9;   // INSERT / UPDATE-after
    string ddl_sql = 10;         // DDL
}
```

### 4.3 对象迁移

独立于数据迁移，可单独执行：

```
1. 用户选择对象类型：TABLE / VIEW / INDEX / PROCEDURE / FUNCTION / TRIGGER / SEQUENCE
2. Source Plugin: ExtractSchema(filter)
3. Schema Engine: 逐个对象分析、转换
4. 生成报告：✓ 兼容 / ⚠ 需手动调整 / ✗ 不支持
5. 用户确认后 ApplyTarget
```

---

## 五、Docker 部署方案

```yaml
# docker-compose.yml
version: '3.8'
services:
  dbmigrate-server:
    image: dbmigrate/server:latest
    ports:
      - "8080:8080"
      - "8081:8081"   # metrics
    volumes:
      - ./data:/data       # 任务状态、断点
      - ./plugins:/plugins # 数据库插件
      - ./config:/config   # 配置文件
    environment:
      - DB_TYPE=sqlite
      - METADATA_PATH=/data/metadata.db
      
  dbmigrate-worker:
    image: dbmigrate/worker:latest
    deploy:
      replicas: 3  # 可水平扩展
    volumes:
      - ./data:/data
      - ./plugins:/plugins
    environment:
      - SERVER_ADDR=dbmigrate-server:8080
      - NATS_ADDR=nats:4222
      
  nats:
    image: nats:latest
    # 消息管道（可选，单机模式不需要）
    
  dbmigrate-ui:
    image: dbmigrate/ui:latest
    ports:
      - "3000:3000"
    environment:
      - API_URL=http://dbmigrate-server:8080
```

---

## 六、项目结构

```
dbmigrate/
├── cmd/
│   ├── server/          # API Server 入口
│   ├── worker/          # Worker 入口（迁移执行）
│   └── cli/             # 命令行工具
├── pkg/
│   ├── api/             # REST + WebSocket API
│   ├── engine/
│   │   ├── fullsync/    # 全量同步引擎
│   │   ├── cdc/         # CDC 增量同步引擎
│   │   ├── schema/      # Schema 转换引擎
│   │   └── verify/      # 数据校验引擎
│   ├── pipeline/        # 消息管道
│   │   ├── channel/     # Go Channel 实现
│   │   └── nats/        # NATS 实现（可选）
│   ├── plugin/
│   │   ├── registry.go  # 插件注册中心
│   │   ├── source.go    # Source Plugin 接口
│   │   ├── target.go    # Target Plugin 接口
│   │   └── types.go     # 公共类型定义
│   ├── sources/         # 源端插件实现
│   │   ├── mysql/       # MySQL（含 PolarDB-MySQL）
│   │   ├── oceanbase/   # OceanBase
│   │   ├── tidb/        # TiDB
│   │   ├── oracle/      # Oracle（后续）
│   │   └── postgres/    # PostgreSQL（后续）
│   ├── targets/         # 目标端插件实现
│   │   ├── polardbx/    # PolarDB-X
│   │   ├── mysql/       # MySQL
│   │   ├── oceanbase/   # OceanBase（后续）
│   │   └── tidb/        # TiDB（后续）
│   ├── task/            # 任务管理
│   │   ├── state.go     # 任务状态机
│   │   ├── scheduler.go # 任务调度
│   │   └── store.go     # 任务持久化
│   └── monitor/         # 监控指标
├── web/                 # Web UI (React)
│   ├── src/
│   │   ├── pages/       # 任务列表/详情/创建
│   │   ├── components/  # 监控面板/进度条等
│   │   └── api/         # 前端 API 封装
│   └── package.json
├── config/
│   ├── type-mapping/    # 类型映射配置
│   │   ├── ob2polardbx.yaml
│   │   └── tidb2polardbx.yaml
│   └── dbmigrate.yaml   # 默认配置
├── deploy/
│   ├── docker-compose.yml
│   └── Dockerfile
├── docs/
│   ├── architecture.md
│   ├── plugins.md
│   └── ...
├── go.mod
└── Makefile
```

---

## 七、接口设计

### 7.1 Source Plugin 接口

```go
// SourcePlugin 源端数据库插件接口
type SourcePlugin interface {
    // Name 插件名称，如 "oceanbase"、"tidb"
    Name() string
    
    // Version 插件版本
    Version() string
    
    // Connect 建立连接
    Connect(ctx context.Context, config ConnectionConfig) error
    
    // Close 关闭连接
    Close() error
    
    // Discover 发现表元数据
    Discover(ctx context.Context, filter TableFilter) ([]TableMetadata, error)
    
    // FullExport 全量导出
    FullExport(ctx context.Context, config FullExportConfig) (<-chan *RowBatch, <-chan error, error)
    
    // Subscribe CDC 订阅（需要全量完成时的位置信息）
    Subscribe(ctx context.Context, position Position) (<-chan *CDCEvent, <-chan error, error)
    
    // ExtractSchema 提取 DDL
    ExtractSchema(ctx context.Context, filter ObjectFilter) ([]DDLObject, error)
    
    // CurrentPosition 获取当前 CDC 位置
    CurrentPosition(ctx context.Context) (Position, error)
    
    // Ping 连接检查
    Ping(ctx context.Context) error
}
```

### 7.2 Target Plugin 接口

```go
// TargetPlugin 目标端数据库插件接口
type TargetPlugin interface {
    Name() string
    Version() string
    Connect(ctx context.Context, config ConnectionConfig) error
    Close() error
    Ping(ctx context.Context) error
    
    // ApplyDDL 应用 DDL
    ApplyDDL(ctx context.Context, ddl *DDLObject) (*DDLResult, error)
    
    // CreateTable 建表
    CreateTable(ctx context.Context, schema *TableSchema) error
    
    // BatchWrite 批量写入（全量迁移）
    BatchWrite(ctx context.Context, batch *RowBatch) (*WriteResult, error)
    
    // Write 单行写入（CDC 回放）
    Write(ctx context.Context, events []*CDCEvent) (*WriteResult, error)
    
    // GetChecksum 计算表分块校验值
    GetChecksum(ctx context.Context, table string, chunk ChunkRange) (string, error)
    
    // PreCheck 迁移前检查（主键、字符集等）
    PreCheck(ctx context.Context, tables []TableMetadata) ([]PreCheckWarning, error)
}
```

### 7.3 REST API

```
# 任务管理
POST   /api/v1/tasks             创建迁移任务
GET    /api/v1/tasks             任务列表
GET    /api/v1/tasks/:id         任务详情
PUT    /api/v1/tasks/:id         更新任务（暂停/恢复/停止）
DELETE /api/v1/tasks/:id         删除任务

# 任务操作
POST   /api/v1/tasks/:id/start      启动
POST   /api/v1/tasks/:id/pause      暂停
POST   /api/v1/tasks/:id/resume     恢复
POST   /api/v1/tasks/:id/stop       停止
POST   /api/v1/tasks/:id/verify     手动触发校验

# 任务进度（WebSocket）
WS     /api/v1/tasks/:id/progress

# Schema 迁移
POST   /api/v1/schema/preview      预览 DDL 转换结果
POST   /api/v1/schema/apply        应用 DDL

# 数据源管理
GET    /api/v1/datasources         数据源列表
POST   /api/v1/datasources         添加数据源
PUT    /api/v1/datasources/:id     更新数据源
POST   /api/v1/datasources/test    测试连接

# 插件管理
GET    /api/v1/plugins             已加载插件列表
GET    /api/v1/plugins/:name       插件详情（支持的能力矩阵）

# 监控
GET    /api/v1/metrics/overview    总览指标
GET    /api/v1/metrics/task/:id    任务指标
```

---

## 八、任务状态机

```
                    ┌──────────┐
                    │  DRAFT   │  刚创建，未启动
                    └────┬─────┘
                         │ start
                    ┌────▼─────┐
                    │  INIT    │  初始化：连接检查、meta 发现
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │                     │
         ┌────▼─────┐        ┌─────▼────┐
         │  SCHEMA  │        │FULL_SYNC │  全量迁移
         │ _MIGRATE │        └─────┬────┘
         └────┬─────┘              │ complete
              │               ┌────▼─────┐
              └──────────────►│CDC_SYNC  │  增量同步
                              └────┬─────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
               ┌────▼─────┐  ┌────▼────┐  ┌─────▼────┐
               │VERIFYING │  │ PAUSED  │  │ COMPLETED│
               └────┬─────┘  └────┬────┘  └──────────┘
                    │              │ resume
                    └──────────────┘
                         │
                    ┌────▼─────┐
                    │  ERROR   │  (可重试)
                    └──────────┘
```

---

## 九、分阶段实施计划

### Phase 1: 核心框架（2-3 周）

目标：跑通框架，能全量迁移 MySQL → MySQL

- [ ] 项目脚手架（Go Module、目录结构）
- [ ] Plugin 接口定义（Source / Target / Schema / Verify）
- [ ] MySQL Source Plugin（全量分块导出）
- [ ] MySQL Target Plugin（批量写入）
- [ ] 任务状态机 + 持久化（SQLite）
- [ ] API Server（任务 CRUD）
- [ ] Worker（全量迁移执行）
- [ ] Docker Compose 部署

**验证：** MySQL sakila 库 全量迁移到另一个 MySQL 实例

### Phase 2: PolarDB-X Target + Schema Engine（2-3 周）

- [ ] PolarDB-X Target Plugin
  - LOAD DATA INFILE 批量导
  - 主键检查、Shard Key 推荐
  - 索引优化策略（删→导→建）
- [ ] Schema Engine
  - 类型映射框架
  - MySQL → PolarDB-X 映射规则
  - DDL 转换、PARTITION 适配
- [ ] PreCheck 机制

**验证：** MySQL → PolarDB-X 全量迁移

### Phase 3: OceanBase Source（2 周）

- [ ] OceanBase Source Plugin
  - 全量导出（分块并行）
  - OBLogProxy CDC 集成（Canal 协议）
  - VARCHAR 超长处理
  - PARTITION / INDEX 导出
- [ ] OB → PolarDB-X 类型映射
- [ ] 对象迁移支持

**验证：** OceanBase → PolarDB-X 全量 + 增量

### Phase 4: TiDB Source（2 周）

- [ ] TiDB Source Plugin
  - Dumpling 兼容全量导出
  - TiCDC MySQL Sink 集成
  - AUTO_RANDOM 处理
- [ ] TiDB → PolarDB-X 类型映射
- [ ] 对象迁移支持

**验证：** TiDB → PolarDB-X 全量 + 增量

### Phase 5: CDC Pipeline + 数据校验（2 周）

- [ ] CDC Engine（统一事件流处理）
- [ ] 事务排序、去重
- [ ] CDC 状态持久化 + 断点恢复
- [ ] Verify Engine（全量校验）
- [ ] 持续校验（CDC 阶段）
- [ ] Web UI（任务创建、监控面板）

### Phase 6: 完善与扩展（持续）

- [ ] Web UI 完善（进度可视化、实时监控）
- [ ] 更多数据库支持（Oracle、PostgreSQL、GaussDB...）
- [ ] 性能优化、大规模测试
- [ ] 告警、通知集成
- [ ] 双向同步
- [ ] 数据过滤/转换规则

---

## 十、关键技术点

### 10.1 Chunk 分块算法

```go
func (s *MySQLSource) chunkTable(table string, keyCol string, chunkSize int) []ChunkRange {
    // 1. 查询 MIN/MAX 主键
    // 2. 按 chunkSize 切分: [min, min+N), [min+N, min+2N), ...
    // 3. 对非数字主键用 ORDER BY pk LIMIT N OFFSET M 方式
    // 4. 无主键表：LIMIT OFFSET 方式（警告性能）
}
```

### 10.2 CDC 位点管理

```
Source: OBLogProxy binlog position (file + offset) or GTID
Storage: SQLite / etcd (持久化)
Recovery: 从上次持久化的位置继续消费

位点更新时机：
- 每 N 条事件或每 M 秒批量更新一次（避免每个事件都写）
- 事务边界确认后更新（保证 at-least-once）
```

### 10.3 类型映射配置（OB → PolarDB-X）

```yaml
# config/type-mapping/ob2polardbx.yaml
type_mappings:
  - source: VARCHAR(n)
    condition: "n > 65535"
    target: TEXT
    warning: "VARCHAR({n}) 超过 PolarDB-X 65535 限制，已映射为 TEXT"
  - source: VARCHAR(n)
    condition: "n <= 65535"
    target: VARCHAR(n)
  - source: TINYINT
    target: TINYINT
  - source: INT
    target: INT
  - source: BIGINT
    target: BIGINT
  # ... 更多映射
```

### 10.4 事务排序（CDC）

```
问题：多线程 CDC 消费可能乱序
解决：
1. 按 GTID / commit timestamp 排序
2. 维护一个排序窗口（如 5 秒内的乱序容忍）
3. 超过窗口按序提交，保证最终一致
```

---

## 十一、监控指标

| 分类 | 指标 | 说明 |
|------|------|------|
| 全量 | `fullsync_rows_total` | 已迁移行数 |
| 全量 | `fullsync_bytes_total` | 已迁移字节数 |
| 全量 | `fullsync_rps` | 每秒行数 |
| 全量 | `fullsync_progress` | 完成百分比 |
| CDC | `cdc_lag_seconds` | 同步延迟（秒） |
| CDC | `cdc_events_total` | 已处理事件数 |
| CDC | `cdc_error_total` | 错误事件数 |
| Worker | `worker_pool_busy` | 忙碌 Worker 数 |
| Worker | `worker_pool_idle` | 空闲 Worker 数 |

---

## 十二、已确认决策

1. **协议**：闭源，团队内部使用
2. **仓库**：GitHub Private repo（hangyuyang/dbmigrate）
3. **测试环境**：用户准备中，先用 MySQL→MySQL 验证核心框架
4. **性能目标**：尽可能高——全量用 LOAD DATA INFILE，CDC 用事务级批量回放
5. **DDL 范围 v1**：TABLE + INDEX + VIEW；v2 补充 PROCEDURE / FUNCTION / TRIGGER

---

*本文档为初始设计方案，实施过程中会持续调整。*
