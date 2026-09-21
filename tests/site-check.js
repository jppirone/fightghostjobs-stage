// site-check.js - static rules for the whole site. Run: node tests/site-check.js [rootDir]      (exit 1 on any finding)
// The site handles two kinds of session and shows text written by strangers (postings, comments), so these rules are enforced by a program, not by care:
//   S1  every page carries the one expected Content-Security-Policy (scripts only from this site; the only network destination is the project's own API)
//   S2  every page says noindex, nofollow
//   S3  no inline script, no inline event handler, no javascript: URL
//   S4  every <script> is a module from js/ and exists
//   S5  no way to turn text into HTML or code (innerHTML, outerHTML, insertAdjacentHTML, document.write, eval, new Function, string timers)
//   S6  every import resolves to a real file
//   S7  every local href / src / stylesheet exists
//   S8  no network address other than the project's API appears in code, markup or styles (no CDN, no analytics, no font host)
//   S9  no secret: no secret key, no token, no database URL; the publishable key appears only in js/config.js
//   S10 the vendored Auth client is byte-identical to the recorded hash
//   S11 every font file the stylesheet names exists; nothing is @imported
//   S12 links that open a new tab carry rel="noopener"
//   S13 styles.css is loaded before app.css on every page
//   S14 the empty-search note says closed or expired postings appear only by req code, and search.js uses that note
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const API_ORIGIN = "https://tpmvkjuhbbwftqoodzcn.supabase.co";
export const EXPECTED_CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src " + API_ORIGIN + "; base-uri 'self'; form-action 'self'; object-src 'none'";
export const EXPECTED_CSP_404 = "default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'";

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};
const stripJsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, "$1")).join("\n");

