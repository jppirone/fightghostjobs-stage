// comments-report.test.js - the "Report a wrong link" section of the comments page (October 4, 2026, John's option A). Real browser, the repo's own files, a fake backend (tests/fake-site.js; no real project, no key).
//
// The rule: the whole section is shown only when the posting HAS links. A posting with no links (the page already says "This employer has not provided a link to where you can apply.") and a posting that is closed (its links are not
// known to a candidate) show no report section. Whether it shows depends on the posting alone, never on what the visitor just did: posting a comment, sending a report or reloading does not change it. A direct address ending in #report on a
// posting with no links shows the page: no error, and the page does not scroll to nothing. For a posting WITH links the form is exactly as it was (the picker lists the links and "Something else about this posting's links", Send works, the
// form clears and stays).
// Then negative controls: the section always shown, never shown, shown only after a comment is posted, hidden after a report is sent; each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/comments-report.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite, NOLINKS_REF, CLOSED_REF } from "./fake-site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WITH_LINKS = "d21m48ybzqbfxxxxxxxx";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const shown = (tab) => tab.eval("(() => { const w = document.querySelector('#reportWrap'); return !!w && !w.hidden && getComputedStyle(w).display !== 'none'; })()");
async function signInAndOpen(tab, site, ref, hash) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate");
  await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.goto(site.url + "/comments.html?ref=" + ref + (hash || ""));
  await tab.waitFor("!document.querySelector('#threadWrap').hidden || !document.querySelector('#pageAlert').hidden", 10000);
  await sleep(500);
}
const postComment = async (tab) => { await tab.eval("(() => { document.querySelector('#commentText').value = 'A comment about this opening.'; document.querySelector('#composeForm').requestSubmit(); })()"); await sleep(900); };
const sendReport = async (tab) => { await tab.eval("(() => { document.querySelector('#reportDetail').value = 'It went to a different job.'; document.querySelector('#reportForm').requestSubmit(); })()"); await sleep(900); };

const SCENARIOS = {
  async postingWithLinks(site) {
    const bad = [], tab = await browser.newTab();
    try {
      await signInAndOpen(tab, site, WITH_LINKS);
      if (!(await shown(tab))) bad.push("an opening WITH links does not show the Report a wrong link section");
      const opts = await tab.eval("Array.from(document.querySelectorAll('#reportLink option')).map((o) => o.textContent)");
      if (!(opts.length === 3 && /^Link 1: /.test(opts[0]) && /^Link 2: /.test(opts[1]) && opts[2] === "Something else about this opening’s links")) bad.push("the link picker is not as before: " + JSON.stringify(opts));
      if (!(await tab.eval("!document.querySelector('#reportLinkLabel').hidden && !document.querySelector('#reportLink').hidden"))) bad.push("the Which link? label and picker are hidden on an opening with links");
      await postComment(tab);
      if (!(await shown(tab))) bad.push("opening a comment hid the report section");
      await sendReport(tab);
      if (!(await tab.eval("/^Sent\\./.test(document.querySelector('#reportAlert').textContent)"))) bad.push("sending a report did not say Sent");
      if (!(await shown(tab))) bad.push("sending a report hid the report section");
      if ((await tab.eval("document.querySelector('#reportDetail').value")) !== "") bad.push("the form did not clear after Send");
      if (site.calls.filter((c) => c.name === "candidate-report-link").length !== 1) bad.push("the report was not sent exactly once");
      await tab.goto(site.url + "/comments.html?ref=" + WITH_LINKS); await tab.waitFor("!document.querySelector('#threadWrap').hidden"); await sleep(400);
      if (!(await shown(tab))) bad.push("after a reload the report section is gone");
    } finally { await tab.close(); }
    return bad;
  },
  async postingWithoutLinks(site) {
    const bad = [], tab = await browser.newTab();
    try {
      await signInAndOpen(tab, site, NOLINKS_REF);
      if (!(await tab.eval("/This employer has not provided a link to where you can apply\\./.test(document.querySelector('#recapNote').textContent)"))) bad.push("the page does not say the employer has not provided a link (it says: " + (await tab.eval("document.querySelector('#recapNote').textContent")) + ")");
      if (await shown(tab)) bad.push("an opening with NO links still shows the Report a wrong link section");
      if (await tab.eval("!document.querySelector('#threadWrap').hidden") !== true) bad.push("the comments thread is not shown (the rest of the page must work)");
      await postComment(tab);
      if (site.calls.filter((c) => c.name === "candidate-post-comment").length !== 1) bad.push("the comment was not posted (the composer must still work)");
      if (await shown(tab)) bad.push("after opening a comment the report section appeared on an opening with no links");
      await tab.goto(site.url + "/comments.html?ref=" + NOLINKS_REF); await tab.waitFor("!document.querySelector('#threadWrap').hidden"); await sleep(400);
      if (await shown(tab)) bad.push("after a reload the report section appeared on an opening with no links");
      // a direct address ending in #report: no error, no jump
      tab.clearErrors();
      await tab.goto(site.url + "/comments.html?ref=" + NOLINKS_REF + "#report"); await tab.waitFor("!document.querySelector('#threadWrap').hidden"); await sleep(600);
      if (await shown(tab)) bad.push("a direct #report address showed the section on an opening with no links");
      if (tab.errors().length) bad.push("a direct #report address raised an error: " + tab.errors()[0]);
      const y = await tab.eval("window.scrollY");
      if (y !== 0) bad.push("a direct #report address scrolled the page to " + y + " (to nothing)");
    } finally { await tab.close(); }
    return bad;
  },
  async closedPosting(site) {
    const bad = [], tab = await browser.newTab();
    try {
      await signInAndOpen(tab, site, CLOSED_REF);
      if (!(await tab.eval("/no longer open/.test(document.querySelector('#recapTitle').textContent)"))) bad.push("the closed opening does not say it is no longer open");
      if (await shown(tab)) bad.push("a closed opening (links not known) shows the Report a wrong link section");
      if (await tab.eval("!document.querySelector('#threadWrap').hidden") !== true) bad.push("the thread of a closed opening is not shown");
    } finally { await tab.close(); }
    return bad;
  },
};
const ALL = Object.keys(SCENARIOS);
async function withSite(root, fn) { const site = await startFakeSite(root); try { return await fn(site); } finally { await site.close(); } }

