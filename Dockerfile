# ============================================
# Stage 1: React 前端构建
# ============================================
FROM node:22-alpine AS frontend
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ============================================
# Stage 2: Go 后端构建
# ============================================
FROM golang:1.22-alpine AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
COPY --from=frontend /app/web/dist ./web/dist
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o dbmigrate-server ./cmd/server

# ============================================
# Stage 3: 最小运行镜像
# ============================================
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
COPY --from=backend /app/dbmigrate-server /usr/local/bin/
COPY --from=backend /app/web/dist /opt/dbmigrate/web/dist
RUN mkdir -p /opt/dbmigrate/data

EXPOSE 8080
ENTRYPOINT ["dbmigrate-server"]
CMD ["--port", "8080", "--web-dir", "/opt/dbmigrate/web/dist", "--data-dir", "/opt/dbmigrate/data"]
