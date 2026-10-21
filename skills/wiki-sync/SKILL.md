---
name: wiki-sync
description: Bring the project wiki up to date with changes in the project's code since the last sync. Personal mode updates `.wiki/` after the user's own work or a git pull. Team mode is for the wiki maintainer (usually the team leader) - it syncs `docs/wiki/` on the default branch, fixes drift, merges duplicate pages, regenerates the index and opens a `wiki: sync` PR. Use when the user says to sync, update or refresh the wiki, after a git pull or merge, or when `.sync-state` differs from HEAD.
---

# wiki-sync

Read what changed in the project since the last sync (`.sync-state`) and update exactly the
pages affected.

## 0. Pick the mode

Find the project root (`git rev-parse --show-toplevel`).

- `docs/wiki/SCHEMA.md` exists and the user wants the team wiki synced: **team mode** (section T).
  Only the wiki maintainer does this. If the user is a member updating pages for their own
  branch, use `wiki-update` instead.
- `.wiki/SCHEMA.md` exists: **personal mode** (section P).
- Both exist and it is unclear: ask which one. Neither: suggest `wiki-init`.

Commands use `$LAST` / `$HEAD` as placeholders for SHAs. Substitute the values; quote
`"$LAST^{commit}"` in PowerShell.

---

## P. Personal mode (`.wiki/`)

### P1. Orient

1. Read `.wiki/SCHEMA.md`, `.wiki/index.md`, and the last entries of `.wiki/log.md`
   (`grep "^## \[" .wiki/log.md | tail -5`).
2. LAST = contents of `.wiki/.sync-state`, HEAD = `git rev-parse HEAD`.
   - Equal: the wiki is current. Mention uncommitted changes if `git status --short` shows any,
     and stop.
   - LAST is `none` or unreachable (`git cat-file -e "$LAST^{commit}"` fails, e.g. after a
     rebase): no usable diff. Check each page's `sources` against the current tree instead and
     tell the user it is a full re-check.

### P2. Find what changed

a. `git diff --name-status -M $LAST..$HEAD` and `git log --oneline $LAST..$HEAD` (commit
   messages explain intent).

b. Map changes to pages: a page covers a file if the path (or a parent directory) appears in
   its `sources`. `.wiki/` is git-excluded, so search it with
   `rg --no-ignore -l "<path>" .wiki/wiki`. Build three lists:
   - **Affected pages**: sources changed, renamed or deleted.
   - **Uncovered changes**: significant changed files no page cites (new modules, protocols,
     configs). Ignore lockfiles, generated code, formatting-only diffs.
   - **Unaffected**: leave untouched.

If the diff is large (more than about 50 files), work module by module, tell the user the
scope, and prioritise central pages.

### P3. Update

For each affected page: read it, the relevant diff (`git diff $LAST..$HEAD -- <path>`) and the
current source, then **revise the page** so it is true now:

- Rewrite sentences that are no longer correct; do not append "update:" tails.
- Fix `sources` for renamed files or symbols (`path` or `path#symbol`), set `updated:` and
  `status`.
- If the change reverses documented behaviour, keep a short
  `> **Changed YYYY-MM-DD:** was X, now Y (reason from commit message)` note.
- If a page's whole subject was deleted, mark it `status: stale` with a note, or remove it and
  fix links if the user prefers. Ask if unsure.

Create pages for significant uncovered changes and link them. Update `index.md`.

### P4. Close out

1. Append `## [YYYY-MM-DD] sync | <LAST short>..<HEAD short> (<n> files, <m> pages touched)` to
   `.wiki/log.md`, plus a few lines on what changed and what was skipped.
2. Overwrite `.wiki/.sync-state` with HEAD (full SHA, one line), only after the pages are
   updated, so an interrupted run is retried rather than skipped.
3. `git -C .wiki add -A && git -C .wiki commit -m "sync: <short>..<short>"`.
4. Tell the user what changed in a few lines. Mention uncommitted project work that was not
   included and offer to include it.

Never write to files tracked by the project in personal mode.

---

## T. Team mode (`docs/wiki/`, maintainer only)

### T1. Prepare a clean base

1. Read `docs/wiki/SCHEMA.md` (the rules) and `docs/wiki/index.md`.
2. If `git status --short` shows uncommitted changes, stop and ask the user how to proceed
   (do not stash or discard on your own).
3. Switch to the default branch (`git symbolic-ref --short refs/remotes/origin/HEAD`, usually
   `main`) and `git pull --ff-only`.
4. LAST = contents of `docs/wiki/.sync-state`, HEAD = `git rev-parse HEAD`. If equal and
   `node tools/wiki/wiki.mjs check` is clean, say the wiki is current and stop.
5. `git switch -c wiki/sync-<HEAD short>`.

### T2. Find the work

a. Code changes: `git diff --name-status -M $LAST..$HEAD -- . ":(exclude)docs/wiki"` and
   `git log --oneline $LAST..$HEAD`.

b. Pages authors already updated: `git diff --name-only $LAST..$HEAD -- docs/wiki`. For these,
   **verify** against the current code and fix only what is wrong. Do not rewrite them.

c. Mechanical findings: `node tools/wiki/wiki.mjs check` (full mode) lists missing sources,
   symbols that no longer exist, possible duplicates, orphans, broken links and frontmatter
   errors.

d. Map code changes to pages through `sources` (`rg -l "<path>" docs/wiki`). As in personal
   mode, build the lists of affected pages and significant uncovered changes.

### T3. Update

- Affected pages that authors did not update: revise per the schema. **Minimal edits**, one
  sentence per line, never restyle untouched text (it creates conflicts for everyone).
- Significant uncovered changes: create pages at their deterministic paths (schema), after
  searching for an existing page by title and `aliases`.
- **Duplicates** (from the check or noticed while reading): keep the page at the correct
  deterministic path, merge the other's content into it, add the other's title to `aliases`,
  delete the duplicate, and fix every link to it (`rg -l "<old file name>" docs/wiki`).
- Pages whose subject was removed from the code: delete them and fix links, or mark them
  `status: stale` if the removal may be temporary.

### T4. Close out

1. `node tools/wiki/wiki.mjs build-index`.
2. `node tools/wiki/wiki.mjs check` until it reports 0 errors and no warnings you can fix.
   Report the rest.
3. Overwrite `docs/wiki/.sync-state` with the HEAD from T1 (full SHA, one line).
4. Commit on the sync branch: `wiki: sync <LAST short>..<HEAD short>`, with a body listing pages
   updated, created, merged and removed. Ask before committing if the user is present.
5. Offer to push the branch and open a PR (`gh pr create --title "wiki: sync ..." --body ...`).
   **Never push the sync straight to the default branch.**
6. Tell the user, in a few lines: what changed, which PRs' drift was fixed, what is left.

No `log.md` in team mode: the git history of `docs/wiki/` is the log. Never put secrets in the wiki.
