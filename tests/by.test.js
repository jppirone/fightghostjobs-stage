// by.test.js - prompt BY (October 12, 2026): the staff search (search.html?scope=all) finds an opening by its KIO ID ALONE (Company empty), in every status. In a real browser set up like John's screen (1093 CSS pixels =
// 1366 at 125 percent, classic scroll bar) on the repo's own files with a fake backend (tests/fake-site.js; no real project, no key). The Search button is pressed with the real Enter key. Proven here:
//   1. the ID alone finds each of the seven kinds of opening (live, draft, scheduled, held for review, paused, closed, expired) with the staff view's status word and the whole KIO ID; the recap says the ID; no company is asked;
//   2. the ID typed with hyphens, in lower case without hyphens, with spaces around it, in its stored form and without its prefix finds the same opening; a company with the ID still filters; a title and a company work;
//      a title with no company is still asked for its company;
//   3. an ID that fails the check character is refused on the page with nothing sent; a well formed ID nobody has says "No opening is registered under that ID.";
//   4. a signed-in person who is NOT staff with scope=all gets the candidate behavior (no banner, no staff call, the draft is never shown); a signed-out visitor gets the normal page;
//   5. before the database change (staff function that still needs a company) the page falls back to the normal search and says the normal sentence, never "Enter the company name".
// Then negative controls. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/by.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFakeSite, kioOf, STAFF_ROWS } from "./fake-site.js";
import { johnsBrowser, johnsWindow } from "./johns-screen.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = JSON.stringify;
let browser;
before(async () => { browser = await johnsBrowser(); });
after(async () => { if (browser) await browser.close(); });

const STAFF = "staff@example.test", PLAIN = "plain@example.test";
const NOT_VALID = "That ID is not valid. Check it and try again.", NOT_REG = "No opening is registered under that ID.";
const COMPANY_ASK = "Enter the company name (at least 2 letters or digits).";
// the seven fixture rows with their KIO form (check character included) and the word the staff view shows
const WORD = (r) => (r.status === "draft" && r.go_live_at ? "Scheduled" : { draft: "Draft", flagged: "Held for review", paused: "Paused", live: "Live", closed: "Closed", expired: "Expired" }[r.status]);
const ROWS = STAFF_ROWS.map((r) => { const k = kioOf(r.opening_id.replace(/-/g, "")); return { title: r.title, status: r.status, word: WORD(r), shown: k.shown, stored: k.stored }; });
const DRAFT = ROWS.find((r) => r.title === "Data Analyst Draft");
const UNKNOWN = kioOf("ABCDEFGHJKMN");
const BROKEN = DRAFT.shown.slice(0, -1) + (DRAFT.shown.endsWith("A") ? "B" : "A");

async function signIn(tab, site, kind, email) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  if (kind === "out") return;
  await tab.goto(site.url + "/_dev/link?kind=" + kind + "&email=" + encodeURIComponent(email || "")); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
const text = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; })()");
const fill = (tab, company, title, req = "") => tab.eval("(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; set('company', " + q(company) + "); set('titleq', " + q(title) + "); set('reqq', " + q(req) + "); })()");
const pressSearch = async (tab) => { await tab.eval("document.getElementById('searchBtn').focus()"); await tab.key("Enter"); };
const staffCalls = (site) => site.calls.filter((c) => c.name === "rpc:staff_search_openings");
async function openStaff(tab, site, who = STAFF, scope = true) {
  await signIn(tab, site, who === "out" ? "out" : "candidate", who === "out" ? "" : who);
  await johnsWindow(tab, 1093, 900);
  await tab.goto(site.url + "/search.html" + (scope ? "?scope=all" : "")); await tab.waitFor("document.readyState === 'complete' && !!document.getElementById('company')", 15000); await sleep(900);
}
const cards = (tab) => tab.eval("Array.from(document.querySelectorAll('#results .card')).map((c) => ({ status: c.getAttribute('data-staff-status'), word: (c.querySelector('.res-head .pill') || {}).textContent, text: c.innerText.replace(/\\s+/g, ' ').trim() }))");
async function search(tab, company, title) {
  await fill(tab, company, title); await pressSearch(tab); await sleep(1100);
}
const withStaff = async (root, opts, who, fn, scope = true) => { const site = await startFakeSite(root, { kio: true, ...opts }), tab = await browser.newTab(); try { await openStaff(tab, site, who, scope); return await fn(site, tab); } finally { await tab.close(); await site.close(); } };

