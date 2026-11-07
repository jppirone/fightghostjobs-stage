// source-field.test.js - the optional "where you found this job" field of the search page in a real headless Chrome (prompt JD, November 7, 2026), the repo's own files and a fake backend (tests/fake-site.js; no real project, no key, no token).
// The Shortcut address is search.html#x=<text>&s=<where the person found the job>, both encoded separately by the Shortcut (encodeURIComponent).
//   present     the field has a real label (for/id), the word Optional, both examples in its one line, the short sentence for employers, both tied to the input for a screen reader; the input is a 44 pixel target and belongs to the search form
//   shortcut    opened with s the field shows exactly s and the address no longer holds it; Search sends it once as the request field source (and origin mobile); the page has not searched by itself
//   edit        the person edits it: what is sent is what is shown; the person clears it: no source is sent (the Shortcut's value is NOT sent); a new address with no s empties it
//   typed       a value typed by hand on the ordinary page is sent with the same limit of 120 characters; an empty field sends no source key at all; control characters and white space are cleaned the same way
//   after       after the search the field is emptied with the other boxes and "Edit this search" puts it back
//   keyboard    Tab reaches the field, Enter in the field searches (the field belongs to the form)
//   layout      390 x 844 and 1250 x 900: the field is inside the window, nothing scrolls sideways, the input is at least 44 pixels high; pictures are saved to FGJ_JD_PICTURES (default: tests/pictures-jd under the system temp folder)
// Then planted breakages: one deliberate defect at a time in a COPY of the repo, each must make a scenario fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/source-field.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite } from "./fake-site.js";
import { SOURCE_LABEL, SOURCE_OPTIONAL, SOURCE_INSTRUCTION, SOURCE_EMPLOYERS_SEE, SOURCE_PHONE_SENTENCE } from "../js/source-text.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PICS = process.env.FGJ_JD_PICTURES || path.join(os.tmpdir(), "fgj-jd-pictures");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const enc = encodeURIComponent;
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const PHONE = { n: "phone 390x844", w: 390, h: 844, phone: true }, WIDE = { n: "desktop 1250x900", w: 1250, h: 900, phone: false };
const TEXT = "Senior Logistics Analyst\nContoso Freight\nAustin, TX\n$85K/yr - $110K/yr\nViewed";   // reading I01 of tests/phone-readings.js: the reader finds a company and a title in it
const searches = (site) => site.calls.filter((c) => c.name === "candidate-search");

async function become(tab, site, who) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  if (who === "out") return;
  await tab.goto(site.url + "/_dev/link?kind=" + who); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
async function openAt(tab, site, size, hash, waitPhone) {
  await tab.viewport(size.w, size.phone, size.h);
  await tab.goto(site.url + "/404.html"); await tab.goto(site.url + "/search.html" + hash);
  await tab.waitFor("document.readyState === 'complete' && !!document.getElementById('company')", 15000);
  if (waitPhone) await tab.waitFor("!document.getElementById('phoneBody').hidden", 10000); else await sleep(900);
  await sleep(250);
}
const SNAP = `(() => { const g = (id) => document.getElementById(id), r = (el) => { const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), left: Math.round(b.left), right: Math.round(b.right) }; };
  const inp = g('sourceq'), lab = document.querySelector('label[for="sourceq"]');
  return { src: inp ? inp.value : null, c: g('company').value, q: g('titleq').value, href: location.href, hash: location.hash, label: lab ? lab.textContent.replace(/\\s+/g, ' ').trim() : null,
    hint: g('sourceHint') ? g('sourceHint').textContent.trim() : null, note: g('sourceNote') ? g('sourceNote').textContent.trim() : null, describedby: inp ? inp.getAttribute('aria-describedby') : null,
    formOwner: inp && inp.form ? inp.form.id : null, inputBox: inp ? r(inp) : null, inner: window.innerWidth, sideScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    phoneSource: g('phoneSource') ? { hidden: g('phoneSource').hidden, text: g('phoneSource').textContent.trim() } : null, recap: !g('recap').hidden, pending: localStorage.getItem('fgj-pending-search') }; })()`;
