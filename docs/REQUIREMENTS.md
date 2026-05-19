# DBMigrate 需求文档

> 版本: v0.1.2 | 更新: 2026-05-19 | 仓库: github.com/hangyuyang/dbmigrate

## 1. 产品概述

### 1.1 产品定位
DBMigrate 是一个插件化的异构数据库迁移平台，提供全量迁移、增量同步、对象迁移和数据校验等能力，通过 Web 界面操作，支持 Docker 一键部署。第一期支持 OceanBase MySQL 模式 → PolarDB-X 的迁移。

### 1.2 目标用户
- DBA / 运维工程师：执行数据库迁移任务
- 架构师：选型验证

### 1.3 核心价值
- **零门槛部署**：`docker run` 一行启动，7MB 镜像
- **Web 向导操作**：5 步完成迁移任务配置
- **智能适配**：自动清洗 OB 特有语法，目标库自动创建
- **容错策略**：单表失败不影响整体迁移

---

## 2. 功能需求

### 2.1 数据库类型支持

| 类型 | 角色 | 状态 |
|------|------|------|
| OceanBase MySQL 3.x/4.x | 源端 | ✅ 已支持 |
| TiDB 5.x/6.x/7.x | 源端 | 🔜 界面已就绪 |
| PolarDB-X 集中式 | 目标端 | ✅ 已支持 |
| PolarDB-X 分布式 | 目标端 | ✅ 已支持 |

### 2.2 迁移模式

| 模式 | 说明 | 状态 |
|------|------|------|
| 结构迁移 | 表结构、索引、约束 DDL | ✅ |
| 全量迁移 | 存量数据完整同步 | ✅ |
| 增量同步 | 实时 CDC 捕获变更 | 🔜 |
| 数据校验 | CRC32 / 行数比对 | ✅ |

### 2.3 对象迁移范围

| 类型 | 状态 |
|------|------|
| 表 (TABLE) | ✅ |
| 索引 (INDEX) | ✅ |
| 视图 (VIEW) | ✅ (OB 端有) |
| 存储过程 / 函数 | 🔜 |
| 序列 / 触发器 | 🔜 |

### 2.4 任务创建向导（5 步）

**Step 1: 选择数据库类型**
- 源端/目标端矩阵选择
- 任务名称自定义

**Step 2: 连接配置**
- IP/端口/账号/密码
- OB 专属：集群名称 + 租户名称
- 连接测试（显示版本 + 延迟）
- 命令解析（粘贴 mysql/obclient 命令自动填表）

**Step 3: 迁移阶段选择**
- 结构迁移 / 全量迁移 / 增量同步 独立勾选
- CDC 子选项：DML 同步 + DDL 同步
- 数据校验独立卡片（对象校验 + 数据校验）

**Step 4: 对象选择**
- 源端 Schema 树（checkbox + 三角展开/折叠）
- 按类别分组（表/视图/函数，含全选 checkbox）
- 中间圆按钮 `›` 添加到已选
- 已选列表支持 Schema/表重命名、批量复选框删除

**Step 5: 性能配置**
- 任务数、CPU、内存、分块大小、并发数、批次、错误策略
- 概览确认 → 启动

### 2.5 任务管理

- 任务列表（按创建时间倒序）
- 任务详情（阶段状态、实时进度、行数统计、错误日志）
- 概览看板（总数/运行中/已完成/失败/成功率/总行数/近期任务）

---

## 3. 非功能需求

### 3.1 性能
- 全量迁移吞吐：4 并发 ≥ 5000 行/秒
- 分块导出 + 批量 INSERT（可配置 chunk_size/batch_size）
- 支持断点续传（基于主键分块）

### 3.2 可靠性
- 单表/单对象失败不终止整体任务
- 目标库不存在自动创建（两步重连法）
- 容器 `--restart unless-stopped` 自动恢复

### 3.3 兼容性
- OB DDL 9 种特有语法自动清洗为 MySQL 标准
- VARCHAR 超限自动映射 TEXT
- MySQL 协议兼容（OB/PolarDB-X 走统一 driver）
- 密码含 @# 特殊字符通过 Config 对象安全处理

### 3.4 可维护性
- Docker `FROM scratch`，7MB 镜像
- 任务数据 JSON 文件存储，零外部依赖
- 日志输出到 stdout，`docker logs` 可查

---

## 4. 技术架构

### 4.1 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Go 1.22 (gorilla/mux + gorilla/websocket) |
| 前端 | React 18 + Vite |
| 存储 | JSON 文件（${dataDir}/task_id.json） |
| 部署 | Docker `FROM scratch` / Docker Compose |
| CI/CD | GitHub Actions + Pre-commit Hook |

### 4.2 核心模块

```
cmd/server/main.go          — HTTP + WebSocket 服务入口
pkg/api/server.go           — REST API (tasks, plugins, schema, datasources)
pkg/engine/runner/runner.go — 任务执行引擎（连接→Schema→全量→校验）
pkg/plugin/interface.go     — Source / Target / TypeMapper 插件接口
pkg/sources/mysql/          — MySQL Source 插件（兼容 OB）
pkg/targets/mysql/          — MySQL Target 插件（兼容 PDB-X）
pkg/task/state.go           — 任务状态机（9 状态）
pkg/task/store.go           — JSON 文件持久化
```

### 4.3 API 设计

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/v1/health | GET | 健康检查 |
| /api/v1/tasks | GET/POST | 任务列表 / 创建 |
| /api/v1/tasks/:id | GET | 任务详情 |
| /api/v1/tasks/:id/start | POST | 启动 |
| /api/v1/tasks/:id/pause | POST | 暂停 |
| /api/v1/tasks/:id/stop | POST | 停止 |
| /api/v1/plugins | GET | 插件列表 |
| /api/v1/datasources/test | POST | 连接测试 |
| /api/v1/schema/discover | POST | Schema 发现 |

---

## 5. 工程体系

| 项 | 工具 |
|----|------|
| 版本管理 | Git + GitHub |
| 容器镜像 | `FROM scratch` (7.3MB) |
| CI | GitHub Actions (每次 push 编译检查) |
| Pre-commit | git hook: go build + go vet + react build |
| 回归测试 | `bash testcases/regression_suite.sh` (6 项) |
| 经验沉淀 | `dbmigrate-lessons` skill |
| 发布 | Git Tag → GitHub Release |

---

## 6. 后续规划

### v0.2（增量同步）
- OBLogProxy / TiCDC → 通用事件流
- 增量回放引擎（事务批量回放）
- DDL 同步

### v0.3（TiDB 支持）
- TiDB Source 插件
- TiDB → PDB-X 迁移链路

### v0.4（生产就绪）
- 数据源管理持久化（连接复用）
- 迁移结果报告导出
- 监控告警（任务失败通知）
- 用户认证
