// bv.test.js - prompt BV (October 12, 2026), in a real browser set up like John's screen (tests/johns-screen.js) on the repo's own files with a fake backend (tests/fake-site.js; no real project, no key). Proven here:
//   1. the Closes cell of a draft whose publish window ended reads "Ended <day>" (and a draft with time left still "Publish by <day>"), at 1093 (1366 at 125 percent), 1100 and 1366 pixels, in both Closes sorts and the
//      Draft pill, with no date broken inside and no sideways scroll bar;
//   2. the My openings filter finds an opening by its KIO ID typed with the hyphens as shown, in lower case, with spaces around it, or by a part of it that spans a hyphen; a title with a hyphen and a req number are
//      found as before; an ID that matches nothing finds nothing; hyphens alone behave as an empty box (every row);
//   3. the home page's sample card shows a WHOLE KIO ID that passes the real check character, in the line shape of a real result, is not a link, and is not the ID of any opening the test backend knows;
//   4. the candidate's comments page shows the whole KIO ID the server sends, the req number still masked, nothing masked in the ID; an answer from before the database change (no kio_id) still shows the masked
//      code; the employer's comments page is as it was.
// Then negative controls: one deliberate defect at a time in the page code; each must make a scenario fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/bv.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFakeSite, kioOf } from "./fake-site.js";
import { johnsBrowser, johnsWindow, MEASURE, DAY } from "./johns-screen.js";
import { kioValid } from "../js/kio.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = JSON.stringify;
let browser;
before(async () => { browser = await johnsBrowser(); });
after(async () => { if (browser) await browser.close(); });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (ms) => { const d = new Date(ms); return MONTHS[d.getMonth()] + " " + d.getDate(); };
const iso = (ms) => new Date(ms).toISOString();
const WITH_LINKS = "d21m48ybzqbfxxxxxxxx";
const SHOWN_OF_REF = kioOf("D21M48YBZQBF").shown;      // what the fake backend sends as kio_id for the opening behind WITH_LINKS (kio: true)
const EDIT_ID = "3f1d5b1e-0000-4000-8000-000000000001";

async function withSite(root, opts, fn) { const site = await startFakeSite(root, { kio: true, ...opts }); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }
async function signIn(tab, site, kind) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  if (kind === "out") return;
  await tab.goto(site.url + "/_dev/link?kind=" + kind); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