const snap = (tab) => tab.eval(SNAP);
const setSource = (tab, v) => tab.eval("(() => { const i = document.getElementById('sourceq'); i.value = " + JSON.stringify(v) + "; i.dispatchEvent(new Event('input', { bubbles: true })); })()");
const press = async (tab, site) => { site.calls.length = 0; await tab.eval("document.getElementById('searchForm').requestSubmit()"); await sleep(1500); return searches(site); };
const hasKey = (b, k) => Object.prototype.hasOwnProperty.call(b, k);

const SCENARIOS = {
  async present(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      for (const size of [PHONE, WIDE]) {
        await become(tab, site, "candidate"); await openAt(tab, site, size, "", false);
        const s = await snap(tab), L = size.n + ": ";
        if (s.src !== "") bad.push(L + "the field is not there or not empty on the ordinary page: " + JSON.stringify(s.src));
        if (!s.label || !s.label.startsWith(SOURCE_LABEL) || !s.label.includes(SOURCE_OPTIONAL)) bad.push(L + "the label is '" + s.label + "'");
        if (s.hint !== SOURCE_INSTRUCTION) bad.push(L + "the instruction line is '" + s.hint + "'");
        if (!/LinkedIn\.com/.test(s.hint || "") || !/jobs@linkedin\.com/.test(s.hint || "")) bad.push(L + "the two examples are not both in the instruction");
        if (s.note !== SOURCE_EMPLOYERS_SEE) bad.push(L + "the sentence for employers is '" + s.note + "'");
        if (!s.describedby || !s.describedby.split(/\s+/).includes("sourceHint") || !s.describedby.split(/\s+/).includes("sourceNote")) bad.push(L + "the input is not tied to its two sentences: " + s.describedby);
        if (s.formOwner !== "searchForm") bad.push(L + "the input does not belong to the search form: " + s.formOwner);
        if (!s.inputBox || s.inputBox.h < 44) bad.push(L + "the input is " + (s.inputBox && s.inputBox.h) + " pixels high (need 44)");
        if (!s.phoneSource || !s.phoneSource.hidden) bad.push(L + "the phone sentence about the source shows on the ordinary page");
      }
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async shortcut(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await become(tab, site, "candidate");
      site.calls.length = 0;
      await openAt(tab, site, PHONE, "#x=" + enc(TEXT) + "&s=" + enc("Jobs at LinkedIn"), true);
      const s0 = await snap(tab);
      if (s0.src !== "Jobs at LinkedIn") bad.push("the field holds '" + s0.src + "' after the Shortcut address");
      if (/[#&]s=|LinkedIn/.test(s0.href)) bad.push("the address still holds the source: " + s0.href);
      if (!s0.phoneSource || s0.phoneSource.hidden || s0.phoneSource.text !== SOURCE_PHONE_SENTENCE) bad.push("the phone sentence about the source is not shown: " + JSON.stringify(s0.phoneSource));
      if (searches(site).length) bad.push("a search ran by itself");
      const sent = await press(tab, site);
      if (sent.length !== 1) bad.push("Search sent " + sent.length + " searches");
      else {
        const b = sent[0].body;
        if (b.source !== "Jobs at LinkedIn") bad.push("the request holds source " + JSON.stringify(b.source));
        if (b.origin !== "mobile") bad.push("the request origin is " + JSON.stringify(b.origin));
        if (JSON.stringify(b).includes("LinkedIn") && !hasKey(b, "source")) bad.push("the source rides outside the field source");
        if (Object.keys(b).some((k) => /^source_/.test(k))) bad.push("the page sent a cleaned value: " + Object.keys(b).join(","));
      }
      // the three examples John typed on his phone, each through the real address
      for (const v of ["Jobsite.com", "Jobs@linkedin.com", "Jobs at LinkedIn"]) {
        await become(tab, site, "candidate"); await openAt(tab, site, PHONE, "#x=" + enc(TEXT) + "&s=" + enc(v), true);
        const r = await snap(tab); if (r.src !== v) bad.push("the example '" + v + "' shows as '" + r.src + "'");
      }
      // an address with an empty s, no s, two s, a bad escape: the text is read, the field is empty
      for (const [hash, why] of [["#x=" + enc(TEXT) + "&s=", "empty s"], ["#x=" + enc(TEXT), "no s"], ["#x=" + enc(TEXT) + "&s=a&s=b", "two s"], ["#x=" + enc(TEXT) + "&s=%E0%A4%A", "bad escape"]]) {
        await become(tab, site, "candidate"); await openAt(tab, site, PHONE, hash, true);
        const r = await snap(tab); if (r.src !== "") bad.push(why + ": the field holds '" + r.src + "'"); if (r.c === "") bad.push(why + ": the text was not read");
      }
      // an encoded & and # inside the source
      await become(tab, site, "candidate"); await openAt(tab, site, PHONE, "#x=" + enc(TEXT) + "&s=" + enc("a&b#c"), true);
      const e = await snap(tab); if (e.src !== "a&b#c") bad.push("an encoded & and # came out as '" + e.src + "'");
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async edit(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await become(tab, site, "candidate");
      await openAt(tab, site, PHONE, "#x=" + enc(TEXT) + "&s=" + enc("Jobs at LinkedIn"), true);
      await setSource(tab, "Indeed.com");
      let s = await snap(tab); let sent = await press(tab, site);
      if (sent.length !== 1 || sent[0].body.source !== "Indeed.com" || s.src !== "Indeed.com") bad.push("an edited value is not what is sent: " + JSON.stringify(sent[0] && sent[0].body));
      await become(tab, site, "candidate");
      await openAt(tab, site, PHONE, "#x=" + enc(TEXT) + "&s=" + enc("Jobs at LinkedIn"), true);
      await setSource(tab, "");
      sent = await press(tab, site);
      if (sent.length !== 1) bad.push("a cleared field: Search sent " + sent.length);
      else if (hasKey(sent[0].body, "source")) bad.push("a cleared field still sends the Shortcut's source: " + JSON.stringify(sent[0].body.source));
      // a second address without s empties a value that was typed
      await become(tab, site, "candidate");
      await openAt(tab, site, PHONE, "#x=" + enc(TEXT) + "&s=" + enc("Jobs at LinkedIn"), true);
      await tab.eval("location.hash = '#x=" + enc(TEXT) + "'"); await sleep(900);
      s = await snap(tab); if (s.src !== "") bad.push("a new address with no s leaves '" + s.src + "' in the field");
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async typed(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await become(tab, site, "candidate"); await openAt(tab, site, WIDE, "", false);
      const fill = async (src) => { await tab.eval("(() => { document.getElementById('company').value = 'Contoso Freight'; document.getElementById('titleq').value = 'Senior Logistics Analyst'; })()"); await setSource(tab, src); return press(tab, site); };
      let sent = await fill("");
      if (sent.length !== 1 || hasKey(sent[0].body, "source")) bad.push("an empty field sends a source key: " + JSON.stringify(sent[0] && sent[0].body));
      if (sent[0] && sent[0].body.origin !== "site") bad.push("a typed search is not origin site: " + JSON.stringify(sent[0].body.origin));
      await openAt(tab, site, WIDE, "", false);
      sent = await fill("   ");
      if (sent.length !== 1 || hasKey(sent[0].body, "source")) bad.push("a field of spaces sends a source key");
      await openAt(tab, site, WIDE, "", false);
      sent = await fill("jobs@linkedin.com");
      if (sent.length !== 1 || sent[0].body.source !== "jobs@linkedin.com") bad.push("a typed value is not sent: " + JSON.stringify(sent[0] && sent[0].body));
      await openAt(tab, site, WIDE, "", false);
      sent = await fill("x".repeat(300));
      if (sent.length !== 1 || typeof sent[0].body.source !== "string" || sent[0].body.source.length !== 120) bad.push("300 characters were sent as " + (sent[0] && sent[0].body.source && sent[0].body.source.length));
      await openAt(tab, site, WIDE, "", false);
      sent = await fill("  a \t\n  b\u0001c  ");
      if (sent.length !== 1 || sent[0].body.source !== "a bc") bad.push("white space and control characters: sent " + JSON.stringify(sent[0] && sent[0].body.source));
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async after(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await become(tab, site, "candidate");
      await openAt(tab, site, PHONE, "#x=" + enc(TEXT) + "&s=" + enc("Glassdoor"), true);
      const sent = await press(tab, site);
      let s = await snap(tab);
      if (sent.length === 1 && s.recap && s.src !== "") bad.push("the field was not emptied with the other boxes: '" + s.src + "'");
      await tab.eval("document.getElementById('recapEdit').click()"); await sleep(300);
      s = await snap(tab); if (sent.length === 1 && s.src !== "Glassdoor") bad.push("Edit this search did not bring the source back: '" + s.src + "'");
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async keyboard(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await become(tab, site, "candidate"); await openAt(tab, site, WIDE, "", false);
      await tab.eval("(() => { document.getElementById('company').value = 'Contoso Freight'; document.getElementById('titleq').value = 'Senior Logistics Analyst'; document.getElementById('sourceq').focus(); })()");
      await setSource(tab, "Dice.com");
      const f = await tab.eval("document.activeElement && document.activeElement.id");
      if (f !== "sourceq") bad.push("the field can not be focused (active: " + f + ")");
      site.calls.length = 0; await tab.key("Enter"); await sleep(1500);
      const sent = searches(site);
      if (sent.length !== 1 || sent[0].body.source !== "Dice.com") bad.push("Enter in the field did not search with the source: " + JSON.stringify(sent[0] && sent[0].body));
      // Tab from the Title box reaches the field before the Search button
      await openAt(tab, site, WIDE, "", false);
      await tab.eval("document.getElementById('titleq').focus()"); await tab.key("Tab"); await tab.key("Tab"); await sleep(100);
      const order = await tab.eval("document.activeElement && document.activeElement.id");
      if (!["sourceq", "searchBtn"].includes(order)) bad.push("Tab from the title box lands on " + order);
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async layout(root, o = {}) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      fs.mkdirSync(PICS, { recursive: true });
      for (const size of [PHONE, WIDE]) {
        for (const [tag, hash, wait] of [["ordinary", "", false], ["shortcut", "#x=" + enc(TEXT) + "&s=" + enc("Jobs@linkedin.com"), true]]) {
          await become(tab, site, "candidate"); await openAt(tab, site, size, hash, wait);
          const s = await snap(tab), L = size.n + " " + tag + ": ";
          if (s.sideScroll) bad.push(L + "the page scrolls sideways");
          if (!s.inputBox || s.inputBox.left < 0 || s.inputBox.right > s.inner) bad.push(L + "the input is outside the window: " + JSON.stringify(s.inputBox));
          if (!s.inputBox || s.inputBox.h < 44) bad.push(L + "the input is " + (s.inputBox && s.inputBox.h) + " pixels high");
          if (size.phone && s.inputBox && s.inputBox.w < 250) bad.push(L + "the input is only " + s.inputBox.w + " pixels wide on the phone");
          if (!o.noPictures) {
            await tab.eval("document.getElementById('sourceBlock').scrollIntoView({ block: 'center' })"); await sleep(250);
            await tab.shot(path.join(PICS, "source-field-" + size.w + "-" + tag + ".png"));
          }
        }
      }
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
};

for (const [name, fn] of Object.entries(SCENARIOS)) {
  test("the source field: " + name, { timeout: 600000 }, async () => {
    const bad = await fn(ROOT);
    assert.deepEqual(bad, [], bad.join("\n"));
  });
}

// ---- planted breakages: [label, scenarios to run, [file, mutate(text)]...]. Each must make at least one scenario report a problem.
const SE = "js/phone-entry.js", SP = "js/pages/search.js", SM = "js/phone-model.js";
const DEFECTS = [
  ["the Shortcut's source is sent when the person has cleared the field", ["edit"], [[SE, (s) => s.replace("if (sourceEl) { sourceEl.value", "win.__shortcutSource = parsed.source; if (sourceEl) { sourceEl.value")], [SP, (s) => s.replace("const src = limitSource(sourceIn.value);", "const src = limitSource(sourceIn.value) || limitSource(window.__shortcutSource || \"\");")]]],
  ["the field is not filled from the address", ["shortcut", "edit"], [[SE, (s) => s.replace("if (sourceEl) { sourceEl.value = typeof parsed.source === \"string\" ? parsed.source : \"\"; }", "")]]],
  ["a new address with no s leaves the old value in the field", ["edit"], [[SE, (s) => s.replace("sourceEl.value = typeof parsed.source === \"string\" ? parsed.source : \"\";", "if (parsed.source) sourceEl.value = parsed.source;")]]],
  ["the source is sent without the limit of 120 characters", ["typed"], [[SP, (s) => s.replace("const src = limitSource(sourceIn.value);", "const src = String(sourceIn.value);")]]],
  ["an empty field sends an empty source key", ["typed"], [[SP, (s) => s.replace("src !== \"\" ? { source: src } : {}", "{ source: src }")]]],
  ["the field is not emptied with the other boxes", ["after"], [[SP, (s) => s.replace("reqIn.value = \"\"; sourceIn.value = \"\";", "reqIn.value = \"\";")]]],
  ["Edit this search does not bring the source back", ["after"], [[SP, (s) => s.replace(" sourceIn.value = lastSearch.source || \"\";", "")]]],
  ["the source is not sent at all", ["shortcut", "typed", "keyboard"], [[SP, (s) => s.replace("src !== \"\" ? { source: src } : {}", "{}")]]],
  ["the source goes into the text boxes (the title) instead of its own field", ["shortcut"], [[SE, (s) => s.replace("if (sourceEl) { sourceEl.value = typeof parsed.source === \"string\" ? parsed.source : \"\"; }", "if (sourceEl) { queryEl.value = queryEl.value + ' ' + parsed.source; }")]]],
  ["s makes the page refuse the text (s is a refusing key)", ["shortcut"], [[SM, (s) => s.replace("else if (key === \"s\") { sCount++; if (sCount === 1) sValue = piece.slice(eq + 1); }", "else if (key === \"s\") { old = true; sCount++; if (sCount === 1) sValue = piece.slice(eq + 1); }")]]],
  ["the source is not removed from the address", ["shortcut"], [[SE, (s) => s.replace("takeAddress(); fill({ company: \"\", query: \"\", req: \"\" });\n    say(SENTENCES[10])", "fill({ company: \"\", query: \"\", req: \"\" });\n    say(SENTENCES[10])").replace("  takeAddress();\n  if (typeof onOrigin", "  if (typeof onOrigin")]]],
  ["the label has no for attribute", ["present"], [["search.html", (s) => s.replace('<label for="sourceq" class="srch-source-label">', '<label class="srch-source-label">')]]],
  ["the word Optional is missing", ["present"], [["search.html", (s) => s.replace('<span class="srch-opt">Optional</span>', "")]]],
  ["the sentence for employers is missing", ["present"], [["search.html", (s) => s.replace("Employers see this exactly as you type it.", "")]]],
  ["the input is not tied to its sentences", ["present"], [["search.html", (s) => s.replace(' aria-describedby="sourceHint sourceNote"', "")]]],
  ["the input is outside the search form (Enter does not search)", ["present", "keyboard"], [["search.html", (s) => s.replace(' form="searchForm"', "")]]],
  ["the input is a small target", ["present", "layout"], [["app.css", (s) => s.replace("padding:4px 0;min-height:44px;box-sizing:border-box;width:100%", "padding:0;min-height:0;height:20px;box-sizing:border-box;width:100%")]]],
  ["the field makes the page scroll sideways on a phone", ["layout"], [["app.css", (s) => s.replace(".srch-source{display:flex;", ".srch-source{min-width:1600px;display:flex;")]]],
];
test("planted breakages: each deliberate defect in the source field makes a scenario fail", { timeout: 6000000 }, async () => {
  const missed = [], only = process.env.FGJ_JD_ONLY ? process.env.FGJ_JD_ONLY.split("|") : null;
  let n = 0;
  for (const [label, scenarios, edits] of DEFECTS) {
    if (only && !only.some((x) => label.includes(x))) continue;
    n++;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-jd-ctl-")), t0 = Date.now();
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) {
        const p = path.join(dir, rel), before = fs.readFileSync(p, "utf8").replace(/\?v=[0-9a-f]{8}(?=["'`])/g, "").replace(/\r\n/g, "\n"), after = mutate(before);
        assert.notEqual(after, before, "the defect '" + label + "' changed nothing in " + rel);
        fs.writeFileSync(p, after);
      }
      const found = [];
      for (const name of scenarios) found.push(...(await SCENARIOS[name](dir, { noPictures: true })).map((x) => name + ": " + x));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  [" + ((Date.now() - t0) / 1000).toFixed(0) + " s]  (" + found[0].slice(0, 150) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  console.log("planted breakages run: " + n + ", missed: " + missed.length);
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
