.DEFAULT_GOAL := help
.PHONY: help install web web-down mac mac-deps lint typecheck test build clean hooks-install hooks-run

COMPOSE := docker compose -f infra/docker/docker-compose.yml

help: ## Show targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
	  awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install JS deps via Bun
	bun install --frozen-lockfile

hooks-install: ## Install git hooks (requires pre-commit on PATH)
	@command -v pre-commit >/dev/null || { echo "pre-commit not found. Install: brew install pre-commit (or pipx install pre-commit)" >&2; exit 1; }
	bun run hooks:install

hooks-run: ## Run all hooks against every file
	bun run hooks:run

web: ## Run web app in Docker (HMR @ http://localhost:5173)
	$(COMPOSE) up --build web

web-down: ## Stop web container
	$(COMPOSE) down

mac: ## Run desktop (Tauri) natively
	bun --filter @todo-p2p/desktop tauri dev

mac-deps: ## Print native prereqs for Tauri on macOS
	@echo "Required: Rust toolchain (rustup), Xcode CLT."
	@echo "Install:  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
	@echo "          xcode-select --install"
	@echo "Bootstrap icons (one-time, requires source PNG >=1024x1024):"
	@echo "          bun --filter @todo-p2p/desktop tauri icon path/to/source.png"

lint: ## Lint all TS/TSX
	bun run lint

typecheck: ## Typecheck workspace
	bun run typecheck

test: ## Run package tests
	bun run test

build: ## Production build (web bundle only; desktop via 'tauri build')
	bun --filter @todo-p2p/web build

clean: ## Remove build artifacts (keeps node_modules)
	rm -rf apps/web/dist apps/desktop/src-tauri/target packages/core/dist packages/ui/dist
	find . -name '*.tsbuildinfo' -not -path '*/node_modules/*' -delete
