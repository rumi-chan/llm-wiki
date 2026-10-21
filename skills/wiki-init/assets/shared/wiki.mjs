#!/usr/bin/env node
// llm-wiki team tooling. No dependencies, Node 18+. No LLM calls.
//
//   node tools/wiki/wiki.mjs build-index            regenerate docs/wiki/index.md
//   node tools/wiki/wiki.mjs build-index --check    exit 1 if index.md is out of date
//   node tools/wiki/wiki.mjs check                  full check of the whole wiki
//   node tools/wiki/wiki.mjs check --base origin/main
//        PR mode: only pages changed since the merge base, plus "drift": pages that cite
//        files changed in this branch but were not updated in it.
//
// Options: --dir <wiki dir> (default docs/wiki), --format text|github,
//          --report <file> (write a markdown report, used for the PR comment).
// Exit code: 1 if there are errors (broken links, invalid frontmatter, secrets), else 0.
// Warnings (drift, possible duplicates, stale sources) never fail the run.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const flag = (name) => argv.includes(name);

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

let ROOT = process.cwd();
try {
  ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
} catch { /* not a git repo: use cwd */ }

const WIKI_REL = opt("--dir", "docs/wiki").replace(/\\/g, "/").replace(/\/+$/, "");
const WIKI = path.join(ROOT, WIKI_REL);
const SPECIAL = new Set(["SCHEMA.md", "index.md", "README.md"]);
const posix = (p) => p.split(path.sep).join("/");
const relRoot = (abs) => posix(path.relative(ROOT, abs));

const DEFAULT_CONFIG = {
  types: ["overview", "module", "concept", "decision"],
  statuses: ["draft", "verified", "stale"],
  required: ["title", "type", "status", "summary", "sources"],
};

function loadConfig() {
  const p = path.join(WIKI, "wiki.config.json");
  if (!fs.existsSync(p)) return DEFAULT_CONFIG;
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(p, "utf8")) };
  } catch (e) {
    console.error(`warning: cannot parse ${relRoot(p)}: ${e.message}; using defaults`);
    return DEFAULT_CONFIG;
  }
}

// ---------- reading pages ----------

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && ent.name.endsWith(".md")) out.push(p);
  }
  return out;
}

const unquote = (s) => {
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
};

