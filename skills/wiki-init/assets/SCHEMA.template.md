# {{PROJECT}} wiki: schema

This file is the contract for the project wiki in `.wiki/`. Read it fully before
touching the wiki. Co-evolve it with the user: when a convention stops working,
change it here and note the change in `log.md`.

- Wiki language: **{{LANGUAGE}}** (write page bodies in this language; keep code,
  identifiers, file paths and commands verbatim)
- Created: {{DATE}}
- The wiki is a personal knowledge base for this project. It is a **separate git
  repo** in `.wiki/`, hidden from the project's own repo through
  `.git/info/exclude`. Never add `.wiki/` to the project's `.gitignore`, never
  commit it to the project repo, never edit team-shared files (`CLAUDE.md`,
  `AGENTS.md`, ...) to point at it.

## Layers

1. **Source of truth** = the project itself (code, configs, docs) plus
   `.wiki/raw/`. The agent reads these and never edits `raw/`.
2. **Wiki** = `.wiki/wiki/`, markdown pages written and maintained by the agent.
   The user reads them; the agent owns them.
3. **Schema** = this file.

```
.wiki/
├── SCHEMA.md        this file
├── index.md         catalog of every page (agent rewrites on each change)
├── log.md           append-only history of ingests, syncs, queries, lint runs
├── .sync-state      one line: the project commit the wiki was last synced to
├── raw/             user-supplied material: datasheets, notes, dumps, articles
└── wiki/            the pages
```

## Page types

<!-- wiki-init: replace this section with the page types that fit THIS project,
     after surveying it. Keep 4-8 types. Delete this comment. -->

| Type | Folder | What it holds |
|------|--------|---------------|
| overview | `wiki/` | `overview.md`: what the project is, how to build/run it, how the pieces fit |
| module | `wiki/modules/` | One page per significant module/component: role, public surface, key files |
| concept | `wiki/concepts/` | One page per idea needed to understand the code (protocol, algorithm, data format) |
| decision | `wiki/decisions/` | Why something is the way it is, with alternatives considered |
| glossary | `wiki/glossary.md` | Project vocabulary |

## Page format

Every page starts with frontmatter:

```yaml
---
title: Human readable title
type: overview | module | concept | decision | ...
status: draft | stable | stale
updated: YYYY-MM-DD
sources:            # where the claims come from: path or path#symbol
  - src/net/
  - src/net/client.rs#connect
  - raw/datasheet.pdf
---
```

Rules:

- One page = one concept. If the title needs "and", split it.
- **Cite specifics**: file paths with the symbol (`path#symbol`), exact names, numbers,
  offsets, versions. Do not cite line numbers or commit hashes in `sources`: they go stale
  on every edit. A claim with no source is marked `(unverified)`.
- Synthesize, do not paraphrase files line by line. Explain what the code does
  *as a system*, what is non-obvious, what breaks if it changes.
- Link pages with relative markdown links, e.g. `[client](../modules/client.md)`.
  Every page must be reachable from `index.md`.
- When new information contradicts a page, do not silently overwrite: fix the
  page and add a `> **Changed YYYY-MM-DD:** was X, now Y (reason)` note, or, if
  the situation is genuinely unresolved, add an "Open questions" section.
- Rewrite summaries instead of appending to them, so pages stay readable.
- Prefer extending an existing page over creating a near-duplicate.

## index.md

A catalog grouped by page type. One line per page:
`- [Title](path) - one-line summary (status)`. The agent rewrites it whenever it
adds, renames or removes a page. Answering a question starts by reading it.

## log.md

Append-only. Each entry starts with a greppable heading:

```
## [YYYY-MM-DD] init | first pass
## [YYYY-MM-DD] sync | a1b2c3d..e4f5a6b (12 files, 5 pages touched)
## [YYYY-MM-DD] ingest | raw/datasheet.pdf
## [YYYY-MM-DD] query | how does the handshake work (filed as concepts/handshake.md)
## [YYYY-MM-DD] lint | 3 stale, 1 orphan
```

followed by a few lines on what changed. Last entries: `grep "^## \[" .wiki/log.md | tail -5`.

## Workflows

### Start of a session
1. Read `.wiki/index.md`.
2. Compare `.wiki/.sync-state` with the project's `git rev-parse HEAD`. If they
   differ, tell the user the wiki is behind and offer `wiki-sync`. Do not sync
   without being asked unless the task depends on the stale pages.

### Query (answering a question about the project)
1. Read `index.md`, then the relevant pages. Prefer the wiki over re-reading
   the whole codebase, but check the cited source when the answer matters and
   the page is `stale` or old.
2. Answer with links to the pages used.
3. If the answer is a reusable synthesis (a comparison, a trace of a flow), file
   it as a page and log it. Chat history is not a knowledge base.

### Ingest (new material in `raw/` or a new topic)
1. Read the source. Discuss the key points with the user if they are present.
2. Create or update the pages it touches (often several), update `index.md`,
   append to `log.md`.

### Sync (project changed)
Handled by the `wiki-sync` skill: diff `.sync-state..HEAD`, map changed files to
pages, update them, bump `.sync-state`, commit the wiki.

### Lint
Handled by the `wiki-lint` skill. Read-only report; the agent fixes only what
the user approves.

### Committing the wiki
After any meaningful change, commit inside the wiki repo:
`git -C .wiki add -A && git -C .wiki commit -m "<type>: <summary>"`.
That history is how both the user and future sessions see what changed.

## Tooling notes

- `.wiki/` is excluded from the project repo, so `rg`/`grep` tools that honour
  ignore files skip it. Search it with `rg --no-ignore -n "pattern" .wiki/wiki`
  or read `index.md` first.
- Never write secrets, tokens, credentials or personal data into the wiki.

## Project-specific conventions

<!-- wiki-init fills this in after surveying the project: build commands, naming
     conventions, areas to document in depth, things to skip. -->
