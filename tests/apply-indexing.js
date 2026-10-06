// apply-indexing.js - makes robots.txt and the robots tag of the PUBLIC pages agree with ALLOW_INDEXING in js/config.js (October 6, 2026).
// Run from the repo root:  node tests/apply-indexing.js        (no argument: the repo it sits in).   Another folder:  node tests/apply-indexing.js <folder>
// ALLOW_INDEXING false (the stage setting): every page says noindex, nofollow and robots.txt disallows everything.
// ALLOW_INDEXING true (production, only when the owner deliberately switches it): the PUBLIC pages (PUBLIC_PAGES below) say index, follow and robots.txt allows crawling. Every other page, the ones that need a sign-in or show a person's own data, keeps noindex, nofollow in
// every environment and is never rewritten by this tool. Nothing else in any file is touched. Running it twice changes nothing the second time; flipping the flag back and running it restores the earlier bytes exactly.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PUBLIC_PAGES = ["index.html", "privacy.html"];
export const NOINDEX = '<meta name="robots" content="noindex, nofollow">';
export const INDEXABLE = '<meta name="robots" content="index, follow">';
export const ROBOTS_BLOCK_ALL = "User-agent: *\nDisallow: /\n";
export const ROBOTS_ALLOW = "User-agent: *\nAllow: /\n";
const TAG = /<meta name="robots" content="[^"]*">/;

export function readFlag(root) {
  const m = fs.readFileSync(path.join(root, "js", "config.js"), "utf8").match(/^export const ALLOW_INDEXING = (true|false);/m);
  if (!m) throw new Error("js/config.js must contain a line: export const ALLOW_INDEXING = false;  (or true)");
  return m[1] === "true";
}

// returns the list of files it changed (relative paths); an empty list means everything already agreed
export function applyIndexing(root) {
  const allow = readFlag(root), changed = [];
  const put = (rel, text) => { const p = path.join(root, rel); if (!fs.existsSync(p) || fs.readFileSync(p, "utf8") !== text) { fs.writeFileSync(p, text); changed.push(rel); } };
  put("robots.txt", allow ? ROBOTS_ALLOW : ROBOTS_BLOCK_ALL);
  for (const rel of PUBLIC_PAGES) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    const before = fs.readFileSync(p, "utf8");
    if (!TAG.test(before)) throw new Error(rel + " has no robots meta tag to rewrite");
    const after = before.replace(TAG, allow ? INDEXABLE : NOINDEX);
    if (after !== before) { fs.writeFileSync(p, after); changed.push(rel); }
  }
  return changed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const changed = applyIndexing(root);
  console.log((readFlag(root) ? "ALLOW_INDEXING is true: public pages indexable, robots.txt allows crawling." : "ALLOW_INDEXING is false: every page noindex, robots.txt disallows everything.") + (changed.length ? " Changed: " + changed.join(", ") + "." : " Nothing needed changing."));
}
