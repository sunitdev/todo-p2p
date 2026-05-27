.DEFAULT_GOAL := help
.PHONY: help install web web-down mac mac-deps wasm wasm-deps lint typecheck test test-e2e build clean hooks-install hooks-run

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

wasm: ## Build browser iroh transport (packages/iroh-wasm -> pkg/)
	bash scripts/build-wasm.sh

wasm-deps: ## Print prereqs for the wasm transport build
	@echo "Required: rustup wasm32 target, wasm-pack, and an LLVM whose clang targets wasm32."
	@echo "Install:  rustup target add wasm32-unknown-unknown"
	@echo "          cargo install wasm-pack"
	@echo "  macOS:  brew install llvm   # Apple's system clang lacks the wasm32 target"
	@echo "  Linux:  the distro clang usually already targets wasm32"

lint: ## Lint all TS/TSX
	bun run lint

typecheck: ## Typecheck workspace
	bun run typecheck

test: ## Run unit tests across all workspaces
	bun run test

test-e2e: ## Run end-to-end Playwright tests (Chromium + WebKit)
	bun run test:e2e

build: ## Production build (web bundle only; desktop via 'tauri build')
	bun --filter @todo-p2p/web build

clean: ## Remove build artifacts (keeps node_modules)
	rm -rf apps/web/dist apps/desktop/src-tauri/target packages/core/dist packages/ui/dist
	rm -rf packages/iroh-wasm/pkg packages/iroh-wasm/target
	find . -name '*.tsbuildinfo' -not -path '*/node_modules/*' -delete
