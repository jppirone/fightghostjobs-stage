// policy-link.test.js - the employer's AI and hiring policy link in a real browser (October 10, 2026, prompt BA). The repo's own files and a fake backend (tests/fake-site.js; no real project, no key, no network).
//
// THE EDITOR (edit.html, the Disclosures area, directly under the two AI toggles): a box with its own Save policy link and Remove policy link buttons, behind the SAME tier check as the destination links.
//   not on the tier: the sales notice and no box; on the tier and empty; on the tier with a stored link whose check answered, did not answer, or could not be tried (the employer is told candidates are not shown it);
//   lapsed: kept and hidden, said so. A refused address shows its reason under the box; nothing typed is sent without being checked first; Enter saves the policy link and never the whole opening; the unsaved bar names it.
// THE CANDIDATE (search.html, the details window): one line "AI and hiring policy: <where it goes>" only when the server sent the entry, through the same one-time link as the other links; it never takes the place of an application link,
// never appears among the links a wrong-link report can name, and the extension's hand-off carries nothing about it.
// Then negative controls: one defect at a time in the page code; each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/policy-link.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite } from "./fake-site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EDIT = "edit.html?id=3f1d5b1e-0000-4000-8000-000000000001";
const PID = "3f1d5b1e-0000-4000-8000-000000000001";
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }
const text = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + JSON.stringify(sel) + "); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; })()");
const visible = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + JSON.stringify(sel) + "); return !!e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none'; })()");
const typeIn = (tab, sel, value) => tab.eval("(() => { const e = document.querySelector(" + JSON.stringify(sel) + "); e.value = " + JSON.stringify(value) + "; e.dispatchEvent(new Event('input', { bubbles: true })); })()");
const callsOf = (site, name) => site.calls.filter((c) => c.name === name);

async function openEdit(tab, site) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=poster"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.viewport(1280, false);
  await tab.goto(site.url + "/" + EDIT);
  await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value", 10000); await sleep(600);
  await tab.eval("window.confirm = () => true;");
}
async function openSearch(tab, site, hash) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate&email=cand%40example.test");
  await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.goto(site.url + "/search.html" + (hash || ""));
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(900);
}
async function runSearch(tab) {
  await tab.eval("(() => { document.querySelector('#company').value = 'Meridian'; document.querySelector('#titleq').value = 'Analyst'; document.querySelector('#searchForm').requestSubmit(); })()");
  await tab.waitFor("document.querySelectorAll('#results .card').length > 0 && !document.querySelector('#searchBtn').disabled", 12000); await sleep(400);
}
async function openDetails(tab) {
  await tab.eval("document.querySelectorAll('#results .view-details')[0].click()");
  await tab.waitFor("document.querySelector('#modalBackdrop').classList.contains('open') && !document.querySelector('#modalIntro').hidden", 8000); await sleep(700);
}
const WINDOW = `(() => ({
  apply: [...document.querySelectorAll('#modalLinks .source-row')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim()),
  policyHidden: document.querySelector('#modalPolicy').hidden, policy: [...document.querySelectorAll('#modalPolicy .source-row')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim()),
  empty: document.querySelector('#modalEmpty').hidden ? null : document.querySelector('#modalEmpty').innerText.trim(), noteShown: !document.querySelector('#modalLinksNote').hidden,
  more: [...document.querySelectorAll('#modalMore a')].map((a) => a.innerText.replace(/\\s+/g, ' ').trim()), all: document.querySelector('.modal').innerText.replace(/\\s+/g, ' ').trim() }))()`;

