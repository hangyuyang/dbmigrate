# DBMigrate — 异构数据库迁移工具

[![CI](https://github.com/hangyuyang/dbmigrate/actions/workflows/ci.yml/badge.svg)](https://github.com/hangyuyang/dbmigrate/actions)

插件化数据库迁移平台，支持全量/增量/对象迁移。

## 快速部署（Docker）

```bash
# 一行启动
docker run -d --name dbmigrate -p 9090:8080 \
  -v dbmigrate-data:/opt/dbmigrate/data \
  ghcr.io/hangyuyang/dbmigrate:latest

# 打开 Web UI
open http://localhost:9090
```

访问 http://localhost:9090 即可使用。端口 `9090` 可换成任意端口。

---

## 部署到 Linux 测试服务器

### 方式一：Docker（推荐）

在测试服务器上安装 Docker 后：

```bash
# 克隆代码
git clone https://github.com/hangyuyang/dbmigrate.git
cd dbmigrate

# 构建并启动
docker build -t dbmigrate:latest -f deploy/Dockerfile .
docker run -d --name dbmigrate -p 8080:8080 -v /opt/dbmigrate/data:/data dbmigrate:latest
```

### 方式二：Docker Compose

```bash
# 构建
docker build -t dbmigrate:latest -f deploy/Dockerfile .

# 启动
docker compose -f deploy/docker-compose.yml up -d
```

### 方式三：直接运行

```bash
# 编译后端
go build -o bin/dbmigrate-server ./cmd/server

# 编译前端
cd web && npm install && npm run build && cd ..

# 启动（前后端一体）
./bin/dbmigrate-server --port 8080 --web-dir web/dist --data-dir ./data
```

---

## 开发模式

```bash
# 终端 1：后端
go run ./cmd/server

# 终端 2：前端（热更新）
cd web && npm run dev
```

浏览器打开 http://localhost:3000（前端 Vite 代理 API 到 8080）

---

## 数据持久化

- **任务状态**: 存储在 `/data/tasks.db`（SQLite）
- 挂载宿主机目录可保留数据：
  ```bash
  docker run -v /opt/dbmigrate/data:/data ...
  ```

---

## 技术栈

| 层 | 技术 |
|---|------|
| 后端 | Go + gorilla/mux |
| 前端 | React 18 + Vite + React Router |
| 存储 | SQLite |
| 部署 | Docker / Docker Compose |
