#!/usr/bin/env bash
# Fails unless the version in a release tag matches the product's version files.
# Usage: scripts/verify-release-version.sh hub-v0.2.0[-title] | app-v0.2.0[-title]
set -euo pipefail

tag="${1:?usage: verify-release-version.sh <tag>}"
cd "$(git rev-parse --show-toplevel)"

case "$tag" in
  hub-v*) product=hub; rest="${tag#hub-v}" ;;
  app-v*) product=app; rest="${tag#app-v}" ;;
  *) echo "verify-release-version: tag '$tag' must start with hub-v or app-v"; exit 1 ;;
esac
if [[ ! "$rest" =~ ^([0-9]+\.[0-9]+\.[0-9]+) ]]; then
  echo "verify-release-version: cannot derive X.Y.Z from tag '$tag'"
  exit 1
fi
want="${BASH_REMATCH[1]}"

check() { # file label actual
  if [[ "$3" != "$want" ]]; then
    echo "verify-release-version: tag $tag is $want but $2 is $3"
    exit 1
  fi
}

if [ "$product" = hub ]; then
  check x apps/hub/package.json "$(node -p 'require("./apps/hub/package.json").version')"
else
  check x apps/hub-app/package.json "$(node -p 'require("./apps/hub-app/package.json").version')"
  check x tauri.conf.json "$(node -p 'require("./apps/hub-app/src-tauri/tauri.conf.json").version')"
  cargo_ver="$(sed -n '/^\[package\]/,/^\[/p' apps/hub-app/src-tauri/Cargo.toml | sed -nE 's/^version[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' | head -n1)"
  check x Cargo.toml "$cargo_ver"
fi
echo "verify-release-version: $tag matches the $product version files ($want)"
