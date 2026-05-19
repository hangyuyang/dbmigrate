package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	var (
		serverAddr = flag.String("server", "localhost:8080", "API server address")
	)
	flag.Parse()

	hostname, _ := os.Hostname()
	log.Printf("[DBMigrate Worker] starting worker %s, connecting to %s", hostname, *serverAddr)

	log.Printf("[DBMigrate Worker] ready, waiting for jobs...")

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	log.Println("[DBMigrate Worker] shutting down")
}
