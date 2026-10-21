---
name: wiki-init
description: Create an LLM-maintained wiki for the current project after surveying the existing code, so the structure fits the project. Personal mode (default) puts a private wiki in `.wiki/`, a separate git repo hidden from the project repo. Team mode (user says team, shared, nhóm, or passes --shared) puts a shared wiki in `docs/wiki/` with a check script and a GitHub Actions workflow. Use when the user asks to init, set up, bootstrap or create a project wiki or knowledge base. Not for projects with no code yet.
---

# wiki-init

Build a wiki for the current project following the "LLM wiki" pattern (sources, a wiki the
agent maintains, a schema file). Content is tailored to the project, so **survey first, decide
the structure second, write third**. Never init from a blank guess.

## 1. Pick the mode and check preconditions

1. Find the project root: `git rev-parse --show-toplevel`, else the cwd.
2. Mode:
   - **Team mode** if the user says team / shared / nhóm / for everyone, or passes `--shared`.
   - **Personal mode** otherwise.
   - If unclear and the repo clearly has several contributors (`git shortlog -sn`), ask once.
3. Stop and redirect when the wiki already exists:
   - `docs/wiki/SCHEMA.md` exists: the team wiki is already set up. Nothing to init. Tell the
     user to use `wiki-update` for their changes (the maintainer uses `wiki-sync`).
   - Personal mode and `.wiki/SCHEMA.md` exists: offer `wiki-sync` or `wiki-lint`.
   Both can coexist: a personal `.wiki/` next to a team `docs/wiki/` is fine.
4. If the project has almost no code or docs (an empty template, a lone README), stop and tell
   the user to run this once there is a base to document.
5. Team mode only: needs a git repo and Node 18+ (`node --version`). If Node is missing, say so
   and stop.

## 2. Survey the project (read-only)

Gather enough to know what the project *is*. Use Read/Glob/Grep and a few git commands:

- Top-level tree to depth 2 or 3 (skip `node_modules`, `target`, `build`, `.git`, vendored code).
- README, docs folders, manifests and build files (`package.json`, `Cargo.toml`,
  `pyproject.toml`, `CMakeLists.txt`, `platformio.ini`, `*.ino`, `*.sln`/`*.csproj`,
  `Makefile`, `docker-compose.yml`, ...).
- Entry points and the biggest or most-imported source files.
- `git log --oneline -30` and `git shortlog -sn | head` if it is a git repo.
- Existing agent files (`CLAUDE.md`, `AGENTS.md`): read for context. Personal mode never edits
  them; team mode edits them only as described in step 4T.

Classify the project (web service, CLI, library, embedded/Arduino firmware, game mod,
reverse-engineering target, data pipeline, ...). The kind decides the page types.

## 3. Decide the shape

Pick 4 to 8 page types that fit this project. Always include `overview`. Examples:

| Project kind | Useful page types besides overview |
|---|---|
| Backend / web app | modules, data model, API routes, flows, decisions, runbook |
| Library / CLI | public API, modules, concepts, decisions |
| Embedded / Arduino | hardware (pinout, parts), firmware modules, protocols, state machines, decisions |
| Game mod / reverse engineering | structures and offsets, hooks and injection flow, formats and protocols, tooling, findings |
| Data / ML pipeline | datasets, stages, configs, experiments, decisions |

Team mode: every type needs a **deterministic path rule** (see the team schema), so two people
documenting the same thing land on the same file. Module pages mirror code paths
(`modules/src/payment.md`), concepts use a canonical kebab-case slug, decisions are dated.

The wiki is written in **English** by default, whatever language the conversation is in. Use
another language only if the user explicitly asks for one; do not ask about it.

Then ask the user **in one message**, only what the survey could not answer:

