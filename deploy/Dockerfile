# ============================================
# Stage 1: 编译前端
# ============================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ .
RUN npm run build

# ============================================
# Stage 2: 编译后端
# ============================================
FROM golang:1.22-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /dbmigrate-server ./cmd/server

# ============================================
# Stage 3: 运行时镜像
# ============================================
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

COPY --from=backend-builder /dbmigrate-server /usr/local/bin/dbmigrate-server
COPY --from=frontend-builder /app/web/dist /app/web/dist

RUN mkdir -p /data
EXPOSE 8080
ENV DATA_DIR=/data
ENV WEB_DIR=/app/web/dist

ENTRYPOINT ["dbmigrate-server"]
CMD ["--port", "8080", "--web-dir", "/app/web/dist", "--data-dir", "/data"]
