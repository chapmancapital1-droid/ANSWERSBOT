.DEFAULT_GOAL := help
.PHONY: help dev down migrate seed test lint logs build clean prod prod-down

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

dev: ## Start all services (dev compose)
	docker compose up --build
down: ## Stop all services
	docker compose down
migrate: ## Apply Prisma migrations
	docker compose exec api npm run prisma:deploy
seed: ## Seed reference + demo data
	docker compose exec api npm run prisma:seed
test: ## Run all tests
	npm run test
	cd apps/workers && pytest -q
lint: ## Lint + typecheck everything
	npm run lint
	npm run typecheck
	cd apps/workers && ruff check . && mypy answerspot_workers
logs: ## Tail logs
	docker compose logs -f
build: ## Build images locally
	docker compose build
prod: ## Production compose (see docs/DEPLOY.md)
	docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
prod-down: ## Stop production compose
	docker compose -f docker-compose.prod.yml down
clean: ## Remove volumes (DESTRUCTIVE)
	docker compose down -v