const SCENARIOS = {
  // ---- the editor
  async locked(root) { return withSite(root, {}, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    if (!(await visible(tab, "#policyRow"))) bad.push("the AI and hiring policy box is missing from the editor");
    if ((await text(tab, "#policyLabel")) !== "Link to your AI and hiring policy (optional)") bad.push("the label is '" + (await text(tab, "#policyLabel")) + "'");
    if (!(await visible(tab, "#policyLocked"))) bad.push("an organization not on the tier does not see the notice");
    if (await visible(tab, "#policyUrl")) bad.push("an organization not on the tier is offered the box");
    if (await visible(tab, "#savePolicyBtn")) bad.push("an organization not on the tier is offered a Save button");
    const note = await text(tab, "#policyLocked");
    if (!/destination links tier/.test(note || "") || !/sales@fightghostjobs\.com/.test(note || "")) bad.push("the notice does not name the tier and the sales address: " + note);
    const mail = await tab.eval("(document.querySelector('#policyLocked a') || {}).href || ''");
    if (!/^mailto:sales@fightghostjobs\.com/.test(mail)) bad.push("the sales link is '" + mail + "'");
    const under = await tab.eval("(() => { const t = document.querySelector('#aiInterviewNoteRow'), p = document.querySelector('#policyRow'); return !!(t.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(p.compareDocumentPosition(document.querySelector('#recruiterToggle')) & Node.DOCUMENT_POSITION_FOLLOWING); })()");
    if (!under) bad.push("the box is not directly under the two AI toggles and their notes (before the recruiter toggle)");
    if (callsOf(site, "set-destination-links").length) bad.push("something was sent");
    return bad; })); },
  async empty(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    if (!(await visible(tab, "#policyUrl")) || !(await visible(tab, "#savePolicyBtn"))) bad.push("an organization on the tier does not get the box and its Save button");
    if (await visible(tab, "#removePolicyBtn")) bad.push("Remove is offered with nothing stored");
    if (await visible(tab, "#policyLocked")) bad.push("the sales notice is shown to an organization on the tier");
    if ((await text(tab, "#policyStored")) !== "No AI and hiring policy link is saved.") bad.push("the stored line is '" + (await text(tab, "#policyStored")) + "'");
    const v = await tab.eval("document.querySelector('#policyUrl').value");
    if (v !== "") bad.push("the box is not empty at the start");
    // names a screen reader reads
    const names = await tab.eval("(() => { const i = document.querySelector('#policyUrl'); const l = document.querySelector('label[for=policyUrl]'); return { label: l ? l.innerText.trim() : null, desc: (i.getAttribute('aria-describedby') || '').split(' ').map((id) => (document.getElementById(id) || {}).id).filter(Boolean), save: document.querySelector('#savePolicyBtn').innerText.trim(), remove: document.querySelector('#removePolicyBtn').innerText.trim() }; })()");
    if (names.label !== "Link to your AI and hiring policy (optional)") bad.push("the box has no label that names it: " + JSON.stringify(names));
    if (!names.desc.includes("policyHint")) bad.push("the hint is not tied to the box");
    if (names.save !== "Save policy link") bad.push("the button is called '" + names.save + "'");
    const hint = await text(tab, "#policyHint");
    if (!/checks only that the address answers/.test(hint || "") || /verif|approv|complian/i.test(hint || "")) bad.push("the hint says '" + hint + "'");
    // the application links panel does not take it
    if (await visible(tab, "#clearLinksBtn")) bad.push("the application links panel offers to remove links that are not there");
    return bad; })); },
  async save(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await typeIn(tab, "#policyUrl", "https://policy.own-employer.example/ai");
    if (!(await visible(tab, "#unsavedBar"))) bad.push("typing an address does not show the unsaved bar");
    const bar = await text(tab, "#unsavedHead");
    if (!/AI and hiring policy link not saved yet/.test(bar || "")) bad.push("the bar says '" + bar + "'");
    if (await visible(tab, "#unsavedSave")) bad.push("the bar offers Save changes for something Save changes does not save");
    await tab.eval("document.querySelector('#savePolicyBtn').click()");
    await tab.waitFor("document.querySelector('#policyAlert') && !document.querySelector('#policyAlert').hidden", 8000); await sleep(500);
    const c = callsOf(site, "set-destination-links");
    if (c.length !== 1) { bad.push("expected one set-destination-links call, got " + c.length); return bad; }
    if (JSON.stringify(c[0].body) !== JSON.stringify({ posting_id: PID, kind: "policy", links: [{ url: "https://policy.own-employer.example/ai" }] })) bad.push("the request was " + JSON.stringify(c[0].body));
    if (callsOf(site, "edit-posting").length) bad.push("the opening itself was saved as well");
    const msg = await text(tab, "#policyAlert");
    if (!/^Saved\. Candidates see it as AI and hiring policy: Employer's own site\./.test(msg || "")) bad.push("the message is '" + msg + "'");
    if ((await tab.eval("document.querySelector('#policyUrl').value")) !== "") bad.push("the address was put back into the box (it is write-only)");
    if (!(await visible(tab, "#removePolicyBtn"))) bad.push("Remove is not offered after a save");
    if (await visible(tab, "#unsavedBar")) bad.push("the unsaved bar stayed after the save");
    if (!/Candidates see it as AI and hiring policy: Employer's own site\. When we checked, the address answered\./.test((await text(tab, "#policyStored")) || "")) bad.push("the stored line is '" + (await text(tab, "#policyStored")) + "'");
    if (await visible(tab, "#clearLinksBtn")) bad.push("the policy link was counted as an application link (the panel offers to remove them)");
    // Remove
    await tab.eval("document.querySelector('#removePolicyBtn').click()");
    await tab.waitFor("!document.querySelector('#removePolicyBtn') || document.querySelector('#removePolicyBtn').hidden", 8000); await sleep(400);
    const c2 = callsOf(site, "set-destination-links");
    if (c2.length !== 2 || JSON.stringify(c2[1].body) !== JSON.stringify({ posting_id: PID, kind: "policy", links: [] })) bad.push("Remove sent " + JSON.stringify(c2[1] && c2[1].body));
    if (!/^Removed\./.test((await text(tab, "#policyAlert")) || "")) bad.push("the message after Remove is '" + (await text(tab, "#policyAlert")) + "'");
    return bad; })); },
  async failing(root) { return withSite(root, { plan: "verified", policyCheck: "failed" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await typeIn(tab, "#policyUrl", "https://policy.own-employer.example/gone");
    await tab.eval("document.querySelector('#savePolicyBtn').click()");
    await tab.waitFor("document.querySelector('#policyAlert') && !document.querySelector('#policyAlert').hidden", 8000); await sleep(500);
    const msg = await text(tab, "#policyAlert"), note = await text(tab, "#policyNote");
    if (!/did not answer \(HTTP 404\)\. Candidates are not shown it until a check answers/.test(msg || "")) bad.push("the message after the save is '" + msg + "'");
    if (!/did not answer \(HTTP 404\)\. Candidates are not shown it\./.test(note || "")) bad.push("the notice that stays is '" + note + "'");
    if (!(await visible(tab, "#removePolicyBtn"))) bad.push("Remove is not offered for a stored link that did not answer");
    return bad; })); },
  async storedFailing(root) { return withSite(root, { plan: "verified", policy: { check_status: "skipped", check_http: null } }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    const note = await text(tab, "#policyNote");
    if (!/could not be checked just now, so candidates are not shown it yet/.test(note || "")) bad.push("a link that could not be tried is described as '" + note + "'");
    if (await visible(tab, "#clearLinksBtn")) bad.push("a stored policy link is listed among the application links");
    return bad; })); },
  async lapsed(root) { return withSite(root, { plan: "lapsed", policy: { check_status: "ok", check_http: 200 } }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    const note = await text(tab, "#policyNote");
    if (!/tier ended/.test(note || "") || !/kept but hidden from candidates until it is renewed/.test(note || "")) bad.push("the lapsed notice is '" + note + "'");
    if (await visible(tab, "#policyUrl") || await visible(tab, "#policyLocked")) bad.push("a lapsed organization sees the box or the sales notice");
    return bad; })); },
  async refused(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await typeIn(tab, "#policyUrl", "http://insecure.example/x");
    await tab.eval("document.querySelector('#savePolicyBtn').click()"); await sleep(400);
    if (callsOf(site, "set-destination-links").length) bad.push("an address that is not https was sent");
    const e1 = await text(tab, "#policyError");
    if (!/must start with https/.test(e1 || "")) bad.push("the error under the box is '" + e1 + "'");
    if ((await tab.eval("document.querySelector('#policyUrl').getAttribute('aria-invalid')")) !== "true") bad.push("the box is not marked invalid");
    await typeIn(tab, "#policyUrl", "https://blocked.example/x");
    await tab.eval("document.querySelector('#savePolicyBtn').click()");
    await tab.waitFor("!document.querySelector('#policyError').hidden && /not allowed/.test(document.querySelector('#policyError').innerText)", 8000);
    if (callsOf(site, "set-destination-links").length !== 1) bad.push("expected one request");
    if (await visible(tab, "#removePolicyBtn")) bad.push("a refused address was stored");
    return bad; })); },
  async enterKey(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await tab.eval("document.querySelector('#policyUrl').focus()");
    await typeIn(tab, "#policyUrl", "https://policy.own-employer.example/ai");
    await tab.key("Enter"); await sleep(1200);
    if (callsOf(site, "set-destination-links").length !== 1) bad.push("Enter did not save the policy link");
    if (callsOf(site, "edit-posting").length) bad.push("Enter in the policy box saved the whole opening");
    return bad; })); },
  async discard(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await typeIn(tab, "#policyUrl", "https://policy.own-employer.example/ai");
    await tab.eval("document.querySelector('#unsavedDiscard').click()"); await sleep(700);
    if ((await tab.eval("document.querySelector('#policyUrl').value")) !== "") bad.push("Discard left the typed address in the box");
    if (await visible(tab, "#unsavedBar")) bad.push("the bar stayed after Discard");
    if (callsOf(site, "set-destination-links").length) bad.push("Discard sent something");
    return bad; })); },
  // ---- the candidate
  async candidateLine(root) { return withSite(root, { policyDetail: true }, (site) => withTab(async (tab) => { const bad = [];
    await openSearch(tab, site); await runSearch(tab); await openDetails(tab);
    const w = await tab.eval(WINDOW);
    if (w.policyHidden || w.policy.length !== 1 || w.policy[0] !== "AI and hiring policy: Employer's own site Continue →") bad.push("the line is " + JSON.stringify(w.policy) + " (hidden " + w.policyHidden + ")");
    if (w.apply.length !== 2 || w.apply.some((t) => /AI and hiring policy/.test(t))) bad.push("the application links are " + JSON.stringify(w.apply));
    if (!w.noteShown) bad.push("the note about the one-time links is not shown");
    if (!w.more.some((t) => /Report a wrong link/.test(t))) bad.push("the report link is gone");
    if (/verif|approv|complian|certif/i.test(w.policy.join(" "))) bad.push("the line makes a claim");
    // the application path: the first application row opens the application link, never the policy link (window.open is replaced so the test reads the address the page opens)
    await tab.eval("window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return {}; };");
    await tab.eval("document.querySelector('#modalLinks .source-row').click()"); await sleep(1000);
    let opened = await tab.eval("window.__opened");
    const issued = callsOf(site, "candidate-link-issue");
    if (issued.length !== 1 || Object.keys(issued[0].body).join() !== "posting_ref") bad.push("the apply click asked for " + JSON.stringify(issued.map((c) => c.body)));
    if (opened.length !== 1 || opened[0] !== "https://go.example.invalid/f/apply-1") bad.push("the apply click opened " + JSON.stringify(opened));
    // the policy line: its own one-time link, asked for the same way
    await tab.eval("document.querySelector('#modalPolicy .source-row').click()"); await sleep(1000);
    opened = await tab.eval("window.__opened");
    if (opened.length !== 2 || opened[1] !== "https://go.example.invalid/f/policy-1") bad.push("the policy line opened " + JSON.stringify(opened));
    const asked = callsOf(site, "candidate-link-issue");
    if (asked.length !== 2 || asked.some((c) => Object.keys(c.body).join() !== "posting_ref")) bad.push("the one-time links were asked for with " + JSON.stringify(asked.map((c) => c.body)));
    return bad; })); },
  async candidateNone(root) { return withSite(root, {}, (site) => withTab(async (tab) => { const bad = [];
    await openSearch(tab, site); await runSearch(tab); await openDetails(tab);
    const w = await tab.eval(WINDOW);
    if (!w.policyHidden || w.policy.length !== 0 || /AI and hiring policy/.test(w.all)) bad.push("a line is shown although the server sent none: " + JSON.stringify(w.policy));
    if (w.apply.length !== 2) bad.push("the application links are " + JSON.stringify(w.apply));
    return bad; })); },
  async candidateOnly(root) { return withSite(root, { policyDetail: "only" }, (site) => withTab(async (tab) => { const bad = [];
    await openSearch(tab, site); await runSearch(tab); await openDetails(tab);
    const w = await tab.eval(WINDOW);
    if (!/hasn't provided a link to where you can apply/.test(w.empty || "")) bad.push("an opening with only a policy link does not say it has no application link: " + JSON.stringify(w.empty));
    if (w.apply.length !== 0) bad.push("a policy link was drawn as an application link: " + JSON.stringify(w.apply));
    if (w.policy.length !== 1) bad.push("the policy line is not shown: " + JSON.stringify(w.policy));
    if (w.more.some((t) => /Report a wrong link/.test(t))) bad.push("a wrong-link report is offered for an opening that has no application link");
    return bad; })); },
  async handoff(root) { return withSite(root, { policyDetail: true }, (site) => withTab(async (tab) => { const bad = [];
    await openSearch(tab, site, "#c=Meridian&t=Analyst"); await sleep(600);
    const names = site.calls.map((c) => c.name);
    if (names.some((n) => n === "set-destination-links" || n === "candidate-link-issue")) bad.push("the hand-off page made a link request: " + names.join(", "));
    const bodies = JSON.stringify(site.calls.filter((c) => c.name === "candidate-search").map((c) => c.body));
    if (/policy/i.test(bodies)) bad.push("a search request mentions the policy link: " + bodies);
    return bad; })); },
};

