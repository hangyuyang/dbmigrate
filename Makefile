.PHONY: build test deploy clean docker-build docker-push docker-run

# ── Build ──
build: build-go build-web

build-go:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/dbmigrate-server-linux ./cmd/server

build-web:
	cd web && npm run build

build-all: build-go build-web
	@echo "Build complete: bin/dbmigrate-server-linux + web/dist/"

# ── Docker ──
DOCKER_IMAGE = ghcr.io/hangyuyang/dbmigrate

docker-build:
	docker build -t $(DOCKER_IMAGE):latest .

docker-run:
	docker run -d --name dbmigrate -p 9090:8080 -v $$(pwd)/data:/opt/dbmigrate/data $(DOCKER_IMAGE):latest

docker-push:
	docker push $(DOCKER_IMAGE):latest

# ── Test ──
test:
	@echo "=== Unit tests ==="
	go vet ./...
	@echo "=== Integration (needs internal servers) ==="
	bash testcases/regression_suite.sh

test-quick:
	go build ./...

# ── Deploy ──
deploy: build-all
	tar czf /tmp/dbmigrate-latest.tar.gz bin/dbmigrate-server-linux web/dist/
	sshpass -p 'dba@123' scp -o StrictHostKeyChecking=no /tmp/dbmigrate-latest.tar.gz root@10.10.180.219:/tmp/
	sshpass -p 'dba@123' ssh -o StrictHostKeyChecking=no root@10.10.180.219 'bash /opt/dbmigrate/start.sh'

# ── Clean ──
clean:
	rm -rf bin/ web/dist/