const SCENARIOS = {
  // ---- 1. every status, by the ID alone
  async eachStatus(root) { return withStaff(root, {}, STAFF, async (site, tab) => { const bad = [];
    if (!(await tab.eval("!!document.getElementById('staffBanner')"))) { bad.push("the staff view did not start"); return bad; }
    for (const r of ROWS) {
      await search(tab, "", r.shown);
      const c = await cards(tab);
      if (c.length !== 1) { bad.push(r.word + ": " + c.length + " results for its ID alone (" + ((await text(tab, "#formError")) || (await text(tab, "#results")) || "").slice(0, 80) + ")"); continue; }
      if (c[0].word !== r.word) bad.push(r.word + ": the status word is '" + c[0].word + "'");
      if (!c[0].text.includes("KIO ID: " + r.shown)) bad.push(r.word + ": the whole ID is not on the card: " + c[0].text.slice(0, 160));
      if ((await text(tab, "#recapText")) !== "You searched for: KIO ID: " + r.shown + ". Your results are below.") bad.push(r.word + ": the recap says '" + (await text(tab, "#recapText")) + "'");
      if ((await text(tab, "#formError")) === COMPANY_ASK) bad.push(r.word + ": the page asked for a company");
    }
    const sent = staffCalls(site).map((c) => c.body);
    if (sent.length !== ROWS.length || sent.some((b, i) => JSON.stringify(Object.keys(b).sort()) !== JSON.stringify(["p_code", "p_company"]) || b.p_company !== "" || b.p_code !== ROWS[i].stored)) bad.push("the staff calls were " + q(sent).slice(0, 300));
    return bad; }); },
  // ---- 2. the forms of the ID, and the rules that stay
  async forms(root) { return withStaff(root, {}, STAFF, async (site, tab) => { const bad = [];
    const typed = [["hyphens (as shown)", DRAFT.shown], ["lower case, no hyphens", DRAFT.stored.toLowerCase()], ["lower case with hyphens", DRAFT.shown.toLowerCase()], ["spaces around it", "   " + DRAFT.shown + "   "], ["spaces for hyphens", DRAFT.shown.replace(/-/g, " ")], ["its stored form", DRAFT.stored], ["without the prefix", DRAFT.stored.slice(3)]];
    for (const [what, value] of typed) {
      await search(tab, "", value);
      const c = await cards(tab);
      if (c.length !== 1 || c[0].status !== "draft") bad.push(what + ": found " + q(c.map((x) => x.word)) + " (" + ((await text(tab, "#formError")) || "").slice(0, 80) + ")");
    }
    await search(tab, "Meridian", DRAFT.shown);
    let c = await cards(tab);
    if (c.length !== 1 || c[0].status !== "draft") bad.push("a company with the ID: " + q(c.map((x) => x.word)));
    await search(tab, "Zzyzx Unknown", DRAFT.shown);
    c = await cards(tab);
    if (c.length !== 0) bad.push("another company with the ID still found it");
    await search(tab, "Meridian", "Data Analyst");
    c = await cards(tab);
    if (c.length < 5) bad.push("a company with title words found " + c.length + " openings");
    await search(tab, "", "Data Analyst");
    if ((await text(tab, "#formError")) !== COMPANY_ASK) bad.push("a title with no company: the page says '" + (await text(tab, "#formError")) + "' (the company is still asked for)");
    return bad; }); },
  // ---- 3. an ID that fails the check, an ID nobody has
  async invalidAndUnknown(root) { return withStaff(root, {}, STAFF, async (site, tab) => { const bad = [];
    const before = staffCalls(site).length;
    await search(tab, "", BROKEN);
    if ((await text(tab, "#formError")) !== NOT_VALID) bad.push("an ID that fails the check: the page says '" + (await text(tab, "#formError")) + "'");
    if (staffCalls(site).length !== before) bad.push("an ID that fails the check was sent");
    await search(tab, "", UNKNOWN.shown);
    const r = (await text(tab, "#results")) || "";
    if (!r.includes(NOT_REG)) bad.push("an ID nobody has: the results say '" + r.slice(0, 160) + "'");
    if ((await text(tab, "#recapText")) !== "You searched for: KIO ID: " + UNKNOWN.shown + ". Your results are below.") bad.push("the recap of an unknown ID says '" + (await text(tab, "#recapText")) + "'");
    if (r.includes("Nothing matches that company")) bad.push("the company sentence is shown for an ID alone");
    return bad; }); },
  // ---- 4. nobody else gets the staff view
  async notStaff(root) { return withStaff(root, {}, PLAIN, async (site, tab) => { const bad = [];
    await search(tab, "", DRAFT.shown);
    if (await tab.eval("!!document.getElementById('staffBanner')")) bad.push("a person who is not staff sees the staff banner");
    if (staffCalls(site).some((c) => c.body && c.body.p_code)) bad.push("the staff search was asked for a person who is not staff");
    const page = (await tab.eval("document.body.innerText")) || "";
    if (/Data Analyst Draft|Held for review|Not live yet/.test(page)) bad.push("a draft or a staff word is on a non-staff page");
    if (!site.calls.some((c) => c.name === "candidate-search" && c.body && c.body.kio === DRAFT.stored)) bad.push("the candidate search did not run the ID lookup (" + q(site.calls.filter((c) => c.name === "candidate-search").map((c) => c.body)).slice(0, 160) + ")");
    if (!(((await text(tab, "#results")) || "").includes(NOT_REG))) bad.push("the candidate answer is not 'No opening is registered under that ID.' (" + ((await text(tab, "#results")) || "").slice(0, 100) + ")");
    return bad; }); },
  async signedOut(root) { return withStaff(root, {}, "out", async (site, tab) => { const bad = [];
    await search(tab, "", DRAFT.shown);
    if (await tab.eval("!!document.getElementById('staffBanner')")) bad.push("a signed-out visitor sees the staff banner");
    if (staffCalls(site).length !== 0) bad.push("a signed-out visitor made a staff call");
    if (!(await tab.eval("!document.getElementById('signinWrap').hidden"))) bad.push("the sign-in card is not shown to a signed-out visitor");
    return bad; }); },
  // ---- 5. the database before staff-search-id-migration (a company is still needed there)
  async beforeSql(root) { return withStaff(root, { staffNeedsCompany: true }, STAFF, async (site, tab) => { const bad = [];
    await search(tab, "", DRAFT.shown);
    if ((await text(tab, "#formError")) === COMPANY_ASK) bad.push("the page asked for the company");
    if (staffCalls(site).length < 1) bad.push("the staff function was not asked");
    if (await tab.eval("!!document.getElementById('staffBanner')")) bad.push("the staff view stayed on after the database refused (it falls back to the normal search)");
    if (!(((await text(tab, "#results")) || "").includes(NOT_REG))) bad.push("the fall back did not answer the normal sentence: '" + ((await text(tab, "#results")) || "").slice(0, 120) + "'");
    return bad; }); },
};

