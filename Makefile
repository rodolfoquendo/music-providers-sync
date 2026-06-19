.PHONY: up down build build-front build-api logs shell-api scan-local create-db help

up: ## Build and start all containers
	@[ -f .env ] || (echo "Copy .env.example to .env and fill in your credentials first." && exit 1)
	docker compose up -d --build

down: ## Stop all containers
	docker compose down

build: ## Rebuild all images without starting
	docker compose build

build-front: ## Rebuild and restart only the frontend container
	docker compose build music-front && docker compose up -d music-front

build-api: ## Rebuild and restart only the API container
	docker compose build music-api && docker compose up -d music-api

logs: ## Tail logs from all containers
	docker compose logs -f

shell-api: ## Open a bash shell in the API container
	docker exec -ti music-api bash

scan-local: ## Trigger a local music folder scan
	curl -s -X POST http://localhost:8002/local/scan | python3 -m json.tool

dev-api: ## Run the API locally (no Docker)
	cd api && uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload

dev-front: ## Run the frontend dev server locally (no Docker)
	cd front && npm run dev

install-front: ## Install frontend dependencies
	cd front && npm install

create-db: ## One-time: create the music DB and grant platform user access (run before make up)
	docker exec ie-api-db mysql -u root -p$$(grep DB_ROOT_PASSWORD .env | cut -d= -f2) -e \
	  "CREATE DATABASE IF NOT EXISTS music CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON music.* TO 'platform'@'%'; FLUSH PRIVILEGES;"

ytmusic-setup: ## One-time YouTube Music authentication setup
	docker exec -ti music-api bash -c "ytmusicapi setup"

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'


ngrok-api: 
	ngrok http --url=walleye-upright-reliably.ngrok-free.app 8002