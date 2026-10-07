#!/bin/bash
# Super Hints: opt-in Hyprland bridge so hints appear while you hold ❖ Super.
#
#   ./bridge.sh install     add one line to ~/.config/hypr/hyprland.lua (backed up first)
#   ./bridge.sh uninstall   remove it again
#   ./bridge.sh status
#
# The line loads hypr/super-hints.lua straight from this plugin folder, so plugin
# updates update the bridge too. It is wrapped in pcall, so if the plugin is
# removed the line does nothing.

set -euo pipefail

HYPR="$HOME/.config/hypr/hyprland.lua"
DIR="$(cd "$(dirname "$0")" && pwd)"
BRIDGE="$DIR/hypr/super-hints.lua"
BEGIN="-- >>> super-hints bridge"
END="-- <<< super-hints bridge"
ANCHOR='require("default.hypr.omarchy")'

die() { echo "super-hints: $*" >&2; exit 1; }
installed() { grep -qF -- "$BEGIN" "$HYPR" 2>/dev/null; }

confirm() {
  [[ ${YES:-0} == 1 ]] && return 0
  if command -v gum >/dev/null && [[ -t 0 ]]; then gum confirm "$1"; else
    read -r -p "$1 [y/N] " a; [[ $a == [yY]* ]]; fi
}

reload() {
  hyprctl reload >/dev/null
  sleep 0.5
  local errors; errors=$(hyprctl configerrors | tr -d '[:space:]')
  [[ -z $errors ]] || { echo "Hyprland reported config errors:"; hyprctl configerrors; }
}

install() {
  [[ -f $HYPR ]] || die "$HYPR not found"
  [[ -f $BRIDGE ]] || die "bridge not found at $BRIDGE"
  installed && { echo "Bridge already installed."; return; }
  grep -qF -- "$ANCHOR" "$HYPR" || die "couldn't find $ANCHOR in $HYPR; add the line from the README by hand"

  cat <<INFO
This adds one line to $HYPR, above Omarchy's defaults:

  pcall(dofile, "$BRIDGE")

It reports when ❖ Super is held and which Super bindings fire, so hints can
appear and learn. It never sees ordinary typing. A backup is made first.
INFO
  confirm "Install the Super Hints bridge?" || die "aborted"

  local backup; backup="$HYPR.bak.super-hints.$(date +%s)"
  cp "$HYPR" "$backup"
  local block
  block=$(printf '%s\n-- Hold ❖ Super for shortcut hints. Remove with: %s uninstall\npcall(dofile, "%s")\n%s' \
    "$BEGIN" "$DIR/bridge.sh" "$BRIDGE" "$END")
  BLOCK="$block" ANCHOR="$ANCHOR" perl -0pi -e 's/^(?=[^\n]*\Q$ENV{ANCHOR}\E)/$ENV{BLOCK}\n\n/m' "$HYPR"
  echo "Installed. Backup: $backup"
  reload
}

uninstall() {
  installed || { echo "Bridge not installed."; return; }
  cp "$HYPR" "$HYPR.bak.super-hints.$(date +%s)"
  BEGIN="$BEGIN" END="$END" perl -0pi -e 's/\Q$ENV{BEGIN}\E.*?\Q$ENV{END}\E\n*//s' "$HYPR"
  echo "Removed the bridge from $HYPR"
  reload
}

[[ ${2:-} == --yes || ${2:-} == -y ]] && YES=1
case "${1:-}" in
  install) install ;;
  uninstall) uninstall ;;
  status) installed && echo "installed" || echo "not installed" ;;
  *) echo "Usage: $0 install|uninstall|status [--yes]"; exit 1 ;;
esac
