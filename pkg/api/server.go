package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"

	"github.com/hangyuyang/dbmigrate/pkg/plugin"
	"github.com/hangyuyang/dbmigrate/pkg/task"
)

// Server API Server
type Server struct {
	http     *http.Server
	router   *mux.Router
	registry *plugin.Registry
	store    task.Store
	upgrader websocket.Upgrader
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
	w.WriteHeader(http.StatusNotImplemented)
	json.NewEncoder(w).Encode(map[string]string{"error": "not implemented"})
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
		Name      string                   `json:"name"`
		Source    plugin.ConnectionConfig  `json:"source"`
		Target    plugin.ConnectionConfig  `json:"target"`
		Filter    plugin.TableFilter       `json:"filter"`
		Mode      string                   `json:"mode"`
		ChunkSize int64                    `json:"chunk_size"`
		Parallel  int                      `json:"parallel"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	t := &task.Task{
		ID:        generateID(),
		Name:      input.Name,
		Status:    task.StatusDraft,
		Source:    input.Source,
		Target:    input.Target,
		Filter:    input.Filter,
		Mode:      input.Mode,
		ChunkSize: input.ChunkSize,
		Parallel:  input.Parallel,
	}

	if t.ChunkSize == 0 {
		t.ChunkSize = 50000
	}
	if t.Parallel == 0 {
		t.Parallel = 4
	}
	if t.Mode == "" {
		t.Mode = "full"
	}

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
	writeError(w, http.StatusNotImplemented, "not implemented")
}

func (s *Server) handlePauseTask(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not implemented")
}

func (s *Server) handleResumeTask(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not implemented")
}

func (s *Server) handleStopTask(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not implemented")
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
