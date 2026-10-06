// indexing.test.js - search engines and the stage site (October 6, 2026). No browser, no real project, no key: it serves the repo's own files with the fake site (tests/fake-site.js) and reads them over HTTP, the way a crawler would.
// 1. Every page the site serves says noindex, nofollow, and robots.txt disallows everything, while ALLOW_INDEXING in js/config.js is false (the stage setting, pinned here: switching it on for production is a deliberate edit of this test too).
// 2. The pages that need a sign-in or show a person's own data say noindex, nofollow whatever the flag says. Only index.html and privacy.html may ever be indexable.
// 3. The tool tests/apply-indexing.js: with the flag true it makes exactly robots.txt, index.html and privacy.html indexable and touches nothing else; with the flag false again every file is byte for byte as before; run twice it changes nothing.
// Then negative controls: one defect at a time on a copy of the repo, each must make a check fail. Run: node --test tests/indexing.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startFakeSite } from "./fake-site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = ["index.html", "privacy.html"];   // the only pages that may ever be indexable (written out here on purpose, apart from the tool's own list)
const NOINDEX = '<meta name="robots" content="noindex, nofollow">', INDEXABLE = '<meta name="robots" content="index, follow">';
const SKIP = (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src);
const flagOf = (root) => { const m = fs.readFileSync(path.join(root, "js", "config.js"), "utf8").match(/^export const ALLOW_INDEXING = (true|false);/m); return m ? m[1] === "true" : null; };
const copyRepo = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-idx-")); fs.cpSync(ROOT, dir, { recursive: true, filter: SKIP }); return dir; };
const walk = (dir, base = dir, out = {}) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== ".git" && e.name !== "node_modules") walk(p, base, out); } else out[path.relative(base, p).split(path.sep).join("/")] = fs.readFileSync(p); } return out; };
let importCount = 0;
const loadTool = (root) => import(pathToFileURL(path.join(root, "tests", "apply-indexing.js")).href + "?n=" + (++importCount));

// what a crawler sees: every .html file of the folder fetched over HTTP, the robots.txt, and an address that does not exist
async function audit(root) {
  const bad = [], flag = flagOf(root), site = await startFakeSite(root);
  try {
    if (flag === null) bad.push("js/config.js has no line  export const ALLOW_INDEXING = false;  (or true)");
    const pages = fs.readdirSync(root).filter((f) => f.endsWith(".html")).sort();
    if (pages.length < 12) bad.push("only " + pages.length + " pages found, expected at least 12");
    const tagOf = async (url) => { const r = await fetch(url); const t = await r.text(); const m = t.match(/<meta name="robots" content="([^"]*)">/g); return { status: r.status, tags: m || [] }; };
    for (const f of pages) {
      const { status, tags } = await tagOf(site.url + "/" + f);
      const want = PUBLIC.includes(f) && flag === true ? INDEXABLE : NOINDEX;
      if (!PUBLIC.includes(f) && tags.join("") !== NOINDEX) bad.push(f + " needs a sign-in or shows a person's own data and must say noindex, nofollow, it says: " + (tags.join(" ") || "nothing"));
      else if (PUBLIC.includes(f) && tags.join("") !== want) bad.push(f + " must carry exactly " + want + " while ALLOW_INDEXING is " + flag + ", it carries: " + (tags.join(" ") || "nothing"));
      if (status !== 200) bad.push(f + " answered " + status);
    }
    const nf = await tagOf(site.url + "/no-such-page-here.html");
    if (nf.tags.join("") !== NOINDEX) bad.push("an address that does not exist must answer with a noindex page, it carries: " + (nf.tags.join(" ") || "nothing"));
    const r = await fetch(site.url + "/robots.txt"), robots = r.status === 200 ? await r.text() : "";
    if (r.status !== 200) bad.push("robots.txt answered " + r.status);
    else if (flag === false && !/^User-agent: \*\r?\nDisallow: \/\r?\n?$/.test(robots)) bad.push("robots.txt must disallow everything while ALLOW_INDEXING is false, it says: " + JSON.stringify(robots));
    else if (flag === true && (/^Disallow: \/\s*$/m.test(robots) || !/^Allow: \/\s*$/m.test(robots))) bad.push("robots.txt must allow crawling while ALLOW_INDEXING is true, it says: " + JSON.stringify(robots));
  } finally { await site.close(); }
  return bad;
}

