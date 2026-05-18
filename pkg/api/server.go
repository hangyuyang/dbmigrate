package api

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/go-sql-driver/mysql"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"

	"github.com/hangyuyang/dbmigrate/pkg/plugin"
	"github.com/hangyuyang/dbmigrate/pkg/task"
)

// TaskRunner 任务执行接口
type TaskRunner interface {
	StartTask(ctx context.Context, taskID string) error
	StopTask(taskID string)
}

// Server API Server
type Server struct {
	http     *http.Server
	router   *mux.Router
	registry *plugin.Registry
	store    task.Store
	runner   TaskRunner
	upgrader websocket.Upgrader
	webDir   string
}

// NewServer 创建 API Server
func NewServer(port int) *Server {
	s := &Server{
		registry: plugin.NewRegistry(),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
	s.router = mux.NewRouter()
	s.registerRoutes()
	s.http = &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: s.router,
	}
	return s
}

// ServeStatic 注册前端静态文件（SPA 模式）
func (s *Server) ServeStatic(webDir string) {
	s.webDir = webDir

	// API 之外的请求回退到 index.html（支持 SPA routing）
	s.router.PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(webDir, r.URL.Path)

		// 如果是文件，直接返回
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			http.ServeFile(w, r, path)
			return
		}

		// 目录或不存在，回退到 index.html
		http.ServeFile(w, r, filepath.Join(webDir, "index.html"))
	})
}

// InitRunner 初始化任务执行器
func (s *Server) InitRunner(runner TaskRunner) {
	s.runner = runner
}

// InitStore 初始化任务存储
func (s *Server) InitStore(store task.Store) {
	s.store = store
}

func (s *Server) registerRoutes() {
	api := s.router.PathPrefix("/api/v1").Subrouter()

	// 健康检查
	api.HandleFunc("/health", s.handleHealth).Methods("GET")

	// 数据源
	api.HandleFunc("/datasources", s.handleListDatasources).Methods("GET")
	api.HandleFunc("/datasources/test", s.handleTestConnection).Methods("POST")

	// 插件
	api.HandleFunc("/plugins", s.handleListPlugins).Methods("GET")

	// 任务
	api.HandleFunc("/tasks", s.handleCreateTask).Methods("POST")
	api.HandleFunc("/tasks", s.handleListTasks).Methods("GET")
	api.HandleFunc("/tasks/{id}", s.handleGetTask).Methods("GET")
	api.HandleFunc("/tasks/{id}", s.handleUpdateTask).Methods("PUT")
	api.HandleFunc("/tasks/{id}", s.handleDeleteTask).Methods("DELETE")
	api.HandleFunc("/tasks/{id}/start", s.handleStartTask).Methods("POST")
	api.HandleFunc("/tasks/{id}/pause", s.handlePauseTask).Methods("POST")
	api.HandleFunc("/tasks/{id}/resume", s.handleResumeTask).Methods("POST")
	api.HandleFunc("/tasks/{id}/stop", s.handleStopTask).Methods("POST")
	api.HandleFunc("/tasks/{id}/progress", s.handleTaskProgress).Methods("GET")

	// Schema
	api.HandleFunc("/schema/preview", s.handleSchemaPreview).Methods("POST")
}

// ListenAndServe 启动服务
func (s *Server) ListenAndServe() error {
	return s.http.ListenAndServe()
}

// Shutdown 关闭服务
func (s *Server) Shutdown() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	s.http.Shutdown(ctx)
}

// generateID 生成随机 ID
func generateID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// --- Handlers ---

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) handleListDatasources(w http.ResponseWriter, r *http.Request) {
	// TODO: 从 store 读取已保存的数据源
	json.NewEncoder(w).Encode([]interface{}{})
}

func (s *Server) handleTestConnection(w http.ResponseWriter, r *http.Request) {
	var config plugin.ConnectionConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	start := time.Now()
	cfg := mysql.NewConfig()
	cfg.User = config.User
	cfg.Passwd = config.Password
	cfg.Net = "tcp"
	cfg.Addr = fmt.Sprintf("%s:%d", config.Host, config.Port)
	cfg.DBName = config.Database
	cfg.Timeout = 10 * time.Second
	cfg.TLS = &tls.Config{InsecureSkipVerify: true}

	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error(), "latency_ms": time.Since(start).Milliseconds()})
		return
	}

	// 获取版本信息
	var version string
	db.QueryRowContext(ctx, "SELECT VERSION()").Scan(&version)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"version":    version,
		"latency_ms": time.Since(start).Milliseconds(),
	})
}

func (s *Server) handleListPlugins(w http.ResponseWriter, r *http.Request) {
	resp := map[string]interface{}{
		"sources": s.registry.ListSources(),
		"targets": s.registry.ListTargets(),
	}
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleCreateTask(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		writeError(w, http.StatusInternalServerError, "task store not initialized")
		return
	}

	var input struct {
		Name           string                   `json:"name"`
		Source         plugin.ConnectionConfig  `json:"source"`
		Target         plugin.ConnectionConfig  `json:"target"`
		Filter         plugin.TableFilter       `json:"filter"`
		Mode           string                   `json:"mode"`
		ChunkSize      int64                    `json:"chunk_size"`
		Parallel       int                      `json:"parallel"`
		BatchSize      int                      `json:"batch_size"`
		RateLimit      int                      `json:"rate_limit"`
		ErrorPolicy    string                   `json:"error_policy"`
		MigrateObjects task.MigrateObjects      `json:"migrate_objects"`
		EnableVerify   bool                     `json:"enable_verify"`
		VerifyMethod   string                   `json:"verify_method"`
		VerifyChunks   int                      `json:"verify_chunks"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	t := &task.Task{
		ID:             generateID(),
		Name:           input.Name,
		Status:         task.StatusDraft,
		Source:         input.Source,
		Target:         input.Target,
		Filter:         input.Filter,
		Mode:           input.Mode,
		ChunkSize:      input.ChunkSize,
		Parallel:       input.Parallel,
		BatchSize:      input.BatchSize,
		RateLimit:      input.RateLimit,
		ErrorPolicy:    input.ErrorPolicy,
		MigrateObjects: input.MigrateObjects,
		EnableVerify:   input.EnableVerify,
		VerifyMethod:   input.VerifyMethod,
		VerifyChunks:   input.VerifyChunks,
	}

	if t.ChunkSize == 0 { t.ChunkSize = 10000 }
	if t.Parallel == 0 { t.Parallel = 4 }
	if t.BatchSize == 0 { t.BatchSize = 500 }
	if t.Mode == "" { t.Mode = "schema+full" }
	if t.ErrorPolicy == "" { t.ErrorPolicy = "abort" }
	if t.VerifyMethod == "" { t.VerifyMethod = "checksum" }
	if t.VerifyChunks == 0 { t.VerifyChunks = 100 }

	if err := s.store.Create(t); err != nil {
		log.Printf("create task error: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to create task")
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(t)
}

func (s *Server) handleListTasks(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		json.NewEncoder(w).Encode([]*task.Task{})
		return
	}
	tasks, _ := s.store.List()
	json.NewEncoder(w).Encode(tasks)
}

func (s *Server) handleGetTask(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	if s.store == nil {
		writeError(w, http.StatusInternalServerError, "task store not initialized")
		return
	}
	t, err := s.store.Get(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}
	json.NewEncoder(w).Encode(t)
}

func (s *Server) handleUpdateTask(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not implemented")
}

func (s *Server) handleDeleteTask(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	if err := s.store.Delete(id); err != nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleStartTask(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	if s.runner == nil {
		writeError(w, http.StatusInternalServerError, "task runner not initialized")
		return
	}
	if err := s.runner.StartTask(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "started", "id": id})
}

func (s *Server) handlePauseTask(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	// 暂不支持暂停，用停止代替
	if s.runner != nil {
		s.runner.StopTask(id)
	}
	t, _ := s.store.Get(id)
	if t != nil {
		t.Status = task.StatusPaused
		s.store.Update(t)
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "paused"})
}

func (s *Server) handleResumeTask(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	if s.runner == nil {
		writeError(w, http.StatusInternalServerError, "task runner not initialized")
		return
	}
	// 暂不支持断点续传，当作重新启动
	if err := s.runner.StartTask(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "resumed"})
}

func (s *Server) handleStopTask(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	if s.runner != nil {
		s.runner.StopTask(id)
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "stopped"})
}

func (s *Server) handleTaskProgress(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not implemented")
}

func (s *Server) handleSchemaPreview(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not implemented")
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