const text = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; })()");
const typeIn = (tab, sel, value) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); e.value = " + q(value) + "; e.dispatchEvent(new Event('input', { bubbles: true })); })()");
const pill = (tab, label) => tab.eval("(() => { const b = Array.from(document.querySelectorAll('#filters .filter-pill')).find((x) => x.textContent.trim() === " + q(label) + "); if (!b) throw new Error('no pill ' + " + q(label) + "); b.click(); })()");
const pickSort = (tab, value) => tab.eval("(() => { const s = document.querySelector('#sortBox'); s.value = " + q(value) + "; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
const titles = (tab) => tab.eval("Array.from(document.querySelectorAll('tbody tr')).map((tr) => tr.querySelector('td').firstChild.textContent.trim())");
const closesOf = (tab) => tab.eval("Object.fromEntries(Array.from(document.querySelectorAll('tbody tr')).map((tr) => [tr.querySelector('td').firstChild.textContent.trim(), (tr.querySelector('td[data-label=\"Closes\"] .dt') || tr.querySelector('td[data-label=\"Closes\"]')).innerText.replace(/\\s+/g, ' ').trim()]))");   // the date words only: the flag line under it ("in 5 days") is a second block
async function openDash(tab, site, width) {
  await signIn(tab, site, "poster");
  await johnsWindow(tab, width, 500);
  await tab.goto(site.url + "/dashboard.html");
  await tab.waitFor("document.querySelectorAll('tbody tr').length > 0", 10000);
  await tab.waitFor("document.fonts.status === 'loaded'", 10000); await sleep(400);
}

function rowsOf(now = Date.now()) {
  const base = (title, o) => Object.assign({ title, is_remote: false, locations: ["Austin, TX"], location_ids: [], source_location_text: null, bump_used: false, bump_days: null, posted_at: iso(now - 12 * DAY), publish_by: null, go_live_at: null, closed_reason: null, created_at: iso(now - 20 * DAY) }, o);
  const list = [
    base("Alpha Live", { status: "live", stored_status: "live", expiration_date: iso(now + 20 * DAY), req_number: "R-2026-0451" }),
    base("Front-End Engineer", { status: "live", stored_status: "live", expiration_date: iso(now + 25 * DAY), req_number: "FE-77" }),
    base("Hotel Dead Draft", { status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: iso(now - 3 * DAY), created_at: iso(now - 17 * DAY), req_number: "H-3" }),
    base("India Dead Draft Older", { status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: iso(now - 9 * DAY), created_at: iso(now - 23 * DAY), req_number: "I-9" }),
    base("Juliet Draft Alive", { status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: iso(now + 6 * DAY), created_at: iso(now - 8 * DAY), req_number: "J-6" }),
    base("Bravo Closed", { status: "closed", stored_status: "closed", closed_reason: "filled", expiration_date: iso(now + 30 * DAY), closed_at: iso(now - 5 * DAY), req_number: "B-5", post_id: "KIO4N8P2R6T9V3X" }),   // (an extra row copies the first row's ID unless it has its own)
  ];
  return { plan: "verified", mineOverrides: list.slice(0, 5), mineExtra: list.slice(5) };
}

const SCENARIOS = {
  // ---- 1. the Closes cell of a draft whose window ended
  async endedCell(root) { return withSite(root, rowsOf(), (site) => withTab(async (tab) => { const bad = [], now = Date.now();
    for (const width of [1093, 1100, 1366]) {
      await openDash(tab, site, width);
      const c = await closesOf(tab);
      if (c["Hotel Dead Draft"] !== "Ended " + day(now - 3 * DAY)) bad.push(width + ": the draft whose window ended reads '" + c["Hotel Dead Draft"] + "'");
      if (c["India Dead Draft Older"] !== "Ended " + day(now - 9 * DAY)) bad.push(width + ": the older one reads '" + c["India Dead Draft Older"] + "'");
      if (c["Juliet Draft Alive"] !== "Publish by " + day(now + 6 * DAY)) bad.push(width + ": a draft with time left reads '" + c["Juliet Draft Alive"] + "'");
      if (c["Bravo Closed"] !== "Closed " + day(now - 5 * DAY)) bad.push(width + ": a closed row reads '" + c["Bravo Closed"] + "'");
      const m = await tab.eval(MEASURE);
      if (m.pageScroll || m.sideScroll) bad.push(width + ": a sideways scroll bar");
      const broken = m.rows.filter((r) => r.closes.some((x) => x.lines > 1));
      if (broken.length) bad.push(width + ": a date is broken inside in " + broken.map((r) => r.title).join(", "));
      // the same words in both Closes sorts and in the Draft pill (the position is BU's; the words must not depend on it)
      for (const sort of ["closes_asc", "closes_desc"]) {
        await pickSort(tab, sort); await sleep(250);
        const d = await closesOf(tab);
        if (d["Hotel Dead Draft"] !== c["Hotel Dead Draft"] || d["Juliet Draft Alive"] !== c["Juliet Draft Alive"]) bad.push(width + ": " + sort + " changed a Closes cell");
      }
      await pill(tab, "Draft"); await sleep(250);
      const e = await closesOf(tab);
      if (Object.keys(e).length !== 3 || e["Hotel Dead Draft"] !== c["Hotel Dead Draft"]) bad.push(width + ": the Draft pill shows " + q(e));
      await pill(tab, "All");
    }
    return bad; })); },
  // ---- 2. the filter
  async filter(root) { return withSite(root, rowsOf(), (site) => withTab(async (tab) => { const bad = [];
    for (const width of [1093, 1366]) {
      await openDash(tab, site, width);
      const ids = await tab.eval("Array.from(document.querySelectorAll('tbody tr')).map((tr) => [tr.querySelector('td').firstChild.textContent.trim(), tr.querySelector('td[data-label=\"KIO ID\"]').textContent.trim()])");
      const idOf = Object.fromEntries(ids);
      const shown = idOf["Alpha Live"];
      if (!/^KIO-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(shown || "")) { bad.push(width + ": the ID column shows '" + shown + "'"); continue; }
      const parts = shown.split("-");           // KIO, g1, g2, g3
      const only = async (query, want, why) => {
        await typeIn(tab, "#textFilter", query); await sleep(250);
        const t = await titles(tab);
        if (JSON.stringify(t) !== JSON.stringify(want)) bad.push(width + ": " + why + " (" + q(query) + ") shows " + q(t) + ", wanted " + q(want));
      };
      await only(shown, ["Alpha Live"], "the ID as shown");
      await only(shown.toLowerCase(), ["Alpha Live"], "the ID in lower case");
      await only("  " + shown + "  ", ["Alpha Live"], "the ID with spaces around it");
      await only(shown.replace(/-/g, " "), ["Alpha Live"], "the ID with spaces for hyphens");
      await only(parts[1] + "-" + parts[2], ["Alpha Live"], "a part that spans a hyphen");
      await only(parts[2].slice(2) + "-" + parts[3].slice(0, 2), ["Alpha Live"], "a short part that spans a hyphen");
      await only(shown.replace(/-/g, ""), ["Alpha Live"], "the stored form, as before");
      await only("front-end", ["Front-End Engineer"], "a title with a hyphen");
      await only("R-2026-0451", ["Alpha Live"], "a req number");
      await only("KIO-ZZZZ-ZZZZ-ZZZZ", [], "an ID nobody has");
      const all = (await (async () => { await typeIn(tab, "#textFilter", ""); await sleep(250); return titles(tab); })());
      await only("---", all, "hyphens alone (an empty box)");
      await only(" - ", all, "a hyphen and spaces (an empty box)");
      if (all.length !== 6) bad.push(width + ": the empty box shows " + all.length + " rows");
    }
    return bad; })); },
  // ---- 3. the home page's sample card
  async homeSample(root) { return withSite(root, {}, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site, "out");
    await tab.goto(site.url + "/index.html"); await tab.waitFor("document.readyState === 'complete'", 10000); await sleep(400);
    const s = await tab.eval(`(() => { const el = Array.from(document.querySelectorAll('div')).find((d) => /^Remote · KIO ID:/.test(d.textContent.trim()) && d.children.length === 1); if (!el) return null;
      const span = el.querySelector('span'); return { line: el.textContent.trim(), id: span ? span.textContent.trim() : null, inLink: !!el.closest('a'), tag: span ? span.tagName : null }; })()`);
    if (!s) { bad.push("the sample card's ID line is not on the home page"); return bad; }
    const m = /^Remote · KIO ID: (KIO-([0-9A-Z]{4})-([0-9A-Z]{4})-([0-9A-Z]{4}))$/.exec(s.line);
    if (!m) { bad.push("the sample line is '" + s.line + "' (a whole KIO-XXXX-XXXX-XXXX was wanted)"); return bad; }
    if (!kioValid(m[2] + m[3] + m[4])) bad.push("the sample ID " + m[1] + " does not pass the check character");
    if (s.inLink) bad.push("the sample ID is inside a link");
    // not the ID of any opening the test backend knows: it appears nowhere in the fake backend or its fixtures
    const fake = fs.readFileSync(path.join(ROOT, "tests", "fake-site.js"), "utf8");
    if (fake.includes(m[2] + m[3] + m[4]) || fake.includes(m[1])) bad.push("the sample ID is an ID the test backend knows");
    const known = [kioOf("D21M48YBZQBF").shown, kioOf("ABCDEFGHJKMN").shown];
    if (known.includes(m[1])) bad.push("the sample ID is one of the test openings' IDs");
    if (/[•*]/.test(s.line)) bad.push("the sample line still has a mask in it");
    return bad; })); },
  // ---- 4. the candidate's comments page, and the employer's
  async commentsPages(root) { const bad = [];
    bad.push(...await withSite(root, {}, (site) => withTab(async (tab) => { const b = [];
      await signIn(tab, site, "candidate");
      await tab.goto(site.url + "/comments.html?ref=" + WITH_LINKS);
      await tab.waitFor("!document.querySelector('#threadWrap').hidden || !document.querySelector('#pageAlert').hidden", 10000); await sleep(500);
      const m = (await text(tab, "#recapMeta")) || "";
      if (!m.includes(" · KIO ID: " + SHOWN_OF_REF)) b.push("the candidate's line does not carry the whole ID " + SHOWN_OF_REF + ": '" + m + "'");
      if (/\*{4}-\*{4}/.test(m)) b.push("the ID is still masked in '" + m + "'");
      const req = /· Req (\S+)/.exec(m);
      if (!req || !/\*/.test(req[1])) b.push("the req number is not masked in '" + m + "'");
      const page = await tab.eval("document.body.innerText");
      if (/\*{4}-\*{4}/.test(page)) b.push("a masked ID is somewhere on the page");
      return b; })));
    // an answer from before the database change (no kio_id): the masked code, as it was
    bad.push(...await startFakeSite(root, {}).then(async (site) => { const tab = await browser.newTab(); const b = [];
      try {
        await signIn(tab, site, "candidate");
        await tab.goto(site.url + "/comments.html?ref=" + WITH_LINKS);
        await tab.waitFor("!document.querySelector('#threadWrap').hidden || !document.querySelector('#pageAlert').hidden", 10000); await sleep(500);
        const m = (await text(tab, "#recapMeta")) || "";
        if (!/ · KIO ID: \*{4}-\*{4}-[0-9A-Z]{4}/.test(m)) b.push("an answer without kio_id reads '" + m + "' (the masked code was wanted)");
      } finally { await tab.close(); await site.close(); }
      return b; }));
    bad.push(...await withSite(root, {}, (site) => withTab(async (tab) => { const b = [];
      await signIn(tab, site, "poster");
      await tab.goto(site.url + "/comments.html?id=" + EDIT_ID);
      await tab.waitFor("!!document.querySelector('#recapMeta') && document.querySelector('#recapMeta').textContent.trim() !== ''", 10000).catch(() => null); await sleep(500);
      const e = (await text(tab, "#recapMeta")) || "";
      if (!/^KIO ID: KIO-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4} · /.test(e)) b.push("the employer's line reads '" + e + "'");
      return b; })));
    return bad; },
};

