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
	"github.com/hangyuyang/dbmigrate/pkg/engine/runner"
	"github.com/hangyuyang/dbmigrate/pkg/task"

	mysqlsrc "github.com/hangyuyang/dbmigrate/pkg/sources/mysql"
	mysqltgt "github.com/hangyuyang/dbmigrate/pkg/targets/mysql"
)

func main() {
	var (
		port    = flag.Int("port", 8080, "API server port")
		webDir  = flag.String("web-dir", "", "Static web UI directory (e.g. web/dist)")
		dataDir = flag.String("data-dir", "./data", "Data directory for task store")
	)
	flag.Parse()

	// 初始化任务存储
	os.MkdirAll(*dataDir, 0755)
	store, err := task.NewJSONStore(*dataDir)
	if err != nil {
		log.Fatalf("failed to open task store: %v", err)
	}
	defer store.Close()

	// 初始化插件
	mysqlSource := mysqlsrc.NewSource()
	mysqlTarget := mysqltgt.NewTarget()

	// 初始化 Runner
	r := runner.New(store)
	r.RegisterSource(mysqlSource)
	r.RegisterTarget(mysqlTarget)

	// 初始化 API Server
	srv := api.NewServer(*port)
	srv.InitStore(store)
	srv.InitRunner(r)

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

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[DBMigrate] shutting down...")
	srv.Shutdown()
}
