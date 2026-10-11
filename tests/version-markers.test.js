// version-markers.test.js - the version markers on every local script and style reference (prompt BG, October 10, 2026): tests/stamp-versions.js, and what a real browser does with them.
//
// Unit: a change deep in the module graph changes the marker of every module above it and of the page that loads one of them, and of no other page; the same tree stamped twice is identical (nothing changes);
// a circle of modules shares one marker; a style sheet's marker is its own bytes; dynamic imports and absolute style references are stamped; external references and anchors are left alone; a marker never
// changes its own hash; the markers of the real repository are current.
// Browser: the site is served with Cache-Control: max-age=600 as GitHub Pages serves it. A page is opened, one deep module is changed and the markers are stamped again, the page is opened again WITHOUT a hard
// refresh: it shows the change. The same change without a new stamp is served from the cache (the reason the markers exist), which proves the test can tell the two apart.
// A missing browser FAILS the browser test (set FGJ_BROWSER). Run: node --test tests/version-markers.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stamp, plan, problems, computeVersions, stripMarkers } from "./stamp-versions.js";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite } from "./fake-site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MARK = /\?v=[0-9a-f]{8}/;

const made = [];   // every temporary tree this file makes: removed when the file is done (nothing is left in the temp folder)
function makeTree(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-stamp-")); made.push(d);
  for (const [rel, text] of Object.entries(files)) { const p = path.join(d, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); }
  return d;
}
const rd = (d, rel) => fs.readFileSync(path.join(d, rel), "utf8");
const page = (src, extra) => '<!doctype html><html><head><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="app.css">' + (extra || "") + '</head><body><script type="module" src="' + src + '"></script></body></html>';
const FILES = () => ({
  "styles.css": "body{margin:0}", "app.css": ".a{color:red}",
  "vendor/lib.min.mjs": "export const lib = 1;",
  "data/table.js": "export const T = [1, 2, 3];",
  "js/leaf.js": 'export const leaf = "one";',
  "js/mid.js": 'import { leaf } from "./leaf.js";\nexport const mid = leaf + "-mid";',
  "js/lazy.js": 'export const lazy = "lazy";',
  "js/pages/a.js": 'import { mid } from "../mid.js";\nimport { lib } from "../../vendor/lib.min.mjs";\nexport const a = mid + lib;\nexport const more = () => import("../lazy.js");',
  "js/pages/b.js": 'import { lazy } from "../lazy.js";\nexport const b = lazy;',
  "a.html": page("js/pages/a.js"), "b.html": page("js/pages/b.js"),
  "404.html": '<!doctype html><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/app.css"><a href="https://example.com/x.js">x</a><script src="https://cdn.example/x.js"></script>',
});

