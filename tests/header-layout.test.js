// header-layout.test.js - the top bar in a REAL browser, on the REAL page files, at phone widths (October 4, 2026).
//
// Why: the static rules (site-check.js) can only read the stylesheet; they cannot see a header that runs off the right edge of a phone. This test serves the repo's own files on 127.0.0.1 with a tiny fake
// backend (the sign-in link and the employer-session answer only; no real project, no key), starts a headless Chrome or Edge with PHONE emulation (touch, mobile viewport, device pixel ratio 2, as the
// browser's device toolbar does), and measures the header at 320, 360, 375, 390 and 414 on every kind of page, signed in as an employer and signed out.
//
// For every page and width the header must: not be wider than the window (its own scroll width, and it must add nothing to the document's horizontal scrolling); keep every control (logo, wordmark,
// the three links, My postings, Analytics, Team, the initials circle, Sign out, Register) inside the window; keep the controls that belong on the page present and visible; be at most 150 pixels
// tall (about 105 signed out at 360 and wider); give every control a 44 pixel touch target; and carry text-size-adjust 100% (a phone browser must not inflate the header text). With the initials label open,
// the label must also stay inside the window. A second part (negative controls) injects one deliberate defect at a time and proves the checks above catch it.
//
// A missing browser is a FAILED test, never a skipped one (set FGJ_BROWSER to a Chrome or Edge executable). Run: node --test tests/header-layout.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REAL = "https://tpmvkjuhbbwftqoodzcn.supabase.co";
const WIDTHS = [320, 360, 375, 390, 414];
const WIDE = [600, 768, 1024, 1280];   // not phones: only "nothing overflows" is asked of them
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".json": "application/json" };
const EDIT = "edit.html?id=3f1d5b1e-0000-4000-8000-000000000001";
const SIGNED_OUT = ["index.html", "search.html", "employer-signin.html", "register.html", "privacy.html"];
const SIGNED_IN = ["dashboard.html", "search.html", EDIT, "analytics.html", "team.html"];
// long on purpose: only the initials circle's label shows them, and the label must stay inside the window
const LONG_NAME = "Bartholomew Featherstonehaugh-Wolverhampton", LONG_ORG = "Meridian Health Systems of the Greater Providence and Boston Region";

// ---- a tiny fake backend + the repo's files -------------------------------------------------------------------------------------------------------------------------------------------------------------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (claims) => b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: "00000000-0000-4000-8000-000000000001", role: "authenticated", aud: "authenticated", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...claims }) + ".sig";
let server, SELF = "", browser = null;

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://x");
      const send = (status, body, type) => { res.writeHead(status, { "Content-Type": type || "application/json", "Cache-Control": "no-store" }); res.end(typeof body === "string" ? body : JSON.stringify(body)); };
      if (url.pathname === "/functions/v1/poster-session") return send(200, { poster: { poster_id: "00000000-0000-4000-8000-0000000000aa", full_name: LONG_NAME, is_org_admin: true }, organization: { organization_id: "00000000-0000-4000-8000-0000000000bb", name: LONG_ORG }, verified_at: new Date().toISOString(), reverify_by: new Date(Date.now() + 30 * 864e5).toISOString(), plan: { verified: false, source: null, expires_at: null, lapsed: false } });
      if (url.pathname.startsWith("/functions/v1/")) return send(200, {});
      if (url.pathname === "/auth/v1/user") return send(200, { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "dana@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
      if (url.pathname === "/auth/v1/logout") { res.writeHead(204); return res.end(); }
      if (url.pathname === "/_dev/link") {
        const frag = new URLSearchParams({ access_token: jwt({ poster_id: crypto.randomUUID(), email: "dana@example.test" }), refresh_token: "refresh-poster", expires_in: "3600", token_type: "bearer", type: "magiclink" }).toString();
        res.writeHead(302, { Location: "/auth-callback.html#" + frag }); return res.end();
      }
      let rel = decodeURIComponent(url.pathname); if (rel.endsWith("/")) rel += "index.html";
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { "Content-Type": MIME[".html"] }); return res.end("not found"); }
      const ext = path.extname(file);
      let data = fs.readFileSync(file);
      if ([".html", ".js", ".mjs"].includes(ext)) data = Buffer.from(data.toString("utf8").split(REAL).join(SELF));
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(data);
    });
    server.listen(0, "127.0.0.1", () => { SELF = "http://127.0.0.1:" + server.address().port; resolve(); });
  });
}

