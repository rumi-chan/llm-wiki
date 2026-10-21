---
name: wiki-update
description: Update the shared team wiki in `docs/wiki/` for the changes on the current branch, before opening a PR. For team members (not the maintainer) - edits only the pages affected by this branch, never index.md or .sync-state. Use when the user says update the wiki for my change, document this change in the wiki, or at the end of a task in a repo that has `docs/wiki/SCHEMA.md`. For a personal `.wiki/`, use wiki-sync instead.
---

# wiki-update

Keep the team wiki true for **this branch's** changes, so the wiki edits travel in the same PR
as the code. Small, targeted edits only: the maintainer's `wiki-sync` handles everything else.

## 1. Preconditions

1. Project root: `git rev-parse --show-toplevel`. If `docs/wiki/SCHEMA.md` does not exist:
   if `.wiki/SCHEMA.md` exists, this is a personal wiki, so use `wiki-sync`; otherwise there is
   no wiki (suggest `wiki-init`). Stop.
2. Read `docs/wiki/SCHEMA.md` and `docs/wiki/index.md`.
3. Base branch: `git symbolic-ref --short refs/remotes/origin/HEAD` (e.g. `origin/main`), or ask.
   `git fetch origin` so the comparison is current. If the current branch *is* the default
   branch, say so: members should work on a feature branch (ask before continuing).

## 2. Find the pages to touch

1. `node tools/wiki/wiki.mjs check --base <base>` lists:
   - **drift**: pages that cite files changed in this branch but were not updated;
   - problems in wiki pages already changed in this branch.
2. Read the branch diff for context: `git diff <base>...HEAD --stat`, then the relevant hunks.
   Include uncommitted work only if the user asks.
3. Decide whether the branch adds something significant that no page covers (a new module
   directory, a new protocol, a design decision worth recording).

## 3. Edit

For each drifted page: read it and the changed code, then fix only the sentences that became
wrong or are missing. Follow the schema:

- Minimal edits. One sentence per line. Never reflow or restyle text you are not changing.
- Fix `sources` for renamed files or symbols (`path` or `path#symbol`), set `updated:`; set
  `status: draft` if you could not fully verify the page.

For a genuinely new topic: search first (`index.md`, `rg -i "<term>" docs/wiki` across titles
and `aliases`). Extend an existing page if one fits; otherwise create the page at its
deterministic path with full frontmatter (`title`, `type`, `status`, `summary`, `aliases`,
`sources`, `updated`) and link it from a related page.

**Never edit `docs/wiki/index.md` or `docs/wiki/.sync-state`.** A new page is missing from the
index until the maintainer's next sync; that is expected.

## 4. Check and hand back

1. Run `node tools/wiki/wiki.mjs check --base <base>` again. Fix all errors. Drift warnings for
   pages you touched should be gone; leftover warnings about pages you deliberately left alone
   are fine.
2. Do not commit unless the user asked you to commit; otherwise leave the wiki edits staged or
   unstaged with the code, the way the user normally works.
3. Tell the user in two or three lines which pages changed or were created, and anything you
   left for the maintainer.
