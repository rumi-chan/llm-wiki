# Install the llm-wiki skills for Claude Code and Codex (Windows PowerShell 5.1+ / pwsh).
#
#   .\install.ps1                  install for both agents
#   .\install.ps1 -Target claude   only Claude Code
#   .\install.ps1 -Target codex    only Codex
#   .\install.ps1 -NoHint          skip the global "read .wiki/ first" instruction
#   .\install.ps1 -Uninstall       remove skills and the global instruction
#
# Skills go to:  Claude Code  ~/.claude/skills/<name>   (or $env:CLAUDE_CONFIG_DIR\skills)
#                Codex        ~/.agents/skills/<name>
# Global hint:   Claude Code  ~/.claude/CLAUDE.md
#                Codex        ~/.codex/AGENTS.md        (or $env:CODEX_HOME\AGENTS.md)
param(
  [ValidateSet("all", "claude", "codex")]
  [string]$Target = "all",
  [switch]$NoHint,
  [switch]$Uninstall
)
$ErrorActionPreference = "Stop"

$Repo = $PSScriptRoot
$SkillNames = @("wiki-init", "wiki-sync", "wiki-update", "wiki-lint")
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Begin = "<!-- llm-wiki:begin -->"
$End = "<!-- llm-wiki:end -->"
$Hint = [System.IO.File]::ReadAllText((Join-Path $Repo "global\wiki-hint.md"), $Utf8NoBom).Trim()

$ClaudeHome = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }

$Agents = @()
if ($Target -in @("all", "claude")) {
  $Agents += [pscustomobject]@{ Name = "Claude Code"; Skills = (Join-Path $ClaudeHome "skills"); Instr = (Join-Path $ClaudeHome "CLAUDE.md") }
}
if ($Target -in @("all", "codex")) {
  $Agents += [pscustomobject]@{ Name = "Codex"; Skills = (Join-Path $HOME ".agents\skills"); Instr = (Join-Path $CodexHome "AGENTS.md") }
}

function Remove-HintBlock([string]$Text) {
  $pattern = "(?s)\r?\n?" + [regex]::Escape($Begin) + ".*?" + [regex]::Escape($End) + "\r?\n?"
  return [regex]::Replace($Text, $pattern, "`n")
}

function Set-Hint([string]$Path, [bool]$Present) {
  $existing = ""
  if (Test-Path -LiteralPath $Path) { $existing = [System.IO.File]::ReadAllText($Path, $Utf8NoBom) }
  $clean = (Remove-HintBlock $existing).TrimEnd()
  if ($Present) {
    $new = if ($clean) { $clean + "`n`n" + $Hint + "`n" } else { $Hint + "`n" }
  } else {
    if (-not (Test-Path -LiteralPath $Path)) { return }
    $new = if ($clean) { $clean + "`n" } else { "" }
  }
  if ($new -eq $existing) { Write-Host "  unchanged $Path"; return }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null
  [System.IO.File]::WriteAllText($Path, $new, $Utf8NoBom)
  Write-Host "  updated   $Path"
}

foreach ($a in $Agents) {
  Write-Host "$($a.Name):"
  foreach ($s in $SkillNames) {
    $dest = Join-Path $a.Skills $s
    if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
    if (-not $Uninstall) {
      New-Item -ItemType Directory -Force -Path $a.Skills | Out-Null
      Copy-Item -LiteralPath (Join-Path $Repo "skills\$s") -Destination $dest -Recurse
      Write-Host "  installed $dest"
    } else {
      Write-Host "  removed   $dest"
    }
  }
  if ($Uninstall) { Set-Hint $a.Instr $false }
  elseif (-not $NoHint) { Set-Hint $a.Instr $true }
}

if ($Uninstall) { Write-Host "Done. Per-project .wiki/ folders were not touched." }
else {
  Write-Host ""
  Write-Host "Done. Restart Claude Code / Codex, then in a project:"
  Write-Host "  Claude Code:  /wiki-init   /wiki-sync   /wiki-update   /wiki-lint"
  Write-Host "  Codex:        `$wiki-init   `$wiki-sync   `$wiki-update   `$wiki-lint   (or /skills)"
}
