#!/bin/bash
# Copy this checkout into the Omarchy plugins folder for local development.
set -euo pipefail
ID=io.github.glacierhubab.super-hints
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.config/omarchy/plugins/$ID"
mkdir -p "$DEST/hypr"
cp "$SRC"/{manifest.json,Panel.qml,Ranker.js,bridge.sh,README.md,LICENSE} "$DEST"/
cp "$SRC"/hypr/super-hints.lua "$DEST"/hypr/
echo "Copied to $DEST"
