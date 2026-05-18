package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/hangyuyang/dbmigrate/pkg/task"
)

func main() {
	var (
		serverAddr = flag.String("server", "localhost:8080", "API server address")
	)
	flag.Parse()

	hostname, _ := os.Hostname()
	log.Printf("[DBMigrate Worker] starting worker %s, connecting to %s", hostname, *serverAddr)

	store, err := task.NewSQLiteStore("./data/tasks.db")
	if err != nil {
		log.Fatalf("failed to open task store: %v", err)
	}
	defer store.Close()

	log.Printf("[DBMigrate Worker] task store ready, waiting for jobs...")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[DBMigrate Worker] shutting down...")
}