test("BY: the staff search finds an opening by its KIO ID alone in every status; invalid and unknown IDs; nobody else gets the staff view; the page falls back before the database change", { timeout: 1800000 }, async () => {
  const problems = [];
  for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](ROOT)) problems.push(n + ": " + p);
  assert.deepEqual(problems, [], "BY problems:\n" + problems.join("\n"));
});

// ---- negative controls: [label, scenarios, [[file, mutate]]]
const DEFECTS = [
  ["the staff view asks for a company again", ["eachStatus", "forms"], [["js/pages/search.js", (s) => s.replace("const idAlone = q.ok && q.kind === \"kio\"", "const idAlone = !staffMode && q.ok && q.kind === \"kio\"")]]],
  ["an unknown ID says the company sentence", ["invalidAndUnknown"], [["js/pages/search.js", (s) => s.replace("idAlone === true ? KIO_NOT_REGISTERED_MESSAGE : \"Nothing matches that company and those words in any status.\"", "\"Nothing matches that company and those words in any status.\"")]]],
  ["the staff view sends the ID as words", ["eachStatus"], [["js/pages/search.js", (s) => s.replace("q.kind === \"code\" || q.kind === \"kio\" ? { p_code: q.value } : { p_phrase: q.value }", "{ p_phrase: q.value }")]]],
  ["an ID that fails the check is sent to the staff function", ["invalidAndUnknown"], [["js/pages/search.js", (s) => s.replace("if (!q.ok && q.message === KIO_INVALID_MESSAGE) { setFormError(q.message); queryIn.focus(); return; }", "")]]],
  ["any signed-in person gets the staff view", ["notStaff"], [["js/pages/search.js", (s) => s.replace("if (r.ok && r.data === true) enterStaffMode();", "if (r.ok) enterStaffMode();")]]],
  ["the staff view stays on after the database refuses", ["beforeSql"], [["js/pages/search.js", (s) => s.replace("    leaveStaffMode();\n    return false;\n  } finally {", "    return true;\n  } finally {")]]],
];
test("negative controls: each defect of BY makes a check fail", { timeout: 6000000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    if (process.env.BY_ONLY && !label.includes(process.env.BY_ONLY)) continue;   // BY_ONLY=<part of a label>: run one control while building
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-by-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) {
        try { found.push(...(await SCENARIOS[n](dir)).map((x) => n + ": " + x)); }
        catch (e) { found.push(n + ": the page broke (" + String(e && e.message).slice(0, 120) + ")"); }
      }
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 170) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
