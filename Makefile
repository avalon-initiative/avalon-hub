SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help install hub-dev app-dev build lint test check release-checks-hub release-checks-app \
	release-hub release-app release-hub-skip-tests release-app-skip-tests clean

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  make %-24s %s\n", $$1, $$2}'

install: ## Install dependencies (needs NODE_AUTH_TOKEN with read:packages for the @avalon-initiative scope)
	npm ci

hub-dev: ## Vite dev server for apps/hub (the web app) on :5173
	npm run dev -w apps/hub

app-dev: ## tauri dev for apps/hub-app (the desktop/mobile app)
	npm run tauri dev -w apps/hub-app

build: ## Production builds of both apps' web bundles
	npm run build -w apps/hub
	cd apps/hub-app && npx vite build

lint: ## eslint across both apps
	npx eslint apps

test: ## Test suites of both apps
	npm run test -w apps/hub
	npm run test -w apps/hub-app

check: ## What CI runs: lint, type-check, tests, builds and cargo check for both apps
	bash scripts/release-checks.sh all

release-checks-hub: ## Pre-release gate for the web app
	bash scripts/release-checks.sh hub

release-checks-app: ## Pre-release gate for the desktop/mobile app
	bash scripts/release-checks.sh app

## Cut a release of the web app: checks, bump apps/hub, commit, tag hub-v<VER>[-title].
##   make release-hub VER=0.2.0 TITLE="Optional title"
## VER prompts if missing. Pushing the tag starts the release workflow.
release-hub: ## Release the web app (VER=x.y.z [TITLE="..."])
	bash scripts/release.sh hub "$(VER)" "$(TITLE)"

## Cut a release of the desktop/mobile app: checks, bump apps/hub-app (package.json,
## Cargo.toml, tauri.conf.json), commit, tag app-v<VER>[-title].
##   make release-app VER=0.2.0 TITLE="Optional title"
release-app: ## Release the desktop/mobile app (VER=x.y.z [TITLE="..."])
	bash scripts/release.sh app "$(VER)" "$(TITLE)"

release-hub-skip-tests: ## Same as release-hub without the pre-release checks
	SKIP_CHECKS=1 bash scripts/release.sh hub "$(VER)" "$(TITLE)"

release-app-skip-tests: ## Same as release-app without the pre-release checks
	SKIP_CHECKS=1 bash scripts/release.sh app "$(VER)" "$(TITLE)"

clean: ## Remove build output
	rm -rf apps/*/dist apps/hub-app/src-tauri/target
