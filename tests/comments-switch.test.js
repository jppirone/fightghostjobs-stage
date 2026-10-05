// comments-switch.test.js - the one comments switch (E6, October 5, 2026): COMMENTS_VISIBLE in js/config.js, SHIPPED OFF. Real browser, the repo's own files, a fake backend (tests/fake-site.js; no real project, no key).
// OFF (the file exactly as shipped): the home page's example card has no Comments link; the details window has no "Comments (N)" link but keeps "Report a wrong link"; the comments page shows only the wrong-link report section (no thread,
// no comment form, no contest part, no "Comments stay open" line) and does not even ask the backend for the thread; the employer's comments page shows nothing of the thread either; My postings has no Comments column, no row link and no
// phone card line. ON (the fake site serves the same file with the switch turned on, which is also how every other browser test sees the site): everything is as it was before the switch existed.
// Then negative controls: one defect at a time, each must make a check fail (a switch shipped on, a surface that ignores the switch, the report section lost, a surface that stays hidden when the switch is on).
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/comments-switch.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite, CLOSED_REF } from "./fake-site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REF = "d21m48ybzqbfxxxxxxxx", GID = "3f1d5b1e-0000-4000-8000-000000000001";
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

async function become(tab, site, who) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  if (who === "out") return;
  await tab.goto(site.url + "/_dev/link?kind=" + who); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