test("Report a wrong link: shown for an opening with links, hidden for one with no links and for a closed one, whatever the visitor does", { timeout: 300000 }, async () => {
  const problems = [];
  await withSite(ROOT, async (site) => { for (const n of ALL) { site.calls.length = 0; for (const p of await SCENARIOS[n](site)) problems.push(n + ": " + p); } });
  assert.deepEqual(problems, [], "report section problems:\n" + problems.join("\n"));
});

const DEFECTS = [
  ["the report section is always shown", ["postingWithoutLinks", "closedPosting"], (s) => s.replace('$("#reportWrap").hidden = !picker;', '$("#reportWrap").hidden = false;')],
  ["the report section is never shown", ["postingWithLinks"], (s) => s.replace('$("#reportWrap").hidden = !picker;', '$("#reportWrap").hidden = true;')],
  ["the report section appears after a comment is posted", ["postingWithoutLinks"], (s) => s.replace('$("#reportWrap").hidden = !picker;', '$("#reportWrap").hidden = !picker; $("#composeForm").addEventListener("submit", () => { setTimeout(() => { $("#reportWrap").hidden = false; }, 300); });')],
  ["the report section disappears after a report is sent", ["postingWithLinks"], (s) => s.replace('if (r.ok) { $("#reportDetail").value = "";', 'if (r.ok) { $("#reportWrap").hidden = true; $("#reportDetail").value = "";')],
];
test("negative controls: each defect in the report section makes a scenario fail", { timeout: 600000 }, async () => {
  const missed = [];
  for (const [label, scenarios, mutate] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-rep-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const p = path.join(dir, "js", "pages", "comments.js"), before_ = fs.readFileSync(p, "utf8"), after_ = mutate(before_);
      assert.notEqual(after_, before_, "the defect '" + label + "' changed nothing");
      fs.writeFileSync(p, after_);
      const found = [];
      await withSite(dir, async (site) => { for (const n of scenarios) { site.calls.length = 0; found.push(...(await SCENARIOS[n](site)).map((x) => n + ": " + x)); } });
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0] + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