// the tool: flip the flag on a copy, apply, audit, flip back, apply, compare every byte
async function flip(root) {
  const bad = [], before = walk(root), cfg = path.join(root, "js", "config.js"), text = fs.readFileSync(cfg, "utf8");
  const tool = await loadTool(root);
  if (JSON.stringify(tool.applyIndexing(root)) !== "[]") bad.push("with the flag as shipped the tool changed files");
  fs.writeFileSync(cfg, text.replace("ALLOW_INDEXING = false;", "ALLOW_INDEXING = true;"));
  const on = tool.applyIndexing(root).sort();
  if (JSON.stringify(on) !== JSON.stringify(["index.html", "privacy.html", "robots.txt"])) bad.push("with the flag true the tool must change exactly index.html, privacy.html and robots.txt, it changed: " + on.join(", "));
  if (JSON.stringify(tool.applyIndexing(root)) !== "[]") bad.push("run a second time the tool changed files again");
  bad.push(...(await audit(root)).map((x) => "flag true: " + x));
  fs.writeFileSync(cfg, text);
  const off = tool.applyIndexing(root).sort();
  if (JSON.stringify(off) !== JSON.stringify(["index.html", "privacy.html", "robots.txt"])) bad.push("with the flag false again the tool must change exactly index.html, privacy.html and robots.txt back, it changed: " + off.join(", "));
  const after = walk(root);
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) if (!before[k] || !after[k] || Buffer.compare(before[k], after[k]) !== 0) bad.push(k + " is not byte for byte as before after switching on and off again");
  return bad;
}

test("every page and robots.txt keep search engines out on stage (flag false), as a crawler sees them", { timeout: 300000 }, async () => {
  assert.equal(flagOf(ROOT), false, "ALLOW_INDEXING ships false on stage (changing it for production is a deliberate edit of this test as well)");
  const bad = await audit(ROOT);
  assert.deepEqual(bad, [], "indexing problems:\n" + bad.join("\n"));
});

test("the tool switches the two public pages and robots.txt together with the flag, touches nothing else, and switches back exactly", { timeout: 300000 }, async () => {
  const dir = copyRepo();
  try { const bad = await flip(dir); assert.deepEqual(bad, [], "indexing tool problems:\n" + bad.join("\n")); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

const DEFECTS = [
  ["My postings loses its noindex tag", "audit", [["dashboard.html", (s) => s.replace(NOINDEX + "\n", "")]]],
  ["the search page says index, follow", "audit", [["search.html", (s) => s.replace(NOINDEX, INDEXABLE)]]],
  ["the page for an address that does not exist loses its noindex tag", "audit", [["404.html", (s) => s.replace(NOINDEX + "\n", "")]]],
  ["the sign-in landing page says index, follow", "audit", [["auth-callback.html", (s) => s.replace(NOINDEX, INDEXABLE)]]],
  ["robots.txt allows everything while the flag is false", "audit", [["robots.txt", () => "User-agent: *\nAllow: /\n"]]],
  ["robots.txt is empty", "audit", [["robots.txt", () => ""]]],
  ["the home page says index, follow while the flag is false", "audit", [["index.html", (s) => s.replace(NOINDEX, INDEXABLE)]]],
  ["the flag is switched on without running the tool", "audit", [["js/config.js", (s) => s.replace("ALLOW_INDEXING = false;", "ALLOW_INDEXING = true;")]]],
  ["the flag line is removed", "audit", [["js/config.js", (s) => s.replace("export const ALLOW_INDEXING = false;", "")]]],
  ["a new page is added without the tag", "audit", [["newpage.html", () => "<!doctype html><html><head><meta charset=\"utf-8\"><title>x</title></head><body>x</body></html>\n"]]],
  ["the tool treats My postings as a public page", "flip", [["tests/apply-indexing.js", (s) => s.replace('["index.html", "privacy.html"]', '["index.html", "privacy.html", "dashboard.html"]')]]],
  ["the tool does not rewrite robots.txt", "flip", [["tests/apply-indexing.js", (s) => s.replace('put("robots.txt", allow ? ROBOTS_ALLOW : ROBOTS_BLOCK_ALL);', "")]]],
  ["the tool never switches back to noindex", "flip", [["tests/apply-indexing.js", (s) => s.replace("allow ? INDEXABLE : NOINDEX", "INDEXABLE")]]],
  ["the tool also edits the search page", "flip", [["tests/apply-indexing.js", (s) => s.replace('["index.html", "privacy.html"]', '["index.html", "privacy.html", "search.html"]')]]],
];
test("negative controls: each defect in the indexing setup makes a check fail", { timeout: 900000 }, async () => {
  const missed = [];
  for (const [label, how, edits] of DEFECTS) {
    const dir = copyRepo();
    try {
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null, a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = how === "audit" ? await audit(dir) : await flip(dir);
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 150) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
