# {{PROJECT}} wiki

This folder is the project's wiki: pages that explain how the code works, written and kept up to
date mostly by AI coding agents (Claude Code, Codex). Start at [index.md](index.md).

The pages are **derived from the code**. If a page and the code disagree, trust the code.

## Rules for the team

**If you do not use an AI agent:** you do not have to do anything. Read the pages if they help.
You may fix a page by hand; keep the block between the `---` lines at the top.

**If you use an AI agent:** it reads `SCHEMA.md` automatically (it is referenced from `CLAUDE.md`
and `AGENTS.md`). At the end of a task, ask it to update the wiki for your change
(`wiki-update` if you have the llm-wiki skills, or just "update the wiki for this branch as the
schema says"). The wiki edits go in the same PR as your code.

**Everyone:**

- Do not edit `index.md` by hand. It is generated.
- On a merge conflict inside `docs/wiki/`, **take either side**. The next sync fixes it. Never
  hold back a code merge because of a wiki conflict.
- Never put passwords, tokens or personal data in the wiki.

## What happens automatically

Every PR gets a "wiki" check. It comments when the PR changes code that a page describes but
does not update that page, or when a new page looks like a duplicate of an existing one.
These are **warnings and never block merging**. Errors (broken links, invalid page header,
something that looks like a secret) mark the check red but still do not block merging unless
the repo owner makes the check required.

## The wiki maintainer

The team leader runs the sync from time to time (for example at the end of a sprint): their
agent compares `main` with the last sync, fixes pages that drifted from the code, merges
duplicate pages, regenerates `index.md`, and opens a `wiki: sync` PR.
