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
)

func main() {
	var (
		port = flag.Int("port", 8080, "API server port")
	)
	flag.Parse()

	srv := api.NewServer(*port)

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
