#!/usr/bin/env bash
# Mechanical part of wiki-init: create .wiki/, init its own git repo, hide it
# from the project repo. Idempotent: never overwrites an existing file.
#
# Usage: bootstrap.sh [project-root] [language]
#   project-root  default: git toplevel of cwd, else cwd
#   language      default: English
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS="$SKILL_DIR/assets"

ROOT="${1:-}"
LANGUAGE="${2:-English}"
if [ -z "$ROOT" ]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
ROOT="$(cd "$ROOT" && pwd)"
PROJECT="$(basename "$ROOT")"
DATE="$(date +%Y-%m-%d)"
W="$ROOT/.wiki"

render() { # render <template> <dest>   (skips if dest exists)
  # Literal replacement via awk + ENVIRON, so names containing | & / \ are safe.
  local src="$1" dest="$2"
  if [ -e "$dest" ]; then echo "keep   $dest (exists)"; return; fi
  P_PROJECT="$PROJECT" P_LANGUAGE="$LANGUAGE" P_DATE="$DATE" awk '
    function rep(s, k, v,   out, i) {
      out = ""
      while ((i = index(s, k)) > 0) { out = out substr(s, 1, i - 1) v; s = substr(s, i + length(k)) }
      return out s
    }
    {
      line = rep($0, "{{PROJECT}}", ENVIRON["P_PROJECT"])
      line = rep(line, "{{LANGUAGE}}", ENVIRON["P_LANGUAGE"])
      print rep(line, "{{DATE}}", ENVIRON["P_DATE"])
    }' "$src" > "$dest"
  echo "create $dest"
}

mkdir -p "$W/raw" "$W/wiki"
touch "$W/raw/.gitkeep"
render "$ASSETS/SCHEMA.template.md" "$W/SCHEMA.md"
render "$ASSETS/index.template.md"  "$W/index.md"
render "$ASSETS/log.template.md"    "$W/log.md"

# Hide .wiki/ from the project repo without touching any tracked file.
if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  EXCLUDE="$(git -C "$ROOT" rev-parse --path-format=absolute --git-path info/exclude 2>/dev/null \
             || git -C "$ROOT" rev-parse --git-path info/exclude)"
  case "$EXCLUDE" in /*) ;; *) EXCLUDE="$ROOT/$EXCLUDE" ;; esac
  mkdir -p "$(dirname "$EXCLUDE")"
  touch "$EXCLUDE"
  if ! grep -qxF '.wiki/' "$EXCLUDE"; then
    printf '\n.wiki/\n' >> "$EXCLUDE"
    echo "exclude .wiki/ added to $EXCLUDE"
  else
    echo "exclude .wiki/ already in $EXCLUDE"
  fi
  # Record the project commit the wiki is based on.
  if [ ! -e "$W/.sync-state" ]; then
    if HEAD_SHA="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null)"; then
      echo "$HEAD_SHA" > "$W/.sync-state"
    else
      echo "none" > "$W/.sync-state"
    fi
    echo "create $W/.sync-state ($(cat "$W/.sync-state"))"
  fi
else
  echo "note: $ROOT is not a git repo; skipped exclude and .sync-state commit tracking"
  [ -e "$W/.sync-state" ] || echo "none" > "$W/.sync-state"
fi

# The wiki gets its own history.
if [ ! -d "$W/.git" ]; then
  git -C "$W" init -q
  echo "git init $W"
fi
if [ -z "$(git -C "$W" rev-parse --verify -q HEAD || true)" ]; then
  git -C "$W" add -A
  git -C "$W" commit -q -m "wiki: bootstrap" 2>/dev/null \
    && echo "committed bootstrap in $W" \
    || echo "note: could not commit in $W (set git user.name/user.email, then commit manually)"
fi

echo "done: $W"
