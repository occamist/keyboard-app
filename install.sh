#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
pnpm install && pnpm tauri build -b deb
sudo cp -a "$SCRIPT_DIR"/src-tauri/target/release/bundle/deb/keyboard-app_*/data/* /