for (const [name, run] of Object.entries(SCENARIOS)) {
  test("the AI and hiring policy link, " + name, { timeout: 120000 }, async () => {
    const bad = await run(ROOT);
    assert.deepEqual(bad, [], bad.join("\n"));
  });
}

// ---- negative controls: one defect at a time in the page code; each must make a scenario fail
const DEFECTS = [
  ["the editor shows a stored policy link among the application links", [["js/edit-form.js", (s) => s.replace('filter((x) => x.kind === undefined || x.kind === "apply")', 'filter((x) => x.kind !== "recruiter")')]], ["save", "storedFailing"]],
  ["a candidate is shown a policy line the server did not send", [["js/policy-link.js", (s) => s.replace('if (!l || typeof l.label !== "string" || l.label === "") return null;', 'if (!l || typeof l.label !== "string" || l.label === "") return { position: 1, label: POLICY_LINE_LABEL, where: "Employer\'s own site" };')]], ["candidateNone"]],
  ["the application links include the policy link", [["js/policy-link.js", (s) => s.replace('filter((x) => x && x.kind !== "policy")', "filter((x) => !!x)")]], ["candidateOnly", "candidateLine"]],
  ["the policy link is saved as an application link", [["js/api.js", (s) => s.replace('kind: "policy", links: url === null', 'kind: "apply", links: url === null')]], ["save"]],
  ["Enter in the policy box saves the whole opening", [["js/pages/edit.js", (s) => s.replace('$("#policyUrl").addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); submitPolicy(false); } });', "")]], ["enterKey"]],
  ["a link that did not answer is not told to the employer", [["js/policy-link.js", (s) => s.replace('if (v.status === "failed") return', 'if (v.status === "never") return')]], ["failing", "storedFailing"]],
  ["the apply click opens whichever link has the same position", [["js/pages/search.js", (s) => s.replace('(x.kind || "apply") === (link.kind || "apply")', "true")]], ["candidateLine"]],
  ["the sales notice is never shown", [["js/pages/edit.js", (s) => s.replace('$("#policyLocked").hidden = v.show !== "locked";', '$("#policyLocked").hidden = true;')]], ["locked"]],
  ["the address is sent without being checked", [["js/policy-link.js", (s) => s.replace('if (!/^https:\\/\\//i.test(url)) return { ok: false, error: "The address must start with https://" };', "")]], ["refused"]],
  ["the wrong-link report can name the policy link", [["js/comments-model.js", (s) => s.replace('d.data.links.filter((l) => !(l && l.kind === "policy"))', "d.data.links")]], ["__picker"]],
];
test("negative controls: each defect in the policy link page code makes a scenario fail", { timeout: 1800000 }, async () => {
  const missed = [];
  for (const [label, edits, scenarios] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-pol-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      if (scenarios[0] === "__picker") {
        // the picker of the wrong-link report is built from the detail answer: run the model of the mutated copy
        const m = await import("file:///" + path.join(dir, "js", "comments-model.js").replace(/\\/g, "/") + "?x=" + Math.random());
        const picked = m.linkChoices(m.detailLinks({ ok: true, data: { links: [{ position: 1, kind: "apply", firm: null, label: "x" }, { position: 1, kind: "policy", firm: null, label: "y" }] } }));
        if (picked.length !== 2) found.push("the picker offers " + picked.length + " choices (wanted the application link and 'something else')");
      } else for (const n of scenarios) {
        // a scenario that cannot even finish (an element the page no longer draws) has caught the defect too
        try { for (const p of await SCENARIOS[n](dir)) found.push(n + ": " + p); } catch (e) { found.push(n + ": the scenario could not finish: " + String(e.message).slice(0, 100)); }
      }
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 150) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
