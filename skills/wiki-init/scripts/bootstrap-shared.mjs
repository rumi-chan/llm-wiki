#!/usr/bin/env node
// Mechanical part of `wiki-init` in TEAM mode. Creates the shared wiki skeleton in the
// project repo. Idempotent: never overwrites an existing file. Does not commit.
//
// Usage: node bootstrap-shared.mjs [--root <project-root>] [--language <lang>] [--agent-files]
//   --root         default: git toplevel of cwd
//   --language     default: English
//   --agent-files  also add a pointer block to CLAUDE.md and AGENTS.md at the repo root
//                  (team-shared files: only pass this after the user agreed)
//   --update-tools overwrite tools/wiki/wiki.mjs and .github/workflows/wiki.yml with this
//                  version (to upgrade an existing team wiki)
//
// Creates:
//   docs/wiki/{SCHEMA.md, README.md, wiki.config.json, index.md, .sync-state}
//   tools/wiki/wiki.mjs
//   .github/workflows/wiki.yml

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const flag = (name) => argv.includes(name);

const here = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(here, "..", "assets", "shared");

const git = (args, cwd) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

let root = opt("--root", "");
if (!root) {
  try { root = git(["rev-parse", "--show-toplevel"], process.cwd()); }
  catch { console.error("error: not inside a git repository (team mode needs one)"); process.exit(1); }
}
root = path.resolve(root);
try { git(["rev-parse", "--git-dir"], root); }
catch { console.error(`error: ${root} is not a git repository`); process.exit(1); }

const language = opt("--language", "English");
const project = path.basename(root);
const date = new Date().toISOString().slice(0, 10);
const render = (s) => s.split("{{PROJECT}}").join(project).split("{{LANGUAGE}}").join(language).split("{{DATE}}").join(date);

// --update-tools: refresh the check script and workflow from this llm-wiki version
// (they hold no project content). Everything else is never overwritten.
const TOOL_FILES = new Set(["tools/wiki/wiki.mjs", ".github/workflows/wiki.yml"]);
function write(rel, content) {
  const dest = path.join(root, rel);
  if (fs.existsSync(dest)) {
    if (!(flag("--update-tools") && TOOL_FILES.has(rel))) { console.log(`keep   ${rel} (exists)`); return; }
    if (fs.readFileSync(dest, "utf8") === content) { console.log(`keep   ${rel} (up to date)`); return; }
    fs.writeFileSync(dest, content);
    console.log(`update ${rel}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  console.log(`create ${rel}`);
}
const asset = (name) => fs.readFileSync(path.join(ASSETS, name), "utf8");

write("docs/wiki/SCHEMA.md", render(asset("SCHEMA.template.md")));
write("docs/wiki/README.md", render(asset("README.template.md")));
write("docs/wiki/wiki.config.json", asset("wiki.config.json"));
write("tools/wiki/wiki.mjs", asset("wiki.mjs"));
write(".github/workflows/wiki.yml", asset("wiki.yml"));

let head = "none";
try { head = git(["rev-parse", "HEAD"], root); } catch { /* no commits yet */ }
write("docs/wiki/.sync-state", head + "\n");

// Pointer block in the team's agent instruction files.
const BEGIN = "<!-- llm-wiki-team:begin -->";
const END = "<!-- llm-wiki-team:end -->";
function upsertBlock(rel, block) {
  const p = path.join(root, rel);
  const old = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  const eol = old.includes("\r\n") ? "\r\n" : "\n";
  const b = block.trim().split("\n").join(eol);
  let next;
  const start = old.indexOf(BEGIN), stop = old.indexOf(END);
  if (start >= 0 && stop > start) next = old.slice(0, start) + b + old.slice(stop + END.length);
  else next = (old.trimEnd() ? old.trimEnd() + eol + eol : "") + b + eol;
  if (next === old) { console.log(`keep   ${rel} (block present)`); return; }
  fs.writeFileSync(p, next);
  console.log(`${old ? "update" : "create"} ${rel} (wiki pointer block)`);
}
if (flag("--agent-files")) {
  const block = asset("team-hint.md");
  upsertBlock("CLAUDE.md", block);
  upsertBlock("AGENTS.md", block);
} else {
  console.log("note: CLAUDE.md / AGENTS.md not touched (pass --agent-files to add the wiki pointer)");
}

// Generate the first index (empty until pages are written).
execFileSync(process.execPath, [path.join(root, "tools/wiki/wiki.mjs"), "build-index"], { cwd: root, stdio: "inherit" });
console.log("done: docs/wiki/ (nothing committed)");
