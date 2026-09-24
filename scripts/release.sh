#!/usr/bin/env bash
# Cut a release of one product: run its checks, bump only its own version
# files, commit, and create an annotated tag. Pushing the tag is what starts
# the release workflow.
#
#   scripts/release.sh hub 0.2.0 ["Optional title"]   ->  tag hub-v0.2.0[-optional-title]
#   scripts/release.sh app 0.2.0 ["Optional title"]   ->  tag app-v0.2.0[-optional-title]
#
# Environment: SKIP_CHECKS=1 skips the pre-release checks.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

product="${1:-}"
ver="${2:-}"
title="${3:-}"

case "$product" in
  hub) prefix="hub-v"; pkg="apps/hub" ;;
  app) prefix="app-v"; pkg="apps/hub-app" ;;
  *) echo "usage: release.sh <hub|app> <X.Y.Z> [title]"; exit 1 ;;
esac

current="$(node -p "require('./$pkg/package.json').version")"
if [ -z "$ver" ]; then
  read -r -p "Release version for $product (current: $current): " ver
  ver="${ver:-$current}"
fi
if ! [[ "$ver" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "release: invalid version '$ver' (expected X.Y.Z)"
  exit 1
fi

slug="$(printf '%s' "$title" | sed -E 's/[[:space:]]+/-/g; s/[^A-Za-z0-9._-]//g; s/^-+//; s/-+$//')"
tag="${prefix}${ver}${slug:+-$slug}"
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "release: tag '$tag' already exists"
  exit 1
fi

if [ "${SKIP_CHECKS:-}" = "1" ]; then
  echo "release: skipping pre-release checks (SKIP_CHECKS=1)"
else
  echo "release: running pre-release checks for $product"
  if ! bash scripts/release-checks.sh "$product"; then
    echo "release: pre-release checks failed; nothing was changed"
    exit 1
  fi
fi

echo "release: product=$product version=$ver tag=$tag"
files=("$pkg/package.json" package-lock.json)
npm version --no-git-tag-version --allow-same-version -w "$pkg" "$ver" >/dev/null

if [ "$product" = "app" ]; then
  # Tauri keeps its own version in Cargo.toml and tauri.conf.json.
  tmp="$(mktemp)"
  awk -v ver="$ver" '
    $0 == "[package]" { in_package = 1; print; next }
    in_package && /^\[/ { in_package = 0 }
    in_package && /^version[[:space:]]*=/ { $0 = "version = \"" ver "\"" }
    { print }' apps/hub-app/src-tauri/Cargo.toml > "$tmp"
  mv "$tmp" apps/hub-app/src-tauri/Cargo.toml
  # Replace only the top-level version line so the rest of the file is untouched.
  sed -i -E '0,/^([[:space:]]*)"version"[[:space:]]*:[[:space:]]*"[^"]*"/s//\1"version": "'"$ver"'"/' apps/hub-app/src-tauri/tauri.conf.json
  (cd apps/hub-app/src-tauri && cargo check -q >/dev/null 2>&1 || true)
  files+=(apps/hub-app/src-tauri/Cargo.toml apps/hub-app/src-tauri/Cargo.lock apps/hub-app/src-tauri/tauri.conf.json)
fi

git add -- "${files[@]}"
if git diff --cached --quiet -- "${files[@]}"; then
  echo "release: no version changes to commit (continuing with tag)"
else
  git commit -q -m "Release $tag"
fi
git tag -a "$tag" -m "$tag"
echo "release done: $tag"
echo "Next: git push origin main --follow-tags   (pushing the tag starts the release workflow)"