// ---- the browser: the shared launcher (tests/cdp-tabs.js, one browser with one tab); close() closes the whole browser, bounded, and removes its profile folder (October 10, 2026, prompt BB2) --------------------------------
async function openBrowser() {
  const b = await launchBrowser();
  const tab = await b.newTab();
  // phone: touch, mobile viewport, device pixel ratio 2 (what the device toolbar does); wide: an ordinary window
  return { viewport: (width, phone) => tab.viewport(width, phone), goto: (url, timeoutMs) => tab.goto(url, timeoutMs), eval: (expression) => tab.eval(expression), waitFor: (expr, ms) => tab.waitFor(expr, ms), close: () => b.close() };
}

// ---- what is measured in the page ------------------------------------------------------------------------------------------------------------------------------------------------------------------
const MEASURE = `(async () => {
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const de = document.documentElement, hd = document.querySelector("header.nav");
  if (!hd) return { noHeader: true };
  const R = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const label = (e) => (e.getAttribute("aria-label") || e.textContent || e.getAttribute("class") || e.tagName).trim().replace(/\\s+/g, " ").slice(0, 28);
  const controls = [];
  const add = (kind, e, target) => {
    if (!e) return;
    const cs = getComputedStyle(e), box = R(e);
    let pw = 0, ph = 0;
    if (target) { const ps = getComputedStyle(e, "::before"); if (ps.content !== "none") { pw = px(ps.width); ph = px(ps.height); } }
    controls.push({ kind, name: label(e), box, shown: cs.display !== "none" && cs.visibility !== "hidden" && box.w > 0 && box.h > 0, hitW: Math.max(box.w, pw), hitH: Math.max(box.h, ph), target: !!target });
  };
  add("logo", hd.querySelector(".nav-logo"), true); add("mark", hd.querySelector(".nav-mark")); add("wordmark", hd.querySelector(".nav-wordmark"));
  hd.querySelectorAll(".nav-links a").forEach((a) => add("link", a, true));
  const acct = hd.querySelector("#navAccount");
  const kids = acct ? Array.from(acct.querySelectorAll("a, button")) : [];
  kids.forEach((c) => add(c.classList.contains("avatar-btn") ? "circle" : "button", c, true));
  const wm = hd.querySelector(".nav-wordmark");
  const hdrBox = R(hd);
  const sw = de.scrollWidth;
  const prev = hd.style.display; hd.style.display = "none"; const swNoHeader = de.scrollWidth; hd.style.display = prev;
  const circle = hd.querySelector(".avatar-btn"), pop = hd.querySelector(".account-pop");
  let popBox = null;
  if (circle && pop) { circle.click(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); popBox = R(pop); popBox.shown = getComputedStyle(pop).display !== "none"; circle.click(); }
  return { vw: de.clientWidth, scrollWidth: sw, scrollWidthNoHeader: swNoHeader, headerClientW: hd.clientWidth, headerScrollW: hd.scrollWidth, headerH: hdrBox.h, controls, signedIn: !!circle,
    wordmarkClipped: wm ? wm.scrollWidth > wm.clientWidth + 1 : false, tsa: getComputedStyle(de).getPropertyValue("-webkit-text-size-adjust") || getComputedStyle(de).getPropertyValue("text-size-adjust"), popBox };
})()`;

