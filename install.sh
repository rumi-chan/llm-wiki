#!/usr/bin/env bash
# Install the llm-wiki skills for Claude Code and Codex (macOS / Linux / Git Bash).
#
#   ./install.sh                   install for both agents
#   ./install.sh --claude          only Claude Code
#   ./install.sh --codex           only Codex
#   ./install.sh --no-hint         skip the global "read .wiki/ first" instruction
#   ./install.sh --uninstall       remove skills and the global instruction
#
# Skills go to:  Claude Code  ~/.claude/skills/<name>   (or $CLAUDE_CONFIG_DIR/skills)
#                Codex        ~/.agents/skills/<name>
# Global hint:   Claude Code  ~/.claude/CLAUDE.md
#                Codex        ~/.codex/AGENTS.md        (or $CODEX_HOME/AGENTS.md)
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS=(wiki-init wiki-sync wiki-update wiki-lint)
BEGIN='<!-- llm-wiki:begin -->'
END='<!-- llm-wiki:end -->'

DO_CLAUDE=1; DO_CODEX=1; HINT=1; UNINSTALL=0
for arg in "$@"; do
  case "$arg" in
    --claude)    DO_CODEX=0 ;;
    --codex)     DO_CLAUDE=0 ;;
    --no-hint)   HINT=0 ;;
    --uninstall) UNINSTALL=1 ;;
    -h|--help)   sed -n '2,13p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"

strip_block() { # strip_block <file>  -> stdout without the llm-wiki block
  awk -v b="$BEGIN" -v e="$END" '
    index($0, b) { skip = 1; next }
    index($0, e) { skip = 0; next }
    !skip { print }' "$1"
}

set_hint() { # set_hint <file> <1|0>
  local file="$1" present="$2" tmp
  if [ "$present" = 0 ] && [ ! -e "$file" ]; then return; fi
  mkdir -p "$(dirname "$file")"; touch "$file"
  tmp="$(mktemp)"
  strip_block "$file" | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}' > "$tmp"
  if [ "$present" = 1 ]; then
    [ -s "$tmp" ] && printf '\n' >> "$tmp"
    cat "$REPO/global/wiki-hint.md" >> "$tmp"
  fi
  if cmp -s "$tmp" "$file"; then echo "  unchanged $file"; rm -f "$tmp"
  else mv "$tmp" "$file"; echo "  updated   $file"; fi
}

install_for() { # install_for <label> <skills-dir> <instructions-file>
  local label="$1" sdir="$2" instr="$3" s
  echo "$label:"
  for s in "${SKILLS[@]}"; do
    rm -rf "${sdir:?}/$s"
    if [ "$UNINSTALL" = 0 ]; then
      mkdir -p "$sdir"
      cp -R "$REPO/skills/$s" "$sdir/$s"
      chmod +x "$sdir/$s"/scripts/*.sh 2>/dev/null || true
      echo "  installed $sdir/$s"
    else
      echo "  removed   $sdir/$s"
    fi
  done
  if [ "$UNINSTALL" = 1 ]; then set_hint "$instr" 0
  elif [ "$HINT" = 1 ]; then set_hint "$instr" 1; fi
}

[ "$DO_CLAUDE" = 1 ] && install_for "Claude Code" "$CLAUDE_HOME/skills" "$CLAUDE_HOME/CLAUDE.md"
[ "$DO_CODEX" = 1 ]  && install_for "Codex" "$HOME/.agents/skills" "$CODEX_HOME_DIR/AGENTS.md"

if [ "$UNINSTALL" = 1 ]; then
  echo "Done. Per-project .wiki/ folders were not touched."
else
  echo
  echo "Done. Restart Claude Code / Codex, then in a project:"
  echo "  Claude Code:  /wiki-init   /wiki-sync   /wiki-update   /wiki-lint"
  echo "  Codex:        \$wiki-init   \$wiki-sync   \$wiki-update   \$wiki-lint   (or /skills)"
fi