// Minimal YAML subset: `key: value`, `key: [a, b]`, and `key:` followed by `- item` lines.
function parseFrontmatter(text) {
  if (!text.startsWith("---\n")) return { ok: false, error: "missing frontmatter (file must start with ---)", data: {}, bodyStart: 0 };
  const end = text.indexOf("\n---", 4);
  if (end < 0) return { ok: false, error: "frontmatter is not closed with ---", data: {}, bodyStart: 0 };
  const lines = text.slice(4, end).split("\n");
  const data = {};
  let key = null;
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const item = raw.match(/^\s+-\s*(.*)$/) || raw.match(/^-\s+(.*)$/);
    if (item && key) {
      if (!Array.isArray(data[key])) data[key] = [];
      data[key].push(unquote(item[1].replace(/\s+#.*$/, "")));
      continue;
    }
    const kv = raw.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    key = kv[1];
    const v = kv[2].trim();
    if (v === "") data[key] = [];
    else if (v.startsWith("[") && v.endsWith("]")) data[key] = v.slice(1, -1).split(",").map(unquote).filter(Boolean);
    else data[key] = unquote(v);
  }
  const bodyStart = text.indexOf("\n", end + 1) + 1 || text.length;
  return { ok: true, data, bodyStart };
}

function lineOf(text, index) {
  let n = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === "\n") n++;
  return n;
}

function loadPages() {
  const files = walk(WIKI).filter((f) => !(path.dirname(f) === WIKI && SPECIAL.has(path.basename(f))));
  return files.map((abs) => {
    const text = fs.readFileSync(abs, "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
    const fm = parseFrontmatter(text);
    return { abs, rel: relRoot(abs), wikiRel: posix(path.relative(WIKI, abs)), text, fm, data: fm.data };
  });
}

// ---------- build-index ----------

function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renderIndex(pages, config) {
  const groups = new Map();
  for (const p of pages) {
    const type = p.fm.ok && typeof p.data.type === "string" && p.data.type ? p.data.type : "unsorted";
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(p);
  }
  const order = [...config.types, ...[...groups.keys()].filter((t) => !config.types.includes(t) && t !== "unsorted").sort(), "unsorted"];
  const out = [
    "# Wiki index",
    "",
    "<!-- Generated by `node tools/wiki/wiki.mjs build-index`. Do not edit by hand:",
    "     on a merge conflict take either side, then regenerate. -->",
    "",
  ];
  for (const type of order) {
    const list = groups.get(type);
    if (!list || !list.length) continue;
    out.push(`## ${titleCase(type)}`, "");
    list.sort((a, b) => String(a.data.title || a.wikiRel).localeCompare(String(b.data.title || b.wikiRel), "en"));
    for (const p of list) {
      const title = typeof p.data.title === "string" && p.data.title ? p.data.title : p.wikiRel;
      const summary = typeof p.data.summary === "string" && p.data.summary ? ` - ${p.data.summary}` : "";
      const status = typeof p.data.status === "string" && p.data.status ? ` (${p.data.status})` : "";
      out.push(`- [${title}](${p.wikiRel})${summary}${status}`);
    }
    out.push("");
  }
  if (!pages.length) out.push("_No pages yet._", "");
  return out.join("\n");
}

function buildIndex() {
  const config = loadConfig();
  const want = renderIndex(loadPages(), config);
  const p = path.join(WIKI, "index.md");
  const have = fs.existsSync(p) ? fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n") : null;
  if (flag("--check")) {
    if (have === want) { console.log("index.md is up to date"); return 0; }
    console.log("index.md is out of date: run `node tools/wiki/wiki.mjs build-index`");
    return 1;
  }
  if (have === want) { console.log("index.md unchanged"); return 0; }
  fs.writeFileSync(p, want);
  console.log(`wrote ${relRoot(p)}`);
  return 0;
}

// ---------- check ----------

const SECRET_PATTERNS = [
  { re: /AKIA[0-9A-Z]{16}/, what: "AWS access key", level: "error" },
  { re: /\bgh[pousr]_[A-Za-z0-9]{36,}/, what: "GitHub token", level: "error" },
  { re: /\bgithub_pat_[A-Za-z0-9_]{40,}/, what: "GitHub token", level: "error" },
  { re: /\bsk-[A-Za-z0-9_-]{20,}/, what: "API key (sk-...)", level: "error" },
  { re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/, what: "Slack token", level: "error" },
  { re: /\bAIza[0-9A-Za-z_-]{35}/, what: "Google API key", level: "error" },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, what: "private key", level: "error" },
  {
    re: /\b(password|passwd|secret|api[_-]?key|access[_-]?token)\b\s*[:=]\s*["']?(?![$<{(]|process\.env|os\.environ|env\.)[^\s"'`]{8,}/i,
    what: "possible hard-coded credential",
    level: "warning",
  },
];

function normName(s) {
  let n = String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (n.length > 4 && n.endsWith("s")) n = n.slice(0, -1);
  return n;
}

function similarity(a, b) {
  if (a === b) return 1;
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

function stripCode(text) {
  // Blank out fenced blocks and inline code, keeping offsets so line numbers stay right.
  return text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));
}

function parseSource(s) {
  const str = String(s).trim();
  if (/^[a-z]+:\/\//i.test(str)) return { url: str };
  const hash = str.indexOf("#");
  return hash >= 0 ? { file: str.slice(0, hash), symbol: str.slice(hash + 1) } : { file: str };
}

function check() {
  const config = loadConfig();
  const base = opt("--base", null);
  const findings = [];
  const add = (level, file, line, msg) => findings.push({ level, file, line, msg });

  if (!fs.existsSync(path.join(WIKI, "SCHEMA.md"))) {
    console.error(`no ${WIKI_REL}/SCHEMA.md found under ${ROOT}`);
    return 2;
  }
  const pages = loadPages();
  const byAbs = new Map(pages.map((p) => [path.resolve(p.abs), p]));

  // Files changed on this branch (PR mode).
  let changed = null; // Map<relPath, status>
  if (base) {
    try {
      const out = git(["diff", "--name-status", "-M", `${base}...HEAD`]);
      changed = new Map();
      for (const line of out.split("\n").filter(Boolean)) {
        const parts = line.split("\t");
        const status = parts[0][0];
        if (status === "R" || status === "C") { changed.set(parts[1], "D"); changed.set(parts[2], "A"); }
        else changed.set(parts[1], status);
      }
    } catch (e) {
      add("warning", WIKI_REL, 0, `could not diff against ${base}: ${String(e.stderr || e.message).trim().split("\n")[0]}`);
    }
  }
  const inScope = (p) => !changed || changed.has(p.rel);
  const fileCache = new Map();
  const readFile = (abs) => {
    if (!fileCache.has(abs)) {
      try { fileCache.set(abs, fs.readFileSync(abs, "utf8")); } catch { fileCache.set(abs, null); }
    }
    return fileCache.get(abs);
  };

  const inbound = new Map(pages.map((p) => [p.abs, 0]));

  for (const p of pages) {
    const scoped = inScope(p);
    // Frontmatter
    if (!p.fm.ok) {
      if (scoped) add("error", p.rel, 1, p.fm.error);
    } else if (scoped) {
      for (const k of config.required) {
        const v = p.data[k];
        if (v === undefined || (typeof v === "string" && !v)) add("error", p.rel, 1, `frontmatter is missing \`${k}\``);
      }
      if (p.data.type && !config.types.includes(p.data.type))
        add("warning", p.rel, 1, `type \`${p.data.type}\` is not listed in wiki.config.json (${config.types.join(", ")})`);
      if (p.data.status && !config.statuses.includes(p.data.status))
        add("error", p.rel, 1, `status must be one of ${config.statuses.join(", ")}`);
      if (p.data.sources !== undefined && !Array.isArray(p.data.sources))
        add("error", p.rel, 1, "`sources` must be a list");
    }

    // Links (always counted for orphan detection, reported only in scope)
    const body = stripCode(p.text);
    const linkRe = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    let m;
    while ((m = linkRe.exec(body))) {
      let target = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
      target = target.split("#")[0].split("?")[0];
      if (!target) continue;
      try { target = decodeURI(target); } catch { /* keep raw */ }
      const abs = path.resolve(target.startsWith("/") ? path.join(ROOT, target) : path.join(path.dirname(p.abs), target));
      if (!fs.existsSync(abs)) {
        if (scoped) add("error", p.rel, lineOf(p.text, m.index), `broken link: ${m[1]}`);
      } else if (byAbs.has(abs) && abs !== path.resolve(p.abs)) {
        inbound.set(byAbs.get(abs).abs, inbound.get(byAbs.get(abs).abs) + 1);
      }
    }

    // Sources
    if (scoped && p.fm.ok && Array.isArray(p.data.sources)) {
      for (const s of p.data.sources) {
        const src = parseSource(s);
        if (src.url) continue;
        if (/:\d+(-\d+)?$/.test(src.file) || /@[0-9a-f]{7,40}$/.test(src.file) || /@[0-9a-f]{7,40}$/.test(src.symbol || ""))
          add("warning", p.rel, 1, `source \`${s}\`: cite \`path\` or \`path#symbol\`, not line numbers or commit hashes`);
        const fileAbs = path.join(ROOT, src.file.replace(/:\d+(-\d+)?$/, "").replace(/@[0-9a-f]{7,40}$/, ""));
        if (!fs.existsSync(fileAbs)) { add("warning", p.rel, 1, `source \`${src.file}\` does not exist (renamed or deleted?): page may be stale`); continue; }
        if (src.symbol && fs.statSync(fileAbs).isFile()) {
          const content = readFile(fileAbs);
          if (content !== null && !content.includes(src.symbol))
            add("warning", p.rel, 1, `symbol \`${src.symbol}\` not found in \`${src.file}\`: page may be stale`);
        }
      }
    }

    // Secrets
    if (scoped) {
      p.text.split("\n").forEach((line, i) => {
        for (const pat of SECRET_PATTERNS) if (pat.re.test(line)) add(pat.level, p.rel, i + 1, `${pat.what} in wiki text: remove it (value not shown)`);
      });
    }
  }

  // Duplicates: same normalized slug/title/alias on two pages (warning), or very similar titles.
  const keys = new Map();
  for (const p of pages) {
    const names = [path.basename(p.abs, ".md"), p.data.title, ...(Array.isArray(p.data.aliases) ? p.data.aliases : [])].filter(Boolean);
    for (const n of new Set(names.map(normName).filter((n) => n.length >= 3))) {
      if (!keys.has(n)) keys.set(n, new Set());
      keys.get(n).add(p);
    }
  }
  const reported = new Set();
  for (const [key, set] of keys) {
    if (set.size < 2) continue;
    const list = [...set];
    if (changed && !list.some(inScope)) continue;
    const id = list.map((p) => p.rel).sort().join("|");
    if (reported.has(id)) continue;
    reported.add(id);
    const target = list.find(inScope) || list[0];
    add("warning", target.rel, 1, `possible duplicate pages (same name/alias "${key}"): ${list.map((p) => p.rel).join(", ")}`);
  }
  const titled = pages.filter((p) => typeof p.data.title === "string").map((p) => ({ p, n: normName(p.data.title) }));
  for (let i = 0; i < titled.length; i++) {
    for (let j = i + 1; j < titled.length; j++) {
      const a = titled[i], b = titled[j];
      if (a.n === b.n || Math.min(a.n.length, b.n.length) < 5) continue;
      if (changed && !inScope(a.p) && !inScope(b.p)) continue;
      const id = [a.p.rel, b.p.rel].sort().join("|");
      if (reported.has(id)) continue;
      if (similarity(a.n, b.n) >= 0.85) {
        reported.add(id);
        add("warning", (inScope(a.p) ? a.p : b.p).rel, 1, `possible duplicate pages (similar titles): ${a.p.rel}, ${b.p.rel}`);
      }
    }
  }

  // Drift (PR mode): pages citing files changed here that were not updated here.
  if (changed) {
    const codeChanges = [...changed].filter(([f]) => !f.startsWith(WIKI_REL + "/"));
    for (const p of pages) {
      if (!p.fm.ok || !Array.isArray(p.data.sources) || changed.has(p.rel)) continue;
      const hits = [];
      for (const s of p.data.sources) {
        const src = parseSource(s);
        if (src.url || !src.file) continue;
        const f = src.file.replace(/\/+$/, "");
        for (const [c, st] of codeChanges) if (c === f || c.startsWith(f + "/")) hits.push(st === "D" ? `${c} (deleted)` : c);
      }
      if (hits.length)
        add("warning", p.rel, 1, `cites files changed in this branch but was not updated: ${[...new Set(hits)].join(", ")}`);
    }
  }

  // Full mode only: orphans and index freshness.
  if (!changed) {
    for (const p of pages) {
      if (p.data.type === "overview") continue;
      if (inbound.get(p.abs) === 0) add("warning", p.rel, 1, "orphan: no other page links here");
    }
    const idx = path.join(WIKI, "index.md");
    const have = fs.existsSync(idx) ? fs.readFileSync(idx, "utf8").replace(/\r\n/g, "\n") : null;
    if (have !== renderIndex(pages, config)) add("warning", `${WIKI_REL}/index.md`, 1, "index.md is out of date: run `node tools/wiki/wiki.mjs build-index`");
  }

  report(findings, { base, pageCount: pages.length });
  return findings.some((f) => f.level === "error") ? 1 : 0;
}

function report(findings, { base, pageCount }) {
  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warning");
  const format = opt("--format", "text");
  const esc = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

  if (format === "github") {
    for (const f of findings) {
      const loc = f.line ? `file=${f.file},line=${f.line}` : `file=${f.file}`;
      console.log(`::${f.level} ${loc}::${esc(f.msg)}`);
    }
  }
  const scope = base ? `changes since \`${base}\`` : `all ${pageCount} pages`;
  console.log(`wiki check (${scope}): ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (format !== "github") for (const f of [...errors, ...warnings]) console.log(`${f.level.padEnd(7)} ${f.file}${f.line ? ":" + f.line : ""}  ${f.msg}`);

  const md = ["<!-- llm-wiki-check -->", "### Wiki check", ""];
  if (!findings.length) md.push(`✅ No wiki issues (${scope}).`);
  else {
    md.push(`Checked ${scope}: **${errors.length} error(s)**, **${warnings.length} warning(s)**.`, "");
    const section = (title, list) => {
      if (!list.length) return;
      md.push(`**${title}**`, "");
      for (const f of list) md.push(`- \`${f.file}${f.line ? ":" + f.line : ""}\` ${f.msg}`);
      md.push("");
    };
    section("Errors", errors);
    section("Warnings", warnings);
    md.push(
      "_Warnings never block merging. Pages that drifted from the code are fixed in the next `wiki-sync` by the wiki maintainer, " +
        "or by your agent with `wiki-update`. Merge conflicts inside the wiki: take either side, the next sync fixes it._"
    );
  }
  const text = md.join("\n") + "\n";
  const out = opt("--report", null);
  if (out) fs.writeFileSync(out, text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
}

// ---------- main ----------

let code;
if (cmd === "build-index") code = buildIndex();
else if (cmd === "check") code = check();
else {
  console.log("usage: node tools/wiki/wiki.mjs build-index [--check] | check [--base <ref>] [--format text|github] [--report <file>] [--dir <wiki dir>]");
  code = cmd ? 2 : 0;
}
process.exit(code);