// ---- the rule: what is wrong with one measurement (an empty list is a pass) ----------------------------------------------------------------------------------------------------------------
export function problems(m, { width, phone, signedIn }) {
  const P = [];
  if (m.noHeader) return ["the page has no header.nav"];
  const eps = 0.5;
  if (m.headerScrollW > m.headerClientW + eps) P.push("the header is wider than its own box (scroll width " + m.headerScrollW + " > " + m.headerClientW + ")");
  if (m.scrollWidth > m.scrollWidthNoHeader + eps) P.push("the header adds horizontal scrolling to the page (" + m.scrollWidth + " with it, " + m.scrollWidthNoHeader + " without)");
  if (m.headerClientW > m.vw + eps) P.push("the header is wider than the window");
  for (const c of m.controls) {
    if (!c.shown) continue;
    if (c.box.r > m.vw + eps) P.push(c.kind + " '" + c.name + "' runs past the right edge (" + Math.round(c.box.r) + " > " + m.vw + ")");
    if (c.box.l < -eps) P.push(c.kind + " '" + c.name + "' runs past the left edge (" + Math.round(c.box.l) + ")");
  }
  if (m.wordmarkClipped) P.push("the wordmark text is clipped (the logo is not whole)");
  const need = (kind, n) => { const got = m.controls.filter((c) => c.kind === kind && c.shown).length; if (got < n) P.push("expected " + n + " visible " + kind + " control(s), found " + got); };
  need("logo", 1); need("wordmark", 1); need("link", 3);
  if (signedIn) {
    need("circle", 1);
    for (const t of ["My openings", "Analytics", "Team", "Sign out"]) if (!m.controls.some((c) => c.kind === "button" && c.name === t && c.shown)) P.push("'" + t + "' is missing or hidden");
  }
  if (phone) {
    // touch targets: 44 pixels both ways (the drawn size or its invisible margin)
    for (const c of m.controls) if (c.shown && c.target && (c.hitW < 43.5 || c.hitH < 43.5)) P.push(c.kind + " '" + c.name + "' touch target is " + Math.round(c.hitW) + " x " + Math.round(c.hitH) + " (needs 44 x 44)");
    const ceiling = signedIn ? 150 : (width >= 360 ? 105 : 150);
    if (m.headerH > ceiling + eps) P.push("the header is " + Math.round(m.headerH) + " pixels tall (at most " + ceiling + ")");
    if (!/^100%$/.test(String(m.tsa).trim())) P.push("text-size-adjust is '" + m.tsa + "' (must be 100% so a phone browser does not inflate the header text)");
    if (m.popBox && m.popBox.shown && (m.popBox.l < -eps || m.popBox.r > m.vw + eps)) P.push("the open initials label runs outside the window (" + Math.round(m.popBox.l) + " to " + Math.round(m.popBox.r) + " of " + m.vw + ")");
  }
  return P;
}

// ---- the matrix ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
before(async () => { await startServer(); browser = await openBrowser(); });
after(async () => { if (browser) await browser.close(); if (server) await new Promise((r) => server.close(r)); });

async function load(page, signedIn) {
  await browser.goto(SELF + "/" + page);
  await browser.waitFor("document.readyState === 'complete' && !!document.querySelector('header.nav')");
  if (signedIn) assert.ok(await browser.waitFor("!!document.querySelector('.avatar-btn')", 8000), "signed in as an employer, " + page + " shows the initials circle");
  else await new Promise((r) => setTimeout(r, 500));
}
async function measureAt(width, phone) { await browser.viewport(width, phone); return browser.eval(MEASURE); }
async function signOutAll() { await browser.goto(SELF + "/404.html"); await browser.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}"); }
async function signInAsEmployer() {
  await browser.goto(SELF + "/_dev/link?kind=poster");
  assert.ok(await browser.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000), "the fake sign-in link led to a stored session");
  await new Promise((r) => setTimeout(r, 600));
}

