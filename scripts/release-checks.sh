#!/usr/bin/env bash
# Pre-release validation gate for one product, or both.
#
#   scripts/release-checks.sh hub   lint, type-check, tests and production build of the web app
#   scripts/release-checks.sh app   the same for the desktop/mobile app, plus `cargo check` of the Tauri package
#   scripts/release-checks.sh all   both (what CI runs on pull requests)
#
# `make release-hub` / `make release-app` run this before they change anything,
# so a broken build fails locally instead of after a tag is pushed.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
target="${1:-all}"

check_hub() {
  echo "release-checks: hub: lint"
  npx eslint apps/hub
  echo "release-checks: hub: type-check"
  (cd apps/hub && npx vue-tsc --noEmit)
  echo "release-checks: hub: tests"
  npm run test -w apps/hub
  echo "release-checks: hub: build"
  npm run build -w apps/hub
}

check_app() {
  echo "release-checks: app: lint"
  npx eslint apps/hub-app
  echo "release-checks: app: type-check"
  (cd apps/hub-app && npx vue-tsc -b)
  echo "release-checks: app: tests"
  npm run test -w apps/hub-app
  echo "release-checks: app: web build"
  (cd apps/hub-app && npx vite build)
  echo "release-checks: app: cargo check (Tauri package)"
  (cd apps/hub-app/src-tauri && cargo check -q)
}

case "$target" in
  hub) check_hub ;;
  app) check_app ;;
  all) check_hub; check_app ;;
  *) echo "usage: release-checks.sh [hub|app|all]"; exit 1 ;;
esac

echo "release-checks: all checks passed"
