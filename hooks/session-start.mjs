#!/usr/bin/env node
// llm-wiki SessionStart hook. Tells the agent which wiki this repo has and whether it is
// behind the code. Prints nothing when the repo has no wiki. Never fails the session.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch { return {}; }
}

function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 }).trim();
  } catch { return null; }
}

function behind(stateFile, root) {
  let last;
  try { last = fs.readFileSync(stateFile, "utf8").trim(); } catch { return ""; }
  if (!last || last === "none") return " It has not been synced to a commit yet.";
  const head = git(["rev-parse", "HEAD"], root);
  if (!head || head === last) return " It is synced to the current HEAD.";
  const n = git(["rev-list", "--count", `${last}..HEAD`], root);
  if (n === null) return ` Its last sync commit ${last.slice(0, 7)} is not an ancestor of HEAD (rebased or another branch).`;
  return ` It was last synced to ${last.slice(0, 7)}, which is ${n} commit(s) behind HEAD.`;
}

try {
  const input = readStdin();
  const cwd = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const root = git(["rev-parse", "--show-toplevel"], cwd) || cwd;
  const lines = [];

  const team = path.join(root, "docs", "wiki");
  if (fs.existsSync(path.join(team, "SCHEMA.md"))) {
    lines.push(
      "This repository has a shared team wiki (llm-wiki) in docs/wiki/. " +
        "Its contract is docs/wiki/SCHEMA.md and its catalog is docs/wiki/index.md; the schema asks agents to read both before working on the project." +
        behind(path.join(team, ".sync-state"), root) +
        " At the end of a task, pages affected by the branch are updated as described in the schema (skill: wiki-update). " +
        "Only the wiki maintainer runs wiki-sync on the default branch; index.md and .sync-state are never edited by hand."
    );
  }

  const personal = path.join(root, ".wiki");
  if (fs.existsSync(path.join(personal, "SCHEMA.md"))) {
    lines.push(
      "This repository has the user's personal wiki (llm-wiki) in .wiki/, a separate git repo excluded from the project repo. " +
        "Its contract is .wiki/SCHEMA.md and its catalog is .wiki/index.md; the schema asks agents to read both before working on the project. " +
        "Because .wiki/ is git-excluded, ignore-aware search skips it: search it with rg --no-ignore." +
        behind(path.join(personal, ".sync-state"), root) +
        " The wiki-sync skill brings it up to date. It is never committed to the project repo or referenced from team-shared files."
    );
  }

  if (lines.length) process.stdout.write(lines.join("\n\n") + "\n");
} catch {
  // Never block or break a session start.
}
process.exit(0);