test("the header fits at 320, 360, 375, 390 and 414 on every kind of page, signed out and signed in as an employer", { timeout: 240000 }, async () => {
  const bad = [];
  let measured = 0;
  const run = async (pages, signedIn) => {
    for (const page of pages) {
      for (const w of WIDTHS) {
        await browser.viewport(w, true);
        await load(page, signedIn);
        const m = await browser.eval(MEASURE); measured++;
        const found = problems(m, { width: w, phone: true, signedIn });
        if (signedIn !== m.signedIn) found.push("expected a " + (signedIn ? "signed in" : "signed out") + " header");
        for (const f of found) bad.push((signedIn ? "signed in " : "signed out ") + page.replace(/\?.*/, "") + " at " + w + ": " + f);
      }
      // wider windows: nothing may overflow (the phone-only rules do not apply)
      for (const w of WIDE) {
        await browser.viewport(w, false);
        await load(page, signedIn);
        const m = await browser.eval(MEASURE); measured++;
        for (const f of problems(m, { width: w, phone: false, signedIn })) bad.push((signedIn ? "signed in " : "signed out ") + page.replace(/\?.*/, "") + " at " + w + ": " + f);
      }
    }
  };
  await signOutAll();
  await run(SIGNED_OUT, false);
  await signInAsEmployer();
  await run(SIGNED_IN, true);
  assert.equal(measured, (SIGNED_OUT.length + SIGNED_IN.length) * (WIDTHS.length + WIDE.length), "every page and width was measured");
  assert.deepEqual(bad, [], "header problems:\n" + bad.join("\n"));
});

// ---- negative controls: one deliberate defect at a time; the rule above must catch each --------------------------------------------------------------------------------------
const CONTROLS = [
  ["the bar cannot wrap (everything on one row)", true, ".nav{flex-wrap:nowrap!important}"],
  ["the logo has a big minimum width", true, ".nav-logo{min-width:480px!important}"],
  ["the wordmark is huge", true, ".nav-wordmark{font-size:60px!important}"],
  ["the account buttons have a big minimum width", true, "#navAccount .btn-sm{min-width:200px!important}"],
  ["the account area is one wide row again", true, "#navAccount.nav-acct-area{display:flex!important;flex-wrap:nowrap!important;width:700px!important}"],
  ["the bar has big side padding", true, ".nav{padding:6px 90px!important}"],
  ["the bar is wider than the window", true, ".nav{width:800px!important}"],
  ["the three links cannot wrap and have wide gaps", true, ".nav-links{flex-wrap:nowrap!important;gap:0 60px!important}.nav-links a{white-space:nowrap!important}"],
  ["Sign out is hidden", true, "#navAccount .btn-ghost{display:none!important}"],
  ["Team is hidden", true, "#navAccount a[href='team.html']{display:none!important}"],
  ["the links have a small touch target", true, ".nav-links a{min-height:20px!important}"],
  ["the buttons have a small touch target", true, "#navAccount .btn-sm::before{inset:0!important}"],
  ["the circle has a small touch target", true, ".avatar-btn::before{inset:0!important}"],
  ["the initials label opens off the left edge", true, ".account-pop{left:-300px!important;right:auto!important;top:60px!important}"],
  ["a phone browser may inflate the text again", true, "html{-webkit-text-size-adjust:auto!important;text-size-adjust:auto!important}"],
  ["the signed-out Register button has a big minimum width", false, "#navAccount .btn-sm{min-width:300px!important}"],
  ["the signed-out bar cannot wrap", false, ".nav{flex-wrap:nowrap!important}"],
  ["the signed-out bar is very tall (big padding)", false, ".nav{padding:40px 12px!important}"],
];
test("negative controls: the header rule catches each deliberate defect", { timeout: 240000 }, async () => {
  const missed = [];
  await signOutAll();
  for (const signedIn of [false, true]) {
    if (signedIn) await signInAsEmployer();
    for (const [label, forSignedIn, css] of CONTROLS) {
      if (forSignedIn !== signedIn) continue;
      await browser.viewport(375, true);
      await load(signedIn ? "dashboard.html" : "index.html", signedIn);
      await browser.eval("(() => { const s = document.createElement('style'); s.id = 'ctl'; s.textContent = " + JSON.stringify(css) + "; document.head.append(s); })()");
      const m = await browser.eval(MEASURE);
      const found = problems(m, { width: 375, phone: true, signedIn });
      if (found.length === 0) missed.push(label);
      else console.log("caught  " + label + "  (" + found[0] + ")");
    }
  }
  // and the same page without a defect is clean (the controls are not just noise)
  await load("dashboard.html", true);
  assert.deepEqual(problems(await measureAt(375, true), { width: 375, phone: true, signedIn: true }), [], "the unmodified signed-in page is clean at 375");
  assert.deepEqual(missed, [], "defects the header rule did NOT catch: " + missed.join("; "));
});
