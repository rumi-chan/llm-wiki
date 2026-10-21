---
name: wiki-lint
description: Health-check the project wiki (personal `.wiki/` or team `docs/wiki/`) and report broken links, orphan pages, stale or unsourced claims, contradictions, duplicates, gaps and leaked secrets. Read-only; fixes only what the user approves. Use when the user asks to lint, audit, check or clean up the wiki, or periodically after several syncs.
---

# wiki-lint

Audit the wiki against its own `SCHEMA.md`. **Read-only by default**: produce a report, then fix
only the items the user approves. Keep the report short and ordered by severity.

## 1. Load

Find the wiki: `docs/wiki/SCHEMA.md` (team mode) or `.wiki/SCHEMA.md` (personal mode). If both
exist, ask which one; if neither, suggest `wiki-init`.

Read the schema, `index.md`, and (personal mode) the last entries of `.wiki/log.md`. List every
page. `.wiki/` is git-excluded, so search it with `rg --no-ignore`.

## 2. Mechanical checks (exact, no judgement)

**Team mode:** run `node tools/wiki/wiki.mjs check` (full mode). It covers frontmatter, broken
links, missing source files, symbols that no longer exist, possible duplicates, orphans, a stale
`index.md` and secrets. Use its output; do not redo these by hand. Also check
`node tools/wiki/wiki.mjs build-index --check`.

**Personal mode:** check by hand:

1. Broken links: relative markdown links whose target file does not exist.
2. Orphans: pages not linked from `index.md`, and pages with no inbound link at all.
3. Index drift: index entries pointing at missing files, pages missing from the index.
4. Frontmatter: missing or invalid `title`, `type`, `status`, `updated`, `sources`; a `type`
   not defined in the schema.
5. Secrets: token, key, password or private-URL patterns in wiki and raw files. Report the
   location only, never echo the value.
6. Uncommitted wiki changes: `git -C .wiki status --short`.

Both modes: compare `.sync-state` with the project HEAD (team mode: the default branch) and
report how many commits behind the wiki is.

## 3. Staleness (use git)

For each page and each path in `sources`:

- Path no longer exists: page is **stale** (renamed or deleted).
- `git log -1 --format=%cs -- <path>` is newer than the page's `updated` date: page **may be
  stale**. Say which source changed.

Count `(unverified)` markers per page.

## 4. Judgement checks (read the pages)

1. **Contradictions** between pages (same fact, different value).
2. **Duplicates** the script cannot see: two pages about the same thing under unrelated names.
3. **Concepts without a page**: names that recur in 3+ pages with no page of their own.
4. **Overloaded pages**: a page that fails the "and" test and should be split.
5. **Thin pages**: pages that restate file names without explaining the system.
6. **Gaps**: up to three important areas of the project that no page covers.
7. **Convention drift**: pages that ignore the schema (language, citation format, team mode:
   one sentence per line, deterministic paths).

## 5. Report

Group as **Errors** (broken links, secrets, invalid frontmatter), **Stale** (with the changed
source), **Quality** (contradictions, duplicates, gaps, overloaded, thin), **Housekeeping**
(index, sync lag, uncommitted). Each item: page path and a one-line fix. Lead with a one-line
verdict and counts.

Personal mode: append `## [YYYY-MM-DD] lint | <counts>` to `.wiki/log.md` and commit it in the
wiki repo (the only write allowed without approval). Team mode: write nothing.

Then ask which fixes to apply. When many pages are stale, suggest `wiki-sync` instead of
patching by hand. Team mode: fixes go on a branch and through a PR, never straight to the
default branch.