const shown = (tab, sel) => tab.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && !e.closest("[hidden]") && e.getClientRects().length > 0; })()`);
const callNames = (site) => site.calls.map((c) => c.name);

// one run of every surface; on: whether the switch is on (the expected state of every surface follows it)
async function surfaces(site, on) {
  const bad = [], t = (s) => s, tab = await browser.newTab();
  try {
    await tab.focusEmulation(true);
    // 1. the home page's example card
    await become(tab, site, "out"); await tab.goto(site.url + "/index.html"); await tab.waitFor("document.readyState === 'complete'"); await sleep(500);
    if ((await shown(tab, "#cardComments")) !== on) bad.push(t("the home page card's Comments link is " + (on ? "missing" : "shown")));
    // 2. the details window
    await become(tab, site, "candidate"); await tab.goto(site.url + "/search.html"); await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(500);
    await tab.eval("(() => { document.getElementById('company').value = 'Meridian'; document.getElementById('titleq').value = 'Nurse'; document.getElementById('searchForm').requestSubmit(); })()");
    await tab.waitFor("document.querySelectorAll('.view-details').length > 0", 8000);
    await tab.eval("document.querySelector('.view-details').click()");
    await tab.waitFor("document.getElementById('modalBackdrop').classList.contains('open') && document.querySelectorAll('#modalLinks .source-row').length > 0", 8000); await sleep(300);
    const more = await tab.eval("Array.from(document.querySelectorAll('#modalMore a')).map((a) => a.textContent.trim())");
    const hasComments = more.some((x) => /^Comments/.test(x)), hasReport = more.some((x) => /^Report a wrong link/.test(x));
    if (hasComments !== on) bad.push(t("the details window " + (on ? "has no" : "still has a") + " Comments link (" + more.join(" | ") + ")"));
    if (!hasReport) bad.push(t("the details window lost Report a wrong link (" + more.join(" | ") + ")"));
    await tab.key("Escape");
    // 3. the candidate's comments page
    site.calls.length = 0;
    await tab.goto(site.url + "/comments.html?ref=" + REF); await tab.waitFor("document.readyState === 'complete' && !document.getElementById('recap').hidden", 10000); await sleep(1200);
    for (const [sel, name] of [["#threadWrap", "the thread"], ["#composeWrap", "the comment form"]]) if ((await shown(tab, sel)) !== on) bad.push(t(name + " is " + (on ? "missing" : "shown") + " on the comments page"));
    if (!(await shown(tab, "#reportWrap"))) bad.push(t("the wrong-link report section is not shown on the comments page"));
    const txt = await tab.eval("document.body.innerText");
    if (/Add a comment|Post comment|Contest/i.test(txt) === !on) bad.push(t("the comment form or a contest part " + (on ? "is missing" : "shows") + " on the comments page"));
    if (callNames(site).includes("candidate-list-comments") !== on) bad.push(t("the comments page " + (on ? "did not ask" : "asked") + " the backend for the thread"));
    // a closed posting: the line about comments staying open
    await tab.goto(site.url + "/comments.html?ref=" + CLOSED_REF); await tab.waitFor("document.readyState === 'complete' && !document.getElementById('recap').hidden", 10000); await sleep(800);
    const note = await tab.eval("document.getElementById('recapNote').textContent");
    if (/Comments stay open/.test(note) !== on) bad.push(t("the closed posting's note " + (on ? "lost" : "still has") + " the line Comments stay open (" + note.slice(-80) + ")"));
    // 4. the employer's side
    await become(tab, site, "poster");
    site.calls.length = 0;
    await tab.goto(site.url + "/comments.html?id=" + GID); await tab.waitFor("document.readyState === 'complete' && !document.getElementById('recap').hidden", 10000); await sleep(1000);
    if ((await shown(tab, "#threadWrap")) !== on || (await shown(tab, "#employerNote")) !== on) bad.push(t("the employer's comments page " + (on ? "has no" : "still shows the") + " thread"));
    if ((await tab.eval("document.getElementById('recapNote').textContent.trim()")) !== "" && !on) bad.push(t("the employer's comments page still has the line about what candidates wrote"));
    if (callNames(site).includes("list-posting-comments") !== on) bad.push(t("the employer's comments page " + (on ? "did not ask" : "asked") + " the backend for the thread"));
    // 5. My postings, at 1280 and on a phone
    for (const [w, phone] of [[1280, false], [375, true]]) {
      await tab.viewport(w, phone); await tab.goto(site.url + "/dashboard.html"); await tab.waitFor("document.querySelectorAll('.rtable tbody tr').length > 0", 10000); await sleep(500);
      const d = await tab.eval(`({ th: Array.from(document.querySelectorAll("th")).some((e) => e.textContent.trim() === "Comments"), td: document.querySelectorAll('td[data-label="Comments"]').length, links: document.querySelectorAll('a[href^="comments.html?id="]').length, rows: document.querySelectorAll('.rtable tbody tr').length })`);
      if (d.th !== on || (d.td > 0) !== on || (d.links > 0) !== on) bad.push(t("at " + w + " My postings: Comments column " + d.th + ", cells " + d.td + ", row links " + d.links + " (rows " + d.rows + ")"));
    }
  } finally { await tab.close(); }
  return bad;
}

const SCENARIOS = { async off(root) { const site = await startFakeSite(root, { commentsOff: true }); try { return await surfaces(site, false); } finally { await site.close(); } }, async on(root) { const site = await startFakeSite(root); try { return await surfaces(site, true); } finally { await site.close(); } } };

test("comments switch: shipped OFF every comment surface is hidden and the report stays; switched ON everything is as before", { timeout: 900000 }, async () => {
  const problems = [];
  for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](ROOT)) problems.push(n + ": " + p);
  assert.match(fs.readFileSync(path.join(ROOT, "js", "config.js"), "utf8"), /export const COMMENTS_VISIBLE = false;/, "the switch ships OFF");
  assert.deepEqual(problems, [], "comments switch problems:\n" + problems.join("\n"));
});

const DEFECTS = [
  ["the switch ships ON", ["off"], [["js/config.js", (s) => s.replace("COMMENTS_VISIBLE = false", "COMMENTS_VISIBLE = true")]]],
  ["the home page card keeps its Comments link", ["off"], [["js/pages/index.js", (s) => s.replace("if (!COMMENTS_VISIBLE) { const c", "if (false) { const c")]]],
  ["the details window keeps its Comments link", ["off"], [["js/pages/search.js", (s) => s.replace("if (COMMENTS_VISIBLE) more.append(", "more.append(")]]],
  ["the details window loses Report a wrong link", ["off"], [["js/pages/search.js", (s) => s.replace("if (withReport) more.append(", "if (false) more.append(")]]],
  ["the comments page keeps the thread and the comment form", ["off"], [["js/pages/comments.js", (s) => s.replace("if (COMMENTS_VISIBLE) { $(\"#threadWrap\")", "if (true) { $(\"#threadWrap\")")]]],
  ["the comments page still loads the thread", ["off"], [["js/pages/comments.js", (s) => s.replace("if (COMMENTS_VISIBLE) await loadThread(0);", "await loadThread(0);")]]],
  ["the closed posting keeps the line Comments stay open", ["off"], [["js/pages/comments.js", (s) => s.replace("d.data.closed_reason || null, COMMENTS_VISIBLE)", "d.data.closed_reason || null, true)")]]],
  ["the employer's comments page keeps the thread", ["off"], [["js/pages/comments.js", (s) => s.replace("  if (!COMMENTS_VISIBLE) return;   // comments are switched off", "  // comments are switched off")]]],
  ["My postings keeps the Comments column header", ["off"], [["js/pages/dashboard.js", (s) => s.replace("if (!COMMENTS_VISIBLE) { const th", "if (false) { const th")]]],
  ["My postings keeps the Comments cell and link", ["off"], [["js/pages/dashboard.js", (s) => s.replace("    COMMENTS_VISIBLE ? h(\"td\"", "    true ? h(\"td\"")]]],
  ["switched on, the home page card has no Comments link", ["on"], [["js/pages/index.js", (s) => s.replace("if (!COMMENTS_VISIBLE) { const c", "if (true) { const c")]]],
  ["switched on, the details window has no Comments link", ["on"], [["js/pages/search.js", (s) => s.replace("if (COMMENTS_VISIBLE) more.append(", "if (false) more.append(")]]],
  ["switched on, the comments page has no thread", ["on"], [["js/pages/comments.js", (s) => s.replace("if (COMMENTS_VISIBLE) { $(\"#threadWrap\")", "if (false) { $(\"#threadWrap\")")]]],
  ["switched on, My postings has no Comments column", ["on"], [["js/pages/dashboard.js", (s) => s.replace("if (!COMMENTS_VISIBLE) { const th", "if (true) { const th")]]],
];
async function withSite(root, fn) { const site = await startFakeSite(root); try { return await fn(site); } finally { await site.close(); } }
test("negative controls: each defect in the comments switch makes a check fail", { timeout: 3000000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-cs-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) found.push(...(await SCENARIOS[n](dir)).map((x) => n + ": " + x));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 160) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
void withSite;
