package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/hangyuyang/dbmigrate/pkg/engine/fullsync"
	"github.com/hangyuyang/dbmigrate/pkg/task"
)

func main() {
	var (
		serverAddr = flag.String("server", "localhost:8080", "API server address")
		workerID   = flag.String("id", "", "Worker ID (auto-generated if empty)")
	)
	flag.Parse()

	if *workerID == "" {
		hostname, _ := os.Hostname()
		*workerID = hostname
	}

	log.Printf("[DBMigrate Worker] starting worker %s, connecting to %s", *workerID, *serverAddr)

	store, err := task.NewSQLiteStore("./data/tasks.db")
	if err != nil {
		log.Fatalf("failed to open task store: %v", err)
	}
	defer store.Close()

	engine := fullsync.NewEngine(store)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[DBMigrate Worker] shutting down...")
	engine.Stop()
}
