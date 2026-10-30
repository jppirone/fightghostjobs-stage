// privacy-page.test.js (prompt FN, October 29, 2026) - the app's own privacy.html is a LINK-ONLY page: the app's header and footer, one heading "Privacy Policy" and one sentence, "Our Privacy Policy is on the FightGhostJobs website.", with the link on the
// words Privacy Policy to https://www.fightghostjobs.com/privacy.html (same tab). Run: node --test tests/privacy-page.test.js
// Prompt FO (October 29, 2026): the footer Privacy link of this page goes to the website too (the page holds exactly two links to that address, the sentence and the footer, and none to the app's own privacy.html), and the page is noindex, nofollow in EVERY environment: PART 1b runs
// the indexing tool in its on position on a copy of the repo and the page must still carry noindex, nofollow, while the home page becomes indexable as before.
//   PART 1 (no browser): the page holds exactly that, no older privacy text, no script but the two the page always had, the header of the other signed-out pages byte for byte, the footer line as before; then breakages, each made on a copy held in memory, must be caught,
//          and a plant at nothing must not be flagged.
//   PART 2 (a real browser on the repo's own files with the fake backend tests/fake-site.js; no real project, no key): at 360, 768, 1093 and 1440 px the page has no sideways scroll, shows the header, the one heading, the one sentence and the footer, nothing else, the text uses the app's own
//          heading and paragraph styles, the link is underlined like the other links in the main area, a click goes to the marketing address in the same tab, and no cookie, storage key or backend request is added by the page.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite } from "./fake-site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
const LINK = "https://www.fightghostjobs.com/privacy.html";
const MAIN = '<main id="main">\n\n<div class="pg" style="max-width:760px;margin:0 auto;padding:56px 32px;display:flex;flex-direction:column;gap:22px;">\n  <h1 style="font-size:32px;font-weight:700;letter-spacing:-.01em;">Privacy Policy</h1>\n  <p class="privacy-p">Our <a href="' + LINK + '">Privacy Policy</a> is on the FightGhostJobs website.</p>\n</div>\n\n</main>';
const FOOTER = '<footer class="site-footer"><span>FightGhostJobs</span><a href="' + LINK + '">Privacy</a><a href="mailto:privacy@fightghostjobs.com">privacy@fightghostjobs.com</a></footer>';
const NOINDEX = '<meta name="robots" content="noindex, nofollow">', INDEXABLE = '<meta name="robots" content="index, follow">';
const DASH = new RegExp(String.fromCharCode(8212) + "|" + String.fromCharCode(8211));
const block = (h, a, b) => { const i = h.indexOf(a); const j = h.indexOf(b, i); return i >= 0 && j > i ? h.slice(i, j + b.length) : ""; };

