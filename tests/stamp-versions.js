// stamp-versions.js - version markers on every local script and style reference (prompt BG, October 10, 2026).
//
// WHY: the site is served by GitHub Pages with Cache-Control: max-age=600 and no version in any file name, so a changed script could be served from a browser's cache for up to ten minutes after a push and the
// person had to hard refresh. A reference such as  <script type="module" src="js/pages/edit.js?v=3fa9c1d2">  names the exact content: when the content changes the reference changes, so the browser asks again.
//
// WHAT IS STAMPED (everything local, nothing external):
//   * every <script src> and every <link rel="stylesheet" href> in the site's pages that names a file of this repository;
//   * every local module import inside js/ (import ... from "./x.js", import "./x.js", export ... from "./x.js", and import("./x.js")), because a page's script is only the first file the browser loads: its imports
//     would otherwise still come from the cache.
// THE MARKER: ?v= followed by 8 hex digits of a SHA-256. For a style sheet or a vendor file it is the hash of its bytes. For a module of js/ it is the hash of its text (every marker inside it removed first, so a
// marker never changes its own hash) together with the markers of the modules it imports, so a change in a deep module changes the marker of every module above it and of every page that loads one of them. Modules
// that import each other in a circle share one marker (the hash of the whole circle).
// IDEMPOTENT: running it again on a stamped tree changes nothing. Run:  node tests/stamp-versions.js            (stamps and lists the files it changed)
//                                                                      node tests/stamp-versions.js --check    (changes nothing; exit 1 and a list when a marker is missing or stale)
// It runs by itself before every commit (.githooks/pre-commit, installed with: git config core.hooksPath .githooks) and rule S75 of tests/site-check.js fails the build when a marker is missing or stale.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const MARKER_RE = /\?v=[0-9a-f]{8}(?=["'`])/g;                       // a marker, as it appears at the end of a quoted reference
export const stripMarkers = (text) => String(text).replace(MARKER_RE, "");
const hash8 = (data) => crypto.createHash("sha256").update(data).digest("hex").slice(0, 8);
const toPosix = (p) => p.split(path.sep).join("/");