test("BV: Ended on a dead draft, the filter and hyphens, the whole sample ID on the home page, the whole KIO ID on the candidate comments page", { timeout: 1800000 }, async () => {
  const problems = [];
  for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](ROOT)) problems.push(n + ": " + p);
  assert.deepEqual(problems, [], "BV problems:\n" + problems.join("\n"));
});

// ---- negative controls: [label, scenarios, [[file, mutate]]]
const DEFECTS = [
  ["a draft whose window ended says Publish by again", ["endedCell"], [["js/dashboard-model.js", (s) => s.replace('(nowMs !== undefined && publishWindowEnded(p, nowMs) ? "Ended " : "Publish by ")', '"Publish by "')]]],
  ["the page does not give the cell the time", ["endedCell"], [["js/pages/dashboard.js", (s) => s.replace("dateBits(closesCell(p, now))", "dateBits(closesCell(p))")]]],
  ["a draft with time left says Ended", ["endedCell"], [["js/dashboard-model.js", (s) => s.replace('(nowMs !== undefined && publishWindowEnded(p, nowMs) ? "Ended " : "Publish by ")', '(nowMs !== undefined && p.status === "draft" ? "Ended " : "Publish by ")')]]],
  ["the filter compares only the stored form of the ID", ["filter"], [["js/dashboard-model.js", (s) => s.replace('return typeof p.post_id === "string" && norm(p.post_id).replace(/ /g, "").includes(n.replace(/ /g, ""));', "return false;")]]],
  ["every query loses its hyphens (a title with a hyphen is no longer found by it)", ["filter"], [["js/dashboard-model.js", (s) => s.replace('const n = norm(q); if (n === "") return true;\n  if ([p.title', 'const n = norm(String(q || "").replace(/-/g, "")); if (n === "") return true;\n  if ([p.title')]]],
  ["hyphens alone hide every row", ["filter"], [["js/dashboard-model.js", (s) => s.replace('const n = norm(q); if (n === "") return true;', 'const n = norm(q); if (n === "") return String(q || "").trim() === "";')]]],
  ["the filter is case sensitive for the ID", ["filter"], [["js/dashboard-model.js", (s) => s.replace('return typeof p.post_id === "string" && norm(p.post_id).replace(/ /g, "").includes(n.replace(/ /g, ""));', 'return typeof p.post_id === "string" && p.post_id.includes(String(q).replace(/[ -]/g, ""));')]]],
  ["the sample card shows the old masked value", ["homeSample"], [["index.html", (s) => s.replace("KIO-EV9B-V8ZV-Q45P</span>", "X7K2•••••</span>")]]],
  ["the sample ID fails the check character", ["homeSample"], [["index.html", (s) => s.replace("KIO-EV9B-V8ZV-Q45P</span>", "KIO-EV9B-V8ZV-Q45Q</span>")]]],
  ["the sample ID is a link", ["homeSample"], [["index.html", (s) => s.replace('<div style="font-size:14px;color:var(--muted);margin-top:2px;">Remote · KIO ID: <span class="mono">KIO-EV9B-V8ZV-Q45P</span></div>', '<a href="search.html" style="font-size:14px;color:var(--muted);margin-top:2px;display:block;"><div>Remote · KIO ID: <span class="mono">KIO-EV9B-V8ZV-Q45P</span></div></a>')]]],
  ["the candidate's comments page shows only the masked code", ["commentsPages"], [["js/pages/comments.js", (s) => s.replace('(typeof p.kio_id === "string" && p.kio_id !== "" ? p.kio_id : p.masked_code)', "p.masked_code")]]],
  ["the candidate's comments page has no fallback", ["commentsPages"], [["js/pages/comments.js", (s) => s.replace('(typeof p.kio_id === "string" && p.kio_id !== "" ? p.kio_id : p.masked_code)', "p.kio_id")]]],
  ["the employer's comments line shows the masked code", ["commentsPages"], [["js/pages/comments.js", (s) => s.replace('"KIO ID: " + groupCode(p.post_id) + " · " + p.status', '"KIO ID: ****-****-" + String(p.post_id).slice(-4) + " · " + p.status')]]],
];
test("negative controls: each defect of BV makes a check fail", { timeout: 6000000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    if (process.env.BV_ONLY && !label.includes(process.env.BV_ONLY)) continue;   // BV_ONLY=<part of a label>: run one control while building
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-bv-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) {
        try { found.push(...(await SCENARIOS[n](dir)).map((x) => n + ": " + x)); }
        catch (e) { found.push(n + ": the page broke (" + String(e && e.message).slice(0, 120) + ")"); }
      }
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 160) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