// ---------------------------------------------------------------- PART 1: the file
function findings(html, other) {
  const bad = [];
  const m = html.indexOf("<main"), e = html.indexOf("</main>") + "</main>".length;
  if (html.slice(m, e) !== MAIN) bad.push("the main region is not exactly the heading and the one sentence with the one link");
  const text = html.slice(m, e).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text !== "Privacy Policy Our Privacy Policy is on the FightGhostJobs website.") bad.push("the words on the page are not exactly the approved ones: " + text.slice(0, 80));
  const links = [...html.slice(m, e).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  if (links.length !== 1) bad.push("the main region holds " + links.length + " link(s), not one");
  else {
    if (links[0][2] !== "Privacy Policy") bad.push("the link is not on the words Privacy Policy: " + links[0][2]);
    if (links[0][1].trim() !== 'href="' + LINK + '"') bad.push("the link is not exactly the address, with no other attribute (no target, class, style or script): " + links[0][1].trim().slice(0, 80));
  }
  if (/<h2\b|id="privacy(Emails|Comments|Contests)"|<code>|for as long as FightGhostJobs exists|We keep |We set no cookies|Supabase|Rate-limit|KIO ID|cookie/i.test(html.slice(html.indexOf("<body>")))) bad.push("a piece of the older privacy text is still on the page");
  if (DASH.test(html)) bad.push("the page holds an em dash or an en dash");
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((x) => x[0]);
  if (scripts.length !== 2 || !/src="js\/stage-gate\.js\?v=[0-9a-f]{8}"/.test(scripts[0]) || !/type="module" src="js\/pages\/privacy\.js\?v=[0-9a-f]{8}"/.test(scripts[1])) bad.push("the scripts of the page are not the stage gate and privacy.js only: " + scripts.join(" | ").slice(0, 120));
  if (!html.includes(FOOTER)) bad.push("the footer line is not the app's footer line with the Privacy link to the website, same tab, and the privacy contact");
  const hrefs = [...html.slice(html.indexOf("</header>")).matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((x) => x[1]);
  if (JSON.stringify(hrefs) !== JSON.stringify([LINK, LINK, "mailto:privacy@fightghostjobs.com"])) bad.push("below the header the page must hold exactly two links to " + LINK + " (the sentence and the footer) and the privacy contact, and none to the app's own privacy.html: " + hrefs.join(" | "));
  if ((html.match(/<meta name="robots" content="[^"]*">/g) || []).join("") !== NOINDEX) bad.push("the page must carry exactly one robots tag, noindex, nofollow, in every environment");
  if (other) {
    const hd = block(html, '<header class="nav">', "</header>"), ho = block(other, '<header class="nav">', "</header>");
    if (hd === "" || hd !== ho) bad.push("the header is not the header of the other signed-out pages, byte for byte");
  }
  if (!/<title>FightGhostJobs \| Privacy<\/title>/.test(html)) bad.push("the title is not the title it had (FightGhostJobs | Privacy)");
  if (!html.includes('<meta name="robots" content="noindex, nofollow">') && !html.includes('<meta name="robots" content="index, follow">')) bad.push("the indexing tag is gone");
  if (!/<meta http-equiv="Content-Security-Policy"/.test(html)) bad.push("the content security policy tag is gone");
  return bad;
}

test("PART 1: the app's own privacy.html is the link-only page, with no older privacy text", () => {
  assert.deepEqual(findings(rd("privacy.html"), rd("employer-signin.html")), []);
});

test("PART 1: breakages are caught, a plant at nothing is not", () => {
  const html = rd("privacy.html"), other = rd("employer-signin.html");
  const sw = (t, a, b) => { if (t.split(a).length !== 2) throw new Error("anchor not found once: " + a.slice(0, 50)); return t.replace(a, () => b); };
  const BREAK = [
    ["the older paragraph about cookies is back", () => sw(html, "</div>\n\n</main>", '  <p class="privacy-p">We set no cookies of our own. Your sign-in is kept in your browser\'s local storage.</p>\n</div>\n\n</main>')],
    ["the older retention sentence is back inside the paragraph", () => sw(html, "website.</p>", "website. We keep these records for as long as FightGhostJobs exists.</p>")],
    ["an older section heading is back", () => sw(html, "</div>\n\n</main>", '  <h2 class="privacy-h">Who processes the data</h2>\n</div>\n\n</main>')],
    ["the link goes to another address", () => sw(html, 'href="' + LINK + '">Privacy Policy', 'href="https://www.fightghostjobs.com/privacy">Privacy Policy')],
    ["the link goes to another site", () => sw(html, 'href="' + LINK + '">Privacy Policy', 'href="https://example.com/privacy.html">Privacy Policy')],
    ["the link opens a new tab", () => sw(html, 'href="' + LINK + '">Privacy Policy', 'href="' + LINK + '" target="_blank" rel="noopener">Privacy Policy')],
    ["the link points back to the app's own privacy.html", () => sw(html, 'href="' + LINK + '">Privacy Policy', 'href="privacy.html">Privacy Policy')],
    ["the link is on other words", () => sw(html, ">Privacy Policy</a> is on", ">here</a> is on")],
    ["the heading is renamed", () => sw(html, ">Privacy Policy</h1>", ">Privacy</h1>")],
    ["the sentence is reworded", () => sw(html, "is on the FightGhostJobs website.", "is on our website.")],
    ["a second paragraph is added", () => sw(html, "</div>\n\n</main>", '  <p class="privacy-p">Write to us.</p>\n</div>\n\n</main>')],
    ["a second link is added", () => sw(html, "</div>\n\n</main>", '  <p class="privacy-p"><a href="' + LINK + '">Privacy Policy</a></p>\n</div>\n\n</main>')],
    ["a dash is put in the sentence", () => sw(html, "is on the FightGhostJobs website.", "is on the FightGhostJobs website " + String.fromCharCode(8212) + " online.")],
    ["a script is added", () => sw(html, "</body>", '<script type="module" src="js/x.js"></script></body>')],
    ["the footer link points back to the app's own privacy.html (a link to itself)", () => sw(html, '<a href="' + LINK + '">Privacy</a><a href="mailto', '<a href="privacy.html">Privacy</a><a href="mailto')],
    ["the footer link goes to another address", () => sw(html, '<a href="' + LINK + '">Privacy</a><a href="mailto', '<a href="https://example.com/privacy.html">Privacy</a><a href="mailto')],
    ["the footer link opens a new tab", () => sw(html, '<a href="' + LINK + '">Privacy</a><a href="mailto', '<a href="' + LINK + '" target="_blank">Privacy</a><a href="mailto')],
    ["the footer link is gone", () => sw(html, '<a href="' + LINK + '">Privacy</a><a href="mailto', '<a href="mailto')],
    ["a third link to the website is added to the footer", () => sw(html, "</footer>", '<a href="' + LINK + '">Privacy</a></footer>')],
    ["the robots tag says index, follow", () => sw(html, NOINDEX, INDEXABLE)],
    ["the robots tag says only noindex", () => sw(html, NOINDEX, '<meta name="robots" content="noindex">')],
    ["a second robots tag is added", () => sw(html, NOINDEX, NOINDEX + "\n" + INDEXABLE)],
    ["the footer contact is gone", () => sw(html, '<a href="mailto:privacy@fightghostjobs.com">privacy@fightghostjobs.com</a>', "")],
    ["the header loses a link", () => sw(html, '    <a href="search.html">Search Openings</a>\n', "")],
    ["the title is changed", () => sw(html, "<title>FightGhostJobs | Privacy</title>", "<title>Privacy Policy</title>")],
    ["the indexing tag is gone", () => sw(html, '<meta name="robots" content="noindex, nofollow">\n', "")],
    ["the content security policy tag is gone", () => html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n/, "")],
  ];
  const missed = [];
  for (const [what, f] of BREAK) { if (!findings(f(), other).length) missed.push(what); }
  assert.deepEqual(missed, [], "breakages the findings missed");
  assert.ok(BREAK.length >= 10);
  const PLANT = [() => sw(html, "</head>", "<!-- nothing -->\n</head>"), () => sw(html, "<footer", "\n\n<footer"), () => sw(html, "<body>", "<body><!-- a comment about nothing -->")];
  for (const f of PLANT) assert.deepEqual(findings(f(), other), [], "a plant at nothing was flagged");
});

// ---------------------------------------------------------------- PART 1b (prompt FO): the indexing tool in its on position on a copy of the repo leaves this page noindex, nofollow
const copyRepo = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-pp-")); fs.cpSync(ROOT, d, { recursive: true, filter: (s) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(s) }); return d; };
let toolN = 0;
async function toolOn(mutate) {
  const dir = copyRepo();
  try {
    if (mutate) mutate(dir);
    const before = (fs.readFileSync(path.join(dir, "privacy.html"), "utf8").match(/<meta name="robots" content="[^"]*">/g) || []).join("");
    const cfg = path.join(dir, "js", "config.js"); fs.writeFileSync(cfg, fs.readFileSync(cfg, "utf8").replace("ALLOW_INDEXING = false;", "ALLOW_INDEXING = true;"));
    const tool = await import(pathToFileURL(path.join(dir, "tests", "apply-indexing.js")).href + "?n=" + (++toolN));
    const changed = tool.applyIndexing(dir).sort();
    const tags = (f) => (fs.readFileSync(path.join(dir, f), "utf8").match(/<meta name="robots" content="[^"]*">/g) || []).join("");
    return { before, changed, privacy: tags("privacy.html"), home: tags("index.html"), others: ["search.html", "dashboard.html"].map(tags) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const toolFindings = (r) => {
  const bad = [];
  if (r.before !== NOINDEX) bad.push("before the tool runs the page does not carry exactly noindex, nofollow: " + r.before);
  if (r.privacy !== NOINDEX) bad.push("after the tool runs in its on position the page carries " + (r.privacy || "no robots tag") + ", not noindex, nofollow");
  if (r.changed.includes("privacy.html")) bad.push("the tool rewrote privacy.html");
  if (r.home !== INDEXABLE || !r.changed.includes("index.html") || !r.changed.includes("robots.txt")) bad.push("the one public page and robots.txt did not follow the flag as before (home: " + r.home + ", changed: " + r.changed.join(", ") + ")");
  if (r.others.some((x) => x !== NOINDEX)) bad.push("a page that needs a sign-in became indexable");
  return bad;
};
test("PART 1b: the indexing tool in its on position leaves the app's own privacy page noindex, nofollow, and still makes the home page and robots.txt follow the flag", { timeout: 300000 }, async () => {
  assert.deepEqual(toolFindings(await toolOn()), []);
});
test("PART 1b: breakages of the indexing setup are caught, a plant at nothing is not", { timeout: 600000 }, async () => {
  const sw = (t, a, b) => { if (t.split(a).length !== 2) throw new Error("anchor not found once: " + a.slice(0, 50)); return t.replace(a, () => b); };
  const edit = (rel, fn) => (dir) => { const p = path.join(dir, rel); fs.writeFileSync(p, fn(fs.readFileSync(p, "utf8"))); };
  const BREAK = [
    ["the tool lists the privacy page as public again (the flag position makes it indexable)", edit("tests/apply-indexing.js", (s) => sw(s, 'PUBLIC_PAGES = ["index.html"];', 'PUBLIC_PAGES = ["index.html", "privacy.html"];'))],
    ["the tool lists every page as public", edit("tests/apply-indexing.js", (s) => sw(s, 'PUBLIC_PAGES = ["index.html"];', 'PUBLIC_PAGES = ["index.html", "privacy.html", "search.html", "dashboard.html"];'))],
    ["the page says index, follow before the tool runs", edit("privacy.html", (s) => sw(s, NOINDEX, INDEXABLE))],
    ["the page has no robots tag before the tool runs", edit("privacy.html", (s) => sw(s, NOINDEX + "\n", ""))],
    ["the page says only noindex before the tool runs", edit("privacy.html", (s) => sw(s, NOINDEX, '<meta name="robots" content="noindex">'))],
    ["the tool no longer makes the home page follow the flag", edit("tests/apply-indexing.js", (s) => sw(s, "allow ? INDEXABLE : NOINDEX", "NOINDEX"))],
  ];
  const missed = [];
  for (const [what, m] of BREAK) { const r = await toolOn(m); if (!toolFindings(r).length) missed.push(what); }
  assert.deepEqual(missed, [], "breakages the findings missed");
  assert.ok(BREAK.length >= 3);
  const PLANT = [edit("tests/apply-indexing.js", (s) => s + "\n// a comment about nothing\n"), edit("privacy.html", (s) => sw(s, "</head>", "<!-- nothing -->\n</head>"))];
  for (const m of PLANT) assert.deepEqual(toolFindings(await toolOn(m)), [], "a plant at nothing was flagged");
});

// ---------------------------------------------------------------- PART 2: a real browser
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const STATE = `(() => { const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left * 100) / 100, Math.round((b.top + scrollY) * 100) / 100, Math.round(b.width * 100) / 100, Math.round(b.height * 100) / 100]; };
  const main = document.querySelector("main"), pg = main.querySelector(".pg"), h1 = pg.querySelector("h1"), p = pg.querySelector("p"), a = p.querySelector("a"), foot = document.querySelector(".site-footer"), hd = document.querySelector("header.nav");
  const hs = getComputedStyle(h1), ps = getComputedStyle(p), as = getComputedStyle(a);
  const ref = document.createElement("p"); ref.className = "privacy-p"; ref.textContent = "x"; pg.append(ref); const rs = getComputedStyle(ref); const refFont = rs.fontSize + "|" + rs.color + "|" + rs.lineHeight; ref.remove();
  return { children: Array.from(document.body.children).map((e) => e.tagName.toLowerCase() + (e.className ? "." + String(e.className).split(" ")[0] : "")).join(","), mainKids: Array.from(pg.children).map((e) => e.tagName.toLowerCase()).join(","), mainChildren: Array.from(main.children).map((e) => e.tagName.toLowerCase() + "." + (e.className || "")).join(","),
    h1: h1.textContent, p: p.textContent, href: a.getAttribute("href"), target: a.getAttribute("target"), linkText: a.textContent, decoration: as.textDecorationLine, h1Font: hs.fontSize + "|" + hs.fontWeight, pFont: ps.fontSize + "|" + ps.color + "|" + ps.lineHeight, refFont,
    h1Rect: r(h1), pRect: r(p), aRect: r(a), pgRect: r(pg), headRect: r(hd), footRect: r(foot), footText: foot.textContent, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, docH: document.documentElement.scrollHeight,
    cookie: document.cookie, keys: Object.keys(localStorage).sort().join(",") + "|" + Object.keys(sessionStorage).sort().join(","), hasNotice: !!document.getElementById("searchNotice"), headerVisible: hd.getClientRects().length > 0 }; })()`;

for (const width of [360, 768, 1093, 1440]) {
  test("PART 2 at " + width + " px: the link-only page shows the header, the heading, the one sentence and the footer, nothing else; no sideways scroll; the app's own styles; same tab link", async () => {
    const site = await startFakeSite(ROOT), tab = await browser.newTab(), bad = [];
    try {
      await tab.focusEmulation(true);
      const phone = width < 700;
      await tab.viewport(width, phone, phone ? 700 : 900);
      await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
      const before0 = site.calls.length;
      await tab.goto(site.url + "/privacy.html"); await tab.waitFor("document.readyState === 'complete' && !!document.querySelector('main .pg')", 10000); await sleep(600);
      await tab.viewport(width, phone, phone ? 700 : 900); await sleep(300);
      const s = await tab.eval(STATE);
      if (s.sw > s.cw + 0.5) bad.push("the page scrolls sideways (" + s.sw + " vs " + s.cw + ")");
      if (!s.headerVisible) bad.push("the header is not shown");
      if (s.mainKids !== "h1,p") bad.push("the content holds more than the heading and the one paragraph: " + s.mainKids);
      if (s.mainChildren !== "div.pg") bad.push("the main region holds more than the one content box: " + s.mainChildren);
      if (!/^header\.nav,main|^a\.skip-link,header\.nav,main/.test(s.children) || !/footer\.site-footer/.test(s.children)) bad.push("the page body is not the skip link, header, main, footer (and the script): " + s.children);
      if (s.h1 !== "Privacy Policy") bad.push("the heading is '" + s.h1 + "'");
      if (s.p !== "Our Privacy Policy is on the FightGhostJobs website.") bad.push("the sentence is '" + s.p + "'");
      if (s.href !== LINK || s.target !== null || s.linkText !== "Privacy Policy") bad.push("the link is wrong: " + s.href + " target " + s.target + " text " + s.linkText);
      if (s.decoration.indexOf("underline") < 0) bad.push("the link is not underlined like the other links in the main area");
      if (s.pFont !== s.refFont) bad.push("the sentence does not use the app's own paragraph style (" + s.pFont + " vs " + s.refFont + ")");
      if (s.h1Font !== "32px|700") bad.push("the heading is not the app's page heading size: " + s.h1Font);
      if (s.aRect[0] < s.pRect[0] - 0.5 || s.aRect[0] + s.aRect[2] > s.pRect[0] + s.pRect[2] + 0.5) bad.push("the link sticks out of the sentence's box");
      if (s.pRect[1] < s.h1Rect[1] + s.h1Rect[3] - 0.5) bad.push("the sentence is not under the heading");
      if (s.footRect[1] < s.pRect[1] + s.pRect[3] - 0.5) bad.push("the footer is not under the sentence");
      if (!/privacy@fightghostjobs\.com/.test(s.footText)) bad.push("the footer has no privacy contact");
      if (s.cookie !== "") bad.push("a cookie exists: " + s.cookie);
      if (/fgj-(?!auth)/.test(s.keys.replace(/\|.*/, ""))) bad.push("a storage key appeared: " + s.keys);
      if (s.hasNotice) bad.push("the search notice is on this page");
      const names = site.calls.slice(before0).map((c) => c.name);
      if (names.length) bad.push("the page made backend requests: " + names.join(","));
      // a click on the link: same tab, to the marketing address (the fake site answers every other address with its 404 page, so the address is read before the navigation completes)
      const to = await tab.eval(`(() => { const a = document.querySelector("main a"); let to = null; a.addEventListener("click", (e) => { to = a.href; e.preventDefault(); }, { once: true }); a.click(); return to; })()`);
      if (to !== LINK) bad.push("a click goes to " + to);
    } finally { await tab.close(); await site.close(); }
    assert.deepEqual(bad, []);
  });
}