// the module specifier forms (relative only)
const SPEC_RES = [
  /(\bfrom\s*)(["'])(\.{1,2}\/[^"']+)\2/g,                                   // import x from "./a.js"   export { x } from "./a.js"
  /(\bimport\s*)(["'])(\.{1,2}\/[^"']+)\2/g,                                 // import "./a.js"
  /(\bimport\(\s*)(["'])(\.{1,2}\/[^"']+)\2/g,                               // import("./a.js")
];
const withoutQuery = (spec) => spec.split("?")[0].split("#")[0];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", "tests", "scripts", ".githooks"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// the module files that carry imports we stamp: everything under js/ that is a .js file
const isModule = (root, f) => f.endsWith(".js") && toPosix(path.relative(root, f)).startsWith("js/");

// -> { expected: Map(absolute path -> 8 hex), modules: [paths], htmls: [paths] }
export function computeVersions(root) {
  const all = walk(root);
  const modules = all.filter((f) => isModule(root, f));
  const htmls = all.filter((f) => f.endsWith(".html"));
  const text = new Map(), deps = new Map();
  for (const f of modules) {
    const t = stripMarkers(fs.readFileSync(f, "utf8"));
    text.set(f, t);
    const d = new Set();
    for (const re of SPEC_RES) for (const m of t.matchAll(re)) {
      const target = path.resolve(path.dirname(f), withoutQuery(m[3]));
      if (fs.existsSync(target) && fs.statSync(target).isFile()) d.add(target);
    }
    deps.set(f, [...d].sort());
  }
  // strongly connected components (Tarjan): a circle of modules gets one marker
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [], comp = new Map(), comps = [];
  let counter = 0;
  const visit = (v) => {
    index.set(v, counter); low.set(v, counter); counter++; stack.push(v); onStack.add(v);
    for (const w of deps.get(v) || []) {
      if (!deps.has(w)) continue;                                          // a leaf outside js/ (vendor, data, style): not part of the graph
      if (!index.has(w)) { visit(w); low.set(v, Math.min(low.get(v), low.get(w))); } else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
    }
    if (low.get(v) === index.get(v)) {
      const members = []; let w;
      do { w = stack.pop(); onStack.delete(w); comp.set(w, comps.length); members.push(w); } while (w !== v);
      comps.push(members.sort());
    }
  };
  for (const f of modules) if (!index.has(f)) visit(f);
  const leafVersion = new Map();
  const leaf = (p) => { if (!leafVersion.has(p)) leafVersion.set(p, hash8(fs.readFileSync(p))); return leafVersion.get(p); };
  const compVersion = new Array(comps.length);
  const compFor = (i) => {
    if (compVersion[i]) return compVersion[i];
    const members = comps[i], set = new Set(members), parts = [];
    for (const m of members) parts.push("M|" + toPosix(path.relative(root, m)) + "|" + text.get(m));
    const ext = new Set();
    for (const m of members) for (const w of deps.get(m)) if (!set.has(w)) ext.add(w);
    for (const w of [...ext].sort()) parts.push("D|" + toPosix(path.relative(root, w)) + "|" + (deps.has(w) ? compFor(comp.get(w)) : leaf(w)));
    return (compVersion[i] = hash8(parts.join("\n")));
  };
  const expected = new Map();
  for (const f of modules) expected.set(f, compFor(comp.get(f)));
  const versionOf = (p) => (expected.has(p) ? expected.get(p) : leaf(p));
  return { expected, modules, htmls, versionOf, text };
}

// the new text of a module: every local specifier carries its target's marker
function stampModule(file, versions) {
  const raw = fs.readFileSync(file, "utf8");
  let out = stripMarkers(raw);
  for (const re of SPEC_RES) {
    out = out.replace(re, (whole, lead, q, spec) => {
      const target = path.resolve(path.dirname(file), withoutQuery(spec));
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return whole;
      return lead + q + withoutQuery(spec) + "?v=" + versions.versionOf(target) + q;
    });
  }
  return { raw, out };
}

// the new text of a page: every local script src and stylesheet href carries its target's marker
const TAG_RE = /<(script|link)\b[^>]*>/gi;
function stampHtml(file, root, versions) {
  const raw = fs.readFileSync(file, "utf8");
  const out = stripMarkers(raw).replace(TAG_RE, (tag, name) => {
    const isScript = name.toLowerCase() === "script";
    if (!isScript && !/\brel\s*=\s*["']stylesheet["']/i.test(tag)) return tag;
    const attr = isScript ? "src" : "href";
    return tag.replace(new RegExp("(\\b" + attr + "\\s*=\\s*)([\"'])([^\"']+)\\2"), (whole, lead, q, ref) => {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) return whole;       // external, mailto, fragment
      const target = ref.startsWith("/") ? path.join(root, withoutQuery(ref)) : path.resolve(path.dirname(file), withoutQuery(ref));
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return whole;
      return lead + q + withoutQuery(ref) + "?v=" + versions.versionOf(target) + q;
    });
  });
  return { raw, out };
}

// every file whose text must change (or, in check mode, is stale): -> [{ file, rel, out }]
export function plan(root) {
  const versions = computeVersions(root), changes = [];
  for (const f of versions.modules) { const { raw, out } = stampModule(f, versions); if (raw !== out) changes.push({ file: f, rel: toPosix(path.relative(root, f)), out }); }
  for (const f of versions.htmls) { const { raw, out } = stampHtml(f, root, versions); if (raw !== out) changes.push({ file: f, rel: toPosix(path.relative(root, f)), out }); }
  return { changes, versions };
}

export function stamp(root) {
  const { changes } = plan(root);
  for (const c of changes) fs.writeFileSync(c.file, c.out);
  return changes.map((c) => c.rel);
}

// the references that are missing a marker or carry a stale one, for the static rule: -> [{ rel, message }]
const REF_RE = /(?:\b(?:src|href)\s*=\s*"([^"]+)")|(?:\b(?:from|import\()\s*["'](\.{1,2}\/[^"']+)["'])|(?:\bimport\s*["'](\.{1,2}\/[^"']+)["'])/g;
export function problems(root) {
  const { changes } = plan(root), out = [];
  for (const c of changes) {
    const raw = fs.readFileSync(c.file, "utf8");
    const refs = (s) => [...s.matchAll(REF_RE)].map((m) => m[1] || m[2] || m[3]);
    const before = refs(raw), after = refs(c.out);
    let any = false;
    for (let k = 0; k < after.length; k++) {
      if (before[k] === after[k]) continue;
      any = true;
      out.push({ rel: c.rel, message: (/\?v=[0-9a-f]{8}$/.test(String(before[k])) ? "stale marker: " : "no marker: ") + String(before[k]) + " (expected " + after[k] + ")" });
    }
    if (!any) out.push({ rel: c.rel, message: "markers are not current" });
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  if (process.argv.includes("--check")) {
    const p = problems(root);
    if (p.length === 0) { console.log("stamp-versions: every local script, style and import carries a current marker"); process.exit(0); }
    for (const x of p) console.log("STALE " + x.rel + ": " + x.message);
    console.log("stamp-versions: " + p.length + " reference(s) need a marker. Run: node tests/stamp-versions.js");
    process.exit(1);
  }
  const changed = stamp(root);
  console.log(changed.length === 0 ? "stamp-versions: nothing to change" : "stamp-versions: stamped " + changed.length + " file(s):\n  " + changed.join("\n  "));
}
