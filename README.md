# llm-wiki

[Tiếng Việt](README.vi.md)

Skills that build and maintain a **wiki for each project**, following
[Karpathy's LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).
They work in both **Claude Code** and **Codex**.

Two modes:

| | Personal mode (default) | Team mode |
|---|---|---|
| Where | `.wiki/`, a separate git repo hidden from the project repo | `docs/wiki/`, committed with the code |
| Who sees it | only you | the whole team, on GitHub too |
| Kept up to date by | you, with `wiki-sync` | each member's agent in their own PR (`wiki-update`) + the maintainer's periodic `wiki-sync` |
| Checks | `wiki-lint` | a script + GitHub Actions on every PR, plus `wiki-lint` |

Both can coexist in the same project: team facts in `docs/wiki/`, personal notes in `.wiki/`.

## Install

Pick **one** option. Option A is the easiest; do not combine it with option B for the same
agent, or the agent gets the wiki pointer twice.

### Option A: plugin (recommended)

This repo is its own plugin marketplace, hosted at [rumi-chan/llm-wiki](https://github.com/rumi-chan/llm-wiki).

**Claude Code**

```
/plugin install llm-wiki --marketplace rumi-chan/llm-wiki
```

or from a shell: `claude plugin marketplace add rumi-chan/llm-wiki` then
`claude plugin install llm-wiki@llm-wiki`. Update later with `claude plugin update llm-wiki@llm-wiki`.

Plugin skills are namespaced: `/llm-wiki:wiki-init`, `/llm-wiki:wiki-sync`,
`/llm-wiki:wiki-update`, `/llm-wiki:wiki-lint` (asking in plain words also works).
The plugin adds a `SessionStart` hook instead of editing your global `CLAUDE.md`: when a repo has
a wiki, it tells the agent where the wiki is and how many commits it is behind. It needs `node` on
your `PATH` and prints nothing in repos without a wiki.

**Codex**

```
codex plugin marketplace add rumi-chan/llm-wiki
```

then open `/plugins` in Codex and install **llm-wiki**. Codex asks you to review and trust the
plugin's hook before it runs. If the hook does not work in your Codex setup, use option B with
`-Target codex` instead (skills plus a block in `~/.codex/AGENTS.md`).

### Option B: install script

Copies the skills into your agent's skills folder and adds a short block to your global
instruction file. Skills keep their short names (`/wiki-init`, `$wiki-init`).

```powershell
# Windows (PowerShell)
git clone https://github.com/rumi-chan/llm-wiki ; cd llm-wiki
.\install.ps1
```

```bash
# macOS / Linux / Git Bash
./install.sh
```

Options: `-Target claude|codex` (or `--claude` / `--codex`), `-NoHint` / `--no-hint`,
`-Uninstall` / `--uninstall`. Safe to re-run: it reinstalls without duplicating anything.

| | Claude Code | Codex |
|---|---|---|
| Skills | `~/.claude/skills/wiki-*` | `~/.agents/skills/wiki-*` |
| Global instruction | adds a block to `~/.claude/CLAUDE.md` | adds a block to `~/.codex/AGENTS.md` |

The global block (between `<!-- llm-wiki:begin -->` and `<!-- llm-wiki:end -->`) tells your agent
to read `SCHEMA.md` and `index.md` of whichever wiki a repo has. So a personal wiki needs **no
pointer file inside the repo**. (Codex has no equivalent of `CLAUDE.local.md`, and
`AGENTS.override.md` would hide the team's `AGENTS.md`.) Install with `-NoHint` to leave your
global files alone.

Restart Claude Code / Codex after installing. The installer copies the skills, so edit them in this
repo and re-run the installer rather than editing the installed copies.

## Skills

| Skill | Claude Code | Codex | What it does |
|---|---|---|---|
| `wiki-init` | `/wiki-init` | `$wiki-init` | Survey the project, then create the wiki (personal, or team with "team"/`--shared`) |
| `wiki-sync` | `/wiki-sync` | `$wiki-sync` | Personal: catch the wiki up with the code. Team: maintainer's periodic sync, as a PR |
| `wiki-update` | `/wiki-update` | `$wiki-update` | Team: update the pages affected by *your branch*, before the PR |
| `wiki-lint` | `/wiki-lint` | `$wiki-lint` | Read-only health report; fixes only what you approve |

For questions, just ask normally: the schema tells the agent to read `index.md` first.

### `wiki-init` runs **after** the project has a base

It surveys the project (README, manifests, tree, entry points, `git log`), classifies it (web app,
CLI, Arduino firmware, game mod / reverse engineering, data pipeline, ...), **proposes page types
that fit** and asks you once to confirm. Then it bootstraps the skeleton, tailors `SCHEMA.md`, and
writes the 5 to 12 most important pages. If the project is still nearly empty, it stops.

The wiki is written in **English** by default. Ask for another language when running `wiki-init`.

Pages cite their sources as `path` or `path#symbol` (for example
`src/auth/session.ts#refreshToken`), never line numbers or commit hashes: those go stale on every
edit and disappear after squash or rebase merges. A symbol that no longer exists is detected.

## Personal mode

```
<project>/.wiki/            separate git repo, excluded from the project repo
├── SCHEMA.md               the contract: page types, format, workflows
├── index.md                catalog of every page
├── log.md                  append-only: ## [YYYY-MM-DD] init|sync|ingest|query|lint | ...
├── .sync-state             project commit the wiki is synced to
├── raw/                    material you add: datasheets, notes, dumps (never edited by the agent)
└── wiki/                   pages written and maintained by the agent
```

`.wiki/` is added to `.git/info/exclude`, which only applies on your machine, so nothing in the
project changes and teammates see nothing. `wiki-sync` runs `git diff <.sync-state>..HEAD`, finds
the pages citing changed files, revises them, and commits inside the wiki repo. Teammates' commits
arrive through `git pull`, then `wiki-sync`.

- Search it with `rg --no-ignore -n "term" .wiki/wiki` (ignore-aware tools skip excluded folders).
- Back it up with `git -C .wiki remote add origin <your-private-repo>`; never push it to the team repo.
- `git clean -fdx` skips `.wiki/` (nested repo), but `git clean -ffdx` deletes it.

## Team mode

For teams where some members use agents and some do not, and a leader merges PRs.

```
<project>/
├── docs/wiki/
│   ├── SCHEMA.md            the contract every agent follows
│   ├── README.md            the rules, for humans (share this with the team)
│   ├── wiki.config.json     allowed page types and statuses
│   ├── index.md             GENERATED by the script, never edited by hand
│   ├── .sync-state          last default-branch commit the maintainer synced to
│   ├── overview.md
│   ├── modules/<code path>.md, concepts/<slug>.md, decisions/<date>-<slug>.md
├── tools/wiki/wiki.mjs      check + index script (Node 18+, no dependencies, no AI)
└── .github/workflows/wiki.yml
```

### Setup (once, by the leader)

Run `wiki-init` and say it is for the team (or `--shared`). It works on a `wiki/init` branch,
creates the files above, optionally adds a short pointer block to the team's `CLAUDE.md` and
`AGENTS.md` (it asks first), writes the first pages, and offers to open the PR.

### Day to day

1. **Member with an agent** finishes a task; the agent runs `wiki-update`: it checks which pages
   cite files changed on the branch and fixes just those, in the same PR. It never touches
   `index.md`. (Teammates who did not install these skills get the same instructions from
   `SCHEMA.md` through the pointer block.)
2. **Member without an agent** does nothing wiki-related.
3. **GitHub Actions** runs `tools/wiki/wiki.mjs check` on every PR and posts one comment (updated
   on each push): pages that drifted from the code, possible duplicate pages, broken links,
   invalid page headers, things that look like secrets. **Warnings never fail the check**; errors
   turn it red but only block merging if the repo owner makes the check required.
4. **The leader merges** PRs as usual (squash or merge commit, both fine). On a conflict inside
   `docs/wiki/`, take either side: the wiki is derived from code, so nothing is lost.
5. **The leader runs `wiki-sync`** every few PRs or at the end of a sprint: on an up-to-date default
   branch it verifies pages authors already updated, fixes the drift others left, merges
   duplicate pages, regenerates `index.md`, and opens a `wiki: sync` PR. It never pushes to the
   default branch directly.

### Why this avoids conflicts and duplicates

- Nobody edits `index.md` by hand, and there is no `log.md` (git history is the log), so the two
  files every change would touch are gone.
- Only the maintainer runs the sync, so several agents never rewrite the same page from the same diff.
- Pages have **deterministic paths** (module pages mirror code directories, concept slugs are
  canonical terms, decisions are dated), so two people documenting the same thing edit the same
  file and git shows a conflict instead of two pages silently coexisting. The check script also
  flags pages with the same or very similar names and aliases.
- Pages use one sentence per line and agents make minimal edits, so git merges per sentence.

### Cost

The check is a plain Node script: free on public repos, and well within the free GitHub Actions
minutes on private repos (a run takes seconds). The AI work (`wiki-update`, `wiki-sync`) runs in
each person's own agent, not in CI.

### Upgrading the team tooling

After updating this repo, refresh the script and workflow in a project with
`node <llm-wiki>/skills/wiki-init/scripts/bootstrap-shared.mjs --update-tools` (pages and schema are
never overwritten).

## Repo layout

```
llm-wiki/
├── .claude-plugin/                       Claude Code plugin manifest + marketplace
├── .agents/plugins/marketplace.json      Codex marketplace
├── plugin.json                           Codex plugin manifest
├── hooks/                                SessionStart hook (plugin install)
├── install.ps1 / install.sh              script install (option B)
├── global/wiki-hint.md                   the global instruction block (option B)
└── skills/
    ├── wiki-init/
    │   ├── SKILL.md
    │   ├── assets/                       personal-mode templates
    │   │   └── shared/                   team-mode templates, wiki.mjs, wiki.yml
    │   └── scripts/                      bootstrap.ps1 / bootstrap.sh (personal), bootstrap-shared.mjs (team)
    ├── wiki-sync/SKILL.md
    ├── wiki-update/SKILL.md
    └── wiki-lint/SKILL.md
```

## License

MIT