test("stamping: every local script, style and import gets a marker; external references and anchors are left alone", () => {
  const d = makeTree(FILES());
  const changed = stamp(d);
  assert.ok(changed.includes("a.html") && changed.includes("js/pages/a.js") && changed.includes("js/mid.js") && changed.includes("404.html"));
  assert.match(rd(d, "a.html"), /<link rel="stylesheet" href="styles\.css\?v=[0-9a-f]{8}">/);
  assert.match(rd(d, "a.html"), /<script type="module" src="js\/pages\/a\.js\?v=[0-9a-f]{8}">/);
  assert.match(rd(d, "js/pages/a.js"), /from "\.\.\/mid\.js\?v=[0-9a-f]{8}"/);
  assert.match(rd(d, "js/pages/a.js"), /from "\.\.\/\.\.\/vendor\/lib\.min\.mjs\?v=[0-9a-f]{8}"/);
  assert.match(rd(d, "js/pages/a.js"), /import\("\.\.\/lazy\.js\?v=[0-9a-f]{8}"\)/, "a dynamic import is stamped too");
  assert.match(rd(d, "404.html"), /href="\/styles\.css\?v=[0-9a-f]{8}"/, "an absolute style reference is stamped");
  assert.match(rd(d, "404.html"), /href="https:\/\/example\.com\/x\.js"/); assert.ok(!MARK.test(rd(d, "404.html").match(/example\.com\/x\.js"[^>]*>/)[0]), "an anchor to another site is untouched");
  assert.match(rd(d, "404.html"), /src="https:\/\/cdn\.example\/x\.js"/);
  assert.deepEqual(problems(d), []);
});

test("stamping twice changes nothing; a marker never changes its own hash", () => {
  const d = makeTree(FILES());
  stamp(d);
  const snap = Object.fromEntries(Object.keys(FILES()).map((k) => [k, rd(d, k)]));
  assert.deepEqual(stamp(d), [], "the second run changed " + stamp(d).join(","));
  for (const k of Object.keys(snap)) assert.equal(rd(d, k), snap[k], k);
  assert.equal(stripMarkers(rd(d, "a.html")), FILES()["a.html"], "stripping the markers gives back the page as written");
});

test("a change deep in the graph changes the markers above it and the pages that load it, and no other page", () => {
  const d = makeTree(FILES());
  stamp(d);
  const before = (rel) => (rd(d, rel).match(/\?v=([0-9a-f]{8})/g) || []).join(",");
  const A = before("a.html"), B = before("b.html"), mid = before("js/mid.js"), pa = before("js/pages/a.js");
  fs.writeFileSync(path.join(d, "js/leaf.js"), 'export const leaf = "two";');
  assert.ok(problems(d).length > 0, "the stale markers are found before the stamp");
  stamp(d);
  assert.notEqual(before("js/mid.js"), mid, "the module that imports the changed one");
  assert.notEqual(before("js/pages/a.js"), pa, "the page script above it");
  assert.notEqual(before("a.html"), A, "the page that loads it");
  assert.equal(before("b.html"), B, "a page that does not load it is untouched");
  assert.deepEqual(problems(d), []);
  // a change in a style sheet changes the marker of every page that links it
  fs.writeFileSync(path.join(d, "app.css"), ".a{color:blue}");
  const B2 = before("b.html"); stamp(d);
  assert.notEqual(before("b.html"), B2);
});

test("a circle of modules shares one marker, and a change in one of them changes it", () => {
  const d = makeTree({ "js/x.js": 'import { y } from "./y.js";\nexport const x = () => y;', "js/y.js": 'import { x } from "./x.js";\nexport const y = () => x;', "js/pages/c.js": 'import { x } from "../x.js";\nexport default x;', "c.html": page("js/pages/c.js") });
  stamp(d);
  const mx = rd(d, "js/x.js").match(/\?v=([0-9a-f]{8})/)[1], my = rd(d, "js/y.js").match(/\?v=([0-9a-f]{8})/)[1];
  assert.equal(mx, my, "both modules of the circle carry the same marker");
  assert.deepEqual(problems(d), []);
  fs.writeFileSync(path.join(d, "js/y.js"), 'import { x } from "./x.js";\nexport const y = () => x; // changed');
  stamp(d);
  assert.notEqual(rd(d, "js/x.js").match(/\?v=([0-9a-f]{8})/)[1], mx);
  assert.deepEqual(problems(d), []);
});

test("a missing marker and a stale marker are both reported, with the reference and the expected marker", () => {
  const d = makeTree(FILES());
  stamp(d);
  fs.writeFileSync(path.join(d, "a.html"), rd(d, "a.html").replace(/(js\/pages\/a\.js)\?v=[0-9a-f]{8}/, "$1"));
  fs.writeFileSync(path.join(d, "js/pages/a.js"), rd(d, "js/pages/a.js").replace(/(\.\.\/mid\.js)\?v=[0-9a-f]{8}/, "$1?v=00000000"));
  const p = problems(d);
  assert.ok(p.some((x) => x.rel === "a.html" && /no marker: js\/pages\/a\.js /.test(x.message)), JSON.stringify(p));
  assert.ok(p.some((x) => x.rel === "js/pages/a.js" && /stale marker: \.\.\/mid\.js\?v=00000000/.test(x.message)), JSON.stringify(p));
});

test("the repository itself: every local script, style and import carries a current marker", () => {
  assert.deepEqual(problems(ROOT), []);
  const { changes } = plan(ROOT);
  assert.deepEqual(changes.map((c) => c.rel), []);
  const v = computeVersions(ROOT);
  assert.ok(v.modules.length > 40, "the module graph was read (" + v.modules.length + " modules)");
});

// ---- the browser: a changed module reaches the person without a hard refresh, because its marker changed
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });

test("in a real browser with Cache-Control max-age=600: a stamped change shows on the next visit; the same change without a stamp is served from the cache", { timeout: 180000 }, async () => {
  const d = makeTree({
    "js/dep.js": 'export const VALUE = "one";',
    "js/probe.js": 'import { VALUE } from "./dep.js";\ndocument.title = VALUE;',
    "probe.html": '<!doctype html><html><head><title>start</title></head><body><script type="module" src="js/probe.js"></script></body></html>',
  });
  stamp(d);
  const site = await startFakeSite(d, { pageCache: "public, max-age=600" });
  const tab = await browser.newTab();
  try {
    // the first visit loads the page; every later look is an ordinary reload (F5): the browser asks again for the page itself (a page cannot carry a marker) and uses its cache for everything else it still holds fresh
    const first = async () => { await tab.goto(site.url + "/probe.html"); await tab.waitFor("document.title !== 'start'", 8000); return tab.eval("document.title"); };
    const title = async () => { await tab.eval("document.title = 'start'; location.reload()"); await sleep(300); await tab.waitFor("document.title !== 'start'", 8000); return tab.eval("document.title"); };
    assert.equal(await first(), "one");
    // 1. the module is changed and NOT stamped: the browser keeps the old copy (fresh in its cache for ten minutes)
    fs.writeFileSync(path.join(d, "js/dep.js"), 'export const VALUE = "two";');
    assert.equal(await title(), "one", "without a new marker the cached copy is used: this is the problem the markers solve");
    // 2. the markers are stamped: the page names a new address for the changed file, so the next ordinary visit shows it
    stamp(d);
    assert.equal(await title(), "two", "with a new marker the change shows on an ordinary reload, without a hard refresh");
  } finally { await tab.close(); await site.close(); fs.rmSync(d, { recursive: true, force: true }); }
});