export function checkSite(root) {
  const findings = []; const add = (rule, file, msg) => findings.push({ rule, file: path.relative(root, file).replace(/\\/g, "/"), msg });
  const files = walk(root);
  const html = files.filter((f) => f.endsWith(".html")), js = files.filter((f) => f.endsWith(".js") && !f.includes(path.sep + "tests" + path.sep) && !f.includes(path.sep + "vendor" + path.sep)), css = files.filter((f) => f.endsWith(".css"));
  const mjs = files.filter((f) => f.endsWith(".mjs"));
  const read = (f) => fs.readFileSync(f, "utf8");

  for (const f of html) {
    const s = read(f); const name = path.basename(f);
    const csps = [...s.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/g)].map((m) => m[1]);
    if (csps.length !== 1) add("S1", f, "expected exactly one Content-Security-Policy meta, found " + csps.length);
    else if (csps[0] !== (name === "404.html" ? EXPECTED_CSP_404 : EXPECTED_CSP)) add("S1", f, "the Content-Security-Policy is not the expected one");
    if (!/<meta name="robots" content="noindex, nofollow">/.test(s)) add("S2", f, "missing noindex, nofollow");
    const scripts = [...s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    for (const m of scripts) {
      const attrs = m[1];
      if (!/\bsrc="/.test(attrs) || m[2].trim() !== "") add("S3", f, "inline <script>");
      else {
        const src = (attrs.match(/\bsrc="([^"]*)"/) || [])[1] || "";
        if (!/\btype="module"/.test(attrs) || !/^js\/[a-z0-9\/-]+\.js$/i.test(src)) add("S4", f, "script must be a module from js/: " + src);
        else if (!fs.existsSync(path.join(root, src))) add("S4", f, "script does not exist: " + src);
      }
    }
    if (/\son[a-z]+\s*=\s*["']/i.test(s.replace(/<script[\s\S]*?<\/script>/gi, ""))) add("S3", f, "inline event handler attribute");
    if (/\b(href|src|action)\s*=\s*["']\s*javascript:/i.test(s)) add("S3", f, "javascript: URL");
    if (/<a\b[^>]*target="_blank"(?![^>]*rel="[^"]*noopener)[^>]*>/i.test(s) || /<a\b(?![^>]*rel="[^"]*noopener)[^>]*target="_blank"[^>]*>/i.test(s)) add("S12", f, "target=_blank without rel=noopener");
    for (const m of s.matchAll(/\b(?:href|src)\s*=\s*"([^"]*)"/g)) {
      const u = m[1];
      if (u === "" || u.startsWith("#") || u.startsWith("mailto:")) continue;
      if (/^https?:\/\//i.test(u)) { if (!u.startsWith(API_ORIGIN)) add("S8", f, "external address in markup: " + u); continue; }
      const target = u.split("#")[0].split("?")[0];
      const p = target.startsWith("/") ? path.join(root, target) : path.join(path.dirname(f), target);
      if (!fs.existsSync(p)) add("S7", f, "broken local reference: " + u);
    }
    const ci = s.indexOf('href="styles.css"'), ca = s.indexOf('href="app.css"');
    if (name !== "404.html" && (ci < 0 || ca < 0 || ci > ca)) add("S13", f, "styles.css must be loaded, then app.css");
  }

  const importRe = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  for (const f of js.concat(mjs.filter((x) => !x.includes(path.sep + "vendor" + path.sep)))) {
    const raw = read(f), s = stripJsComments(raw);
    const bans = [[/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\b|createContextualFragment/, "S5", "a way to turn text into HTML"], [/\beval\s*\(|new\s+Function\b|\bFunction\s*\(/, "S5", "eval / Function"],
      [/setTimeout\s*\(\s*["'`]|setInterval\s*\(\s*["'`]/, "S5", "a string timer"], [/document\.cookie/, "S9", "cookie access"], [/importScripts|XMLHttpRequest|WebSocket|sendBeacon|EventSource/, "S8", "a network path other than fetch through api.js"]];
    for (const [re, rule, msg] of bans) if (re.test(s)) add(rule, f, msg);
    if (/\bfetch\s*\(/.test(s) && !/js[\\/]api\.js$/.test(f)) add("S8", f, "fetch outside api.js");
    for (const m of s.matchAll(importRe)) {
      const spec = m[1] || m[2];
      if (!spec.startsWith(".")) { add("S6", f, "bare import: " + spec); continue; }
      if (!fs.existsSync(path.resolve(path.dirname(f), spec))) add("S6", f, "import does not resolve: " + spec);
    }
    for (const m of s.matchAll(/https?:\/\/[^\s"'`)<>]+/g)) if (!m[0].startsWith(API_ORIGIN)) add("S8", f, "network address in code: " + m[0]);
    if (/_blank/.test(s) && !/noopener/.test(s)) add("S12", f, "a new-tab open without noopener");
  }

  for (const f of css) {
    const s = read(f);
    if (/@import/i.test(s)) add("S11", f, "@import (nothing may be pulled from elsewhere)");
    if (/url\(\s*["']?https?:/i.test(s)) add("S8", f, "external URL in styles");
    for (const m of s.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) if (!/^(data:|https?:)/.test(m[1]) && !fs.existsSync(path.join(path.dirname(f), m[1]))) add("S11", f, "missing file: " + m[1]);
  }

  // secrets: nowhere. The publishable key only in js/config.js.
  const textFiles = files.filter((f) => /\.(html|js|mjs|css|json|md|txt)$/.test(f) && !f.includes(path.sep + "node_modules" + path.sep) && !f.includes(path.sep + "tests" + path.sep));   // the checks themselves name the patterns they look for
  let pubHits = 0;
  for (const f of textFiles) {
    const s = read(f); const isVendor = f.includes(path.sep + "vendor" + path.sep);
    if (/sb_secret_[A-Za-z0-9_-]{6,}|postgres(?:ql)?:\/\/|SB_POOLED_DB_URL|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/.test(s) || (!isVendor && /service_role/.test(s))) add("S9", f, "a secret-looking value");
    const pk = s.match(/sb_publishable_[A-Za-z0-9_-]+/g) || [];
    if (pk.length) { pubHits += pk.length; if (!/js[\\/]config\.js$/.test(f) && !/tests[\\/]/.test(f)) add("S9", f, "the publishable key outside js/config.js"); }
  }
  const cfg = path.join(root, "js", "config.js");
  if (fs.existsSync(cfg)) { if (!/export const PUBLISHABLE_KEY = "sb_publishable_[A-Za-z0-9_-]+";/.test(read(cfg))) add("S9", cfg, "config.js must hold exactly the publishable key"); if (/sb_secret_/.test(read(cfg))) add("S9", cfg, "SECRET KEY in config.js"); }
  else add("S6", root, "js/config.js is missing");

  // S14: the empty-search note keeps its last sentence (a title search never lists closed or expired postings, so "no match" must say where they can be found), and the page uses that one note.
  const si = path.join(root, "js", "search-input.js"), sp = path.join(root, "js", "pages", "search.js");
  if (fs.existsSync(si) && fs.existsSync(sp)) {
    const note = (read(si).match(/export const NO_MATCH_NOTE = "([^"]*)";/) || [])[1] || "";
    if (!note.endsWith("Closed or expired postings appear only when you search by req code.")) add("S14", si, "NO_MATCH_NOTE must end with the closed-or-expired-by-code sentence");
    const page = read(sp);
    if (!/import\s*\{[^}]*\bNO_MATCH_NOTE\b[^}]*\}\s*from\s*"\.\.\/search-input\.js"/.test(page) || !/empty-note[^\n]*NO_MATCH_NOTE\)\)/.test(page)) add("S14", sp, "the empty-result message must be NO_MATCH_NOTE");
    if (/No posting matched\./.test(page)) add("S14", sp, "a second, hand-written empty-result message");
  } else add("S14", root, "js/search-input.js or js/pages/search.js is missing");

  const vendor = path.join(root, "vendor", "auth-js.min.mjs"), rec =path.join(root, "tests", "vendor-hash.txt");
  if (!fs.existsSync(vendor) || !fs.existsSync(rec)) add("S10", vendor, "vendored Auth client or its recorded hash is missing");
  else if (crypto.createHash("sha256").update(fs.readFileSync(vendor)).digest("hex") !== fs.readFileSync(rec, "utf8").trim()) add("S10", vendor, "the vendored Auth client does not match tests/vendor-hash.txt");
  return findings;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
  const f = checkSite(root);
  const pages = walk(root).filter((x) => x.endsWith(".html")).length;
  for (const x of f) console.log("FINDING " + x.rule + " " + x.file + ": " + x.msg);
  console.log("site-check: " + pages + " pages, " + f.length + " findings");
  process.exit(f.length ? 1 : 0);
}
