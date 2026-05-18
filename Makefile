APP_NAME = dbmigrate
GO = go
GOFLAGS = -ldflags="-s -w"

.PHONY: all build server worker cli test clean

all: build

build: server worker cli

server:
	$(GO) build $(GOFLAGS) -o bin/dbmigrate-server ./cmd/server

worker:
	$(GO) build $(GOFLAGS) -o bin/dbmigrate-worker ./cmd/worker

cli:
	$(GO) build $(GOFLAGS) -o bin/dbmigrate ./cmd/cli

test:
	$(GO) test ./...

clean:
	rm -rf bin/

docker-build:
	docker build -t dbmigrate-server -f deploy/Dockerfile.server .
	docker build -t dbmigrate-worker -f deploy/Dockerfile.worker .

docker-up:
	docker compose -f deploy/docker-compose.yml up -d

docker-down:
	docker compose -f deploy/docker-compose.yml down
