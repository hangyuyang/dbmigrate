package main

import (
	"flag"
	"fmt"
	"os"
)

func main() {
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, `DBMigrate CLI

Usage:
  dbmigrate server     Start API server
  dbmigrate worker     Start worker node
  dbmigrate version    Print version

`)
	}

	if len(os.Args) < 2 {
		flag.Usage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "version":
		fmt.Println("DBMigrate v0.1.0")
	default:
		flag.Usage()
		os.Exit(1)
	}
}
