# Mechanical part of wiki-init: create .wiki/, init its own git repo, hide it
# from the project repo. Idempotent: never overwrites an existing file.
#
# Usage: bootstrap.ps1 [-Root <project-root>] [-Language <language>]
#   Root      default: git toplevel of cwd, else cwd
#   Language  default: English
param(
  [string]$Root = "",
  [string]$Language = "English"
)
$ErrorActionPreference = "Stop"

$SkillDir = Split-Path -Parent $PSScriptRoot
$Assets = Join-Path $SkillDir "assets"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Run git without letting its stderr chatter (hints, "not a repository") turn into
# terminating errors on Windows PowerShell 5.1. Output is returned, exit code in $script:GitCode.
$script:GitCode = 0
function Invoke-Git {
  $old = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $out = & git @args 2>$null
    $script:GitCode = $LASTEXITCODE
    return $out
  } finally {
    $ErrorActionPreference = $old
  }
}

if (-not $Root) {
  $top = Invoke-Git rev-parse --show-toplevel
  if ($script:GitCode -eq 0 -and $top) { $Root = ([string]$top).Trim() } else { $Root = (Get-Location).Path }
}
$Root = (Resolve-Path -LiteralPath $Root).Path
$Project = Split-Path -Leaf $Root
$Date = Get-Date -Format "yyyy-MM-dd"
$W = Join-Path $Root ".wiki"

function Write-Rendered([string]$Src, [string]$Dest) {
  if (Test-Path -LiteralPath $Dest) { Write-Host "keep   $Dest (exists)"; return }
  $text = [System.IO.File]::ReadAllText($Src, $Utf8NoBom)
  $text = $text.Replace("{{PROJECT}}", $Project).Replace("{{LANGUAGE}}", $Language).Replace("{{DATE}}", $Date)
  [System.IO.File]::WriteAllText($Dest, $text, $Utf8NoBom)
  Write-Host "create $Dest"
}

New-Item -ItemType Directory -Force -Path (Join-Path $W "raw"), (Join-Path $W "wiki") | Out-Null
$gitkeep = Join-Path $W "raw\.gitkeep"
if (-not (Test-Path -LiteralPath $gitkeep)) { [System.IO.File]::WriteAllText($gitkeep, "", $Utf8NoBom) }
Write-Rendered (Join-Path $Assets "SCHEMA.template.md") (Join-Path $W "SCHEMA.md")
Write-Rendered (Join-Path $Assets "index.template.md")  (Join-Path $W "index.md")
Write-Rendered (Join-Path $Assets "log.template.md")    (Join-Path $W "log.md")

$syncState = Join-Path $W ".sync-state"
$null = Invoke-Git -C $Root rev-parse --git-dir
if ($script:GitCode -eq 0) {
  # Hide .wiki/ from the project repo without touching any tracked file.
  $exclude = ([string](Invoke-Git -C $Root rev-parse --git-path info/exclude)).Trim()
  if (-not [System.IO.Path]::IsPathRooted($exclude)) { $exclude = Join-Path $Root $exclude }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $exclude) | Out-Null
  if (-not (Test-Path -LiteralPath $exclude)) { [System.IO.File]::WriteAllText($exclude, "", $Utf8NoBom) }
  $lines = [System.IO.File]::ReadAllLines($exclude)
  if ($lines -notcontains ".wiki/") {
    [System.IO.File]::AppendAllText($exclude, "`n.wiki/`n")
    Write-Host "exclude .wiki/ added to $exclude"
  } else {
    Write-Host "exclude .wiki/ already in $exclude"
  }
  if (-not (Test-Path -LiteralPath $syncState)) {
    $sha = Invoke-Git -C $Root rev-parse HEAD
    if ($script:GitCode -ne 0 -or -not $sha) { $sha = "none" }
    $sha = ([string]$sha).Trim()
    [System.IO.File]::WriteAllText($syncState, ($sha + "`n"), $Utf8NoBom)
    Write-Host "create $syncState ($sha)"
  }
} else {
  Write-Host "note: $Root is not a git repo; skipped exclude and commit tracking"
  if (-not (Test-Path -LiteralPath $syncState)) { [System.IO.File]::WriteAllText($syncState, "none`n", $Utf8NoBom) }
}

# The wiki gets its own history.
if (-not (Test-Path -LiteralPath (Join-Path $W ".git"))) {
  $null = Invoke-Git -C $W init -q
  Write-Host "git init $W"
}
$null = Invoke-Git -C $W rev-parse --verify -q HEAD
if ($script:GitCode -ne 0) {
  $null = Invoke-Git -C $W add -A
  $null = Invoke-Git -C $W commit -q -m "wiki: bootstrap"
  if ($script:GitCode -eq 0) { Write-Host "committed bootstrap in $W" }
  else { Write-Host "note: could not commit in $W (set git user.name/user.email, then commit manually)" }
}

Write-Host "done: $W"
