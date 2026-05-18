package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/hangyuyang/dbmigrate/pkg/api"
	"github.com/hangyuyang/dbmigrate/pkg/task"
)

func main() {
	var (
		port   = flag.Int("port", 8080, "API server port")
		webDir = flag.String("web-dir", "", "Static web UI directory (e.g. web/dist)")
		dataDir = flag.String("data-dir", "./data", "Data directory for task store")
	)
	flag.Parse()

	srv := api.NewServer(*port)

	// 初始化任务存储
	os.MkdirAll(*dataDir, 0755)
	store, err := task.NewJSONStore(*dataDir)
	if err != nil {
		log.Printf("[DBMigrate] warning: failed to open task store: %v", err)
	} else {
		srv.InitStore(store)
		defer store.Close()
	}

	// 注册前端静态文件
	if *webDir != "" {
		srv.ServeStatic(*webDir)
		log.Printf("[DBMigrate] serving web UI from %s", *webDir)
	}

	go func() {
		addr := fmt.Sprintf(":%d", *port)
		log.Printf("[DBMigrate] API server starting on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	// graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[DBMigrate] shutting down...")
	srv.Shutdown()
}