- The proposed page-type list (let them add, drop or rename).
- Anything to skip or document in depth.
- Team mode: may I add a short wiki pointer block to the team's `CLAUDE.md` and `AGENTS.md`
  (recommended, so every teammate's agent finds the wiki)?

If the user is not present (unattended run), take the defaults (team mode: do NOT touch
`CLAUDE.md`/`AGENTS.md`), say so at the top of your final report, and continue.

## 4P. Personal mode: bootstrap

Run the script next to this file, in `scripts/` (resolve it from this SKILL.md's own directory).
It is idempotent and never overwrites existing files. The language argument is optional.

- Windows PowerShell: `powershell -NoProfile -ExecutionPolicy Bypass -File "<skill-dir>/scripts/bootstrap.ps1" -Root "<root>" [-Language "<language>"]`
- macOS / Linux / Git Bash: `bash "<skill-dir>/scripts/bootstrap.sh" "<root>" ["<language>"]`

It creates `.wiki/{SCHEMA.md,index.md,log.md,.sync-state,raw/,wiki/}`, runs `git init` inside
`.wiki/`, adds `.wiki/` to the project's `.git/info/exclude`, and records the current project
commit in `.sync-state`.

If the script cannot run, do the same by hand from `assets/*.template.md` (replace
`{{PROJECT}}`, `{{LANGUAGE}}`, `{{DATE}}`), then `git -C .wiki init`, append `.wiki/` to
`.git/info/exclude`, and write `git rev-parse HEAD` into `.wiki/.sync-state`.

## 4T. Team mode: bootstrap

1. Work on a branch: `git switch -c wiki/init` (from an up-to-date default branch).
2. Run: `node "<skill-dir>/scripts/bootstrap-shared.mjs" --root "<root>" [--language "<language>"] [--agent-files]`
   (`--agent-files` only if the user agreed in step 3).

It creates `docs/wiki/{SCHEMA.md,README.md,wiki.config.json,index.md,.sync-state}`,
`tools/wiki/wiki.mjs` (the check / index script, no dependencies) and
`.github/workflows/wiki.yml` (runs the check on every PR and comments). It never overwrites
existing files and commits nothing.

## 5. Tailor the schema

Edit the schema (`.wiki/SCHEMA.md` or `docs/wiki/SCHEMA.md`):

- Replace the "Page types" table with the types chosen in step 3 (paths, what each holds).
  Team mode: also update `"types"` in `docs/wiki/wiki.config.json` to the same list.
- Fill "Project-specific conventions": build/run commands, naming, areas documented in depth,
  things to skip, anything the user asked for. Remove the HTML comments.
- Keep every other section as is unless the user asks for a change.

## 6. First content pass

Write real pages, not stubs. Depth beats breadth: aim for `overview.md` plus the **5 to 12 most
important** pages, then stop. Name the remaining areas in the overview as "not yet documented"
so later syncs and the user can fill them in.

For each page follow the schema: frontmatter, `sources` as `path` or `path#symbol`, specifics,
links to related pages, `(unverified)` on anything not checked in the code. Read the actual
source before stating what it does. Team mode: one sentence per line, `summary` and `aliases`
filled in.

Then:

- **Personal**: write `.wiki/index.md` (grouped by type, one line per page), append
  `## [YYYY-MM-DD] init | first pass` to `.wiki/log.md`, and
  `git -C .wiki add -A && git -C .wiki commit -m "wiki: first pass"`.
- **Team**: run `node tools/wiki/wiki.mjs build-index`, then `node tools/wiki/wiki.mjs check`
  and fix every error and warning. Stage everything and commit on `wiki/init` as
  `docs: add project wiki` (ask before committing if the user is present). Offer to push and
  open the PR (`gh pr create` if available); do not push without a yes.

## 7. Verify

- Personal: `git status --short` in the project root shows nothing from `.wiki/`. If it does,
  fix `.git/info/exclude`; never touch `.gitignore`.
- Team: `node tools/wiki/wiki.mjs check` reports 0 errors, 0 warnings; `build-index --check`
  passes.
- Every page is reachable from `index.md`; every link resolves.
- No secrets, tokens or credentials were copied into the wiki.

## 8. Report

Tell the user, briefly: mode, what was created and where, the page list, which areas are not yet
documented, and how to use it.

- Personal: `wiki-sync` after the project changes or after a `git pull`, `wiki-lint`
  occasionally; questions work normally since sessions read `index.md` first. The wiki is local
  only; to back it up: `git -C .wiki remote add origin <private-url>`.
- Team: teammates with agents run `wiki-update` at the end of a task (or just follow the
  schema); teammates without agents do nothing; the maintainer runs `wiki-sync` from time to
  time; CI comments on every PR; merge conflicts inside `docs/wiki/` are resolved by taking
  either side. Point them to `docs/wiki/README.md` to share with the team.
