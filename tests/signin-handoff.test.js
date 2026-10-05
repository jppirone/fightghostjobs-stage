// signin-handoff.test.js - the pure parts of the sign-in hand-off between tabs (js/signin-handoff.js, js/landing-notice.js). The real two-tab behavior is proven in tests/signin-tabs.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HANDOFF_TTL_MS, PENDING_SEARCH_KEY, LANDING_PAGE_KEY, savePending, takePending, hasPending, saveLanding, takeLanding, clearHandoff, watchSignIn } from "../js/signin-handoff.js";
import { LANDING_NOTICE_ENABLED, LANDING_TEXT, BOTH_ROLES_TEXT, markLanded, takeLanded, landingText, roleNoteKind, landingKindForPage } from "../js/landing-notice.js";

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
const NOW = 1_800_000_000_000;

test("a saved search lasts one hour, is used once, and is removed when used", () => {
  assert.equal(HANDOFF_TTL_MS, 3600000);
  const s = memory();
  assert.equal(savePending(s, { company: "Meridian Health", q: "Analyst", r: "4471" }, NOW), true);
  assert.equal(hasPending(s, NOW + 1000), true);
  assert.deepEqual(takePending(s, NOW + 59 * 60000), { company: "Meridian Health", q: "Analyst", r: "4471" });
  assert.equal(s.getItem(PENDING_SEARCH_KEY), null, "removed once used");
  assert.equal(takePending(s, NOW + 59 * 60000), null, "cannot be used twice");
});
test("a saved search past its expiry is not returned and is removed", () => {
  const s = memory();
  savePending(s, { company: "A", q: "b", r: "" }, NOW);
  assert.equal(hasPending(s, NOW + HANDOFF_TTL_MS + 1), false);
  assert.equal(takePending(s, NOW + HANDOFF_TTL_MS + 1), null);
  assert.equal(s.getItem(PENDING_SEARCH_KEY), null);
});
test("damaged, wrong-shaped or oversized entries are refused and removed; nothing throws", () => {
  const s = memory();
  s.setItem(PENDING_SEARCH_KEY, "{not json"); assert.equal(takePending(s, NOW), null); assert.equal(s.getItem(PENDING_SEARCH_KEY), null);
  s.setItem(PENDING_SEARCH_KEY, JSON.stringify({ v: { company: 1, q: "x", r: "" }, exp: NOW + 5000 })); assert.equal(takePending(s, NOW), null);
  s.setItem(PENDING_SEARCH_KEY, JSON.stringify({ v: { company: "a", q: "b", r: "" } })); assert.equal(takePending(s, NOW), null, "no expiry means not valid");
  assert.equal(savePending(s, { company: "x".repeat(301), q: "b", r: "" }, NOW), false);
  assert.equal(savePending(s, null, NOW), false);
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  assert.equal(savePending(broken, { company: "a", q: "b", r: "" }, NOW), false);
  assert.equal(takePending(broken, NOW), null);
});
test("the landing page is only a plain same-site page name, used once, expiring in an hour", () => {
  const s = memory();
  assert.equal(saveLanding(s, "https://evil.example/", NOW), false);
  assert.equal(saveLanding(s, "javascript:alert(1)", NOW), false);
  assert.equal(saveLanding(s, "//evil.example/x.html", NOW), false);
  assert.equal(saveLanding(s, "comments.html?ref=abc123", NOW), true);
  assert.equal(takeLanding(s, NOW + 1000), "comments.html?ref=abc123");
  assert.equal(takeLanding(s, NOW + 1000), null);
  saveLanding(s, "search.html", NOW); assert.equal(takeLanding(s, NOW + HANDOFF_TTL_MS + 1), null);
  s.setItem(LANDING_PAGE_KEY, JSON.stringify({ v: "https://evil.example/", exp: NOW + 5000 })); assert.equal(takeLanding(s, NOW), null, "a tampered stored value is refused");
});
test("clearHandoff (sign out) removes both", () => {
  const s = memory(); savePending(s, { company: "a", q: "b", r: "" }, NOW); saveLanding(s, "search.html", NOW);
  clearHandoff(s); assert.equal(s._m.size, 0);
});

function fakeWindow() {
  const l = {}; const doc = { visibilityState: "visible", _l: {}, addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); }, removeEventListener(t, f) { this._l[t] = (this._l[t] || []).filter((x) => x !== f); } };
  return { win: { addEventListener(t, f) { (l[t] = l[t] || []).push(f); }, removeEventListener(t, f) { l[t] = (l[t] || []).filter((x) => x !== f); }, fire(t, ev) { for (const f of (l[t] || []).slice()) f(ev || {}); }, count: (t) => (l[t] || []).length }, doc };
}
const flush = () => new Promise((r) => setTimeout(r, 5));

test("watchSignIn: a storage event for the session key makes it check, call once, and stop listening", async () => {
  const { win, doc } = fakeWindow(); let session = null; const got = [];
  watchSignIn({ win, doc, storageKey: "fgj-auth", check: async () => session, onSignedIn: (s) => got.push(s) });
  win.fire("storage", { key: "other" }); await flush(); assert.equal(got.length, 0, "another key is ignored");
  win.fire("storage", { key: "fgj-auth" }); await flush(); assert.equal(got.length, 0, "no session yet");
  session = { isCandidate: true };
  win.fire("storage", { key: "fgj-auth" }); win.fire("storage", { key: "fgj-auth" }); await flush();
  assert.equal(got.length, 1, "called once");
  assert.equal(win.count("storage"), 0); assert.equal(win.count("focus"), 0); assert.equal(doc._l.visibilitychange.length, 0, "listeners removed");
});
test("watchSignIn: coming back to the tab (focus, or visible again) is checked too; a hidden tab is not", async () => {
  const { win, doc } = fakeWindow(); let session = { isPoster: true }; const got = [];
  watchSignIn({ win, doc, storageKey: "k", check: async () => session, onSignedIn: (s) => got.push(s) });
  doc.visibilityState = "hidden"; for (const f of doc._l.visibilitychange.slice()) f(); await flush(); assert.equal(got.length, 0, "hidden: not checked");
  doc.visibilityState = "visible"; for (const f of doc._l.visibilitychange.slice()) f(); await flush(); assert.equal(got.length, 1);
});
test("watchSignIn: a session the page does not accept (an employer on a candidate page) keeps the watch alive", async () => {
  const { win, doc } = fakeWindow(); let session = { isPoster: true, isCandidate: false }; const got = [];
  watchSignIn({ win, doc, storageKey: "k", check: async () => session, onSignedIn: (s) => got.push(s), accept: (s) => s.isCandidate });
  win.fire("storage", { key: "k" }); await flush(); assert.equal(got.length, 0); assert.equal(win.count("storage"), 1);
  session = { isPoster: true, isCandidate: true }; win.fire("storage", { key: "k" }); await flush(); assert.equal(got.length, 1);
});
test("watchSignIn: a failing check does not break the watch; stop() removes the listeners", async () => {
  const { win, doc } = fakeWindow(); let n = 0; const got = [];
  const stop = watchSignIn({ win, doc, storageKey: "k", check: async () => { n++; throw new Error("storage blocked"); }, onSignedIn: (s) => got.push(s) });
  win.fire("storage", { key: null }); await flush(); assert.equal(n, 1); assert.equal(got.length, 0);
  stop(); assert.equal(win.count("storage"), 0);
});

test("the landing note is ON with the wording John approved (October 4, 2026), and only shows for the kind of sign-in the page serves", () => {
  assert.equal(LANDING_NOTICE_ENABLED, true);
  assert.equal(LANDING_TEXT.candidate, "You are signed in. You can close this tab and go back to the one you started from, or keep searching here.");
  assert.equal(LANDING_TEXT.poster, "You are signed in. You can close this tab and go back to the one you started from, or keep working here.");
  assert.equal(landingText("candidate"), LANDING_TEXT.candidate);
  assert.equal(landingText("candidate", false), null, "the switch still works");
  assert.equal(landingText("candidate", true), LANDING_TEXT.candidate);
  assert.equal(landingText("poster", true), LANDING_TEXT.poster);
  assert.equal(landingText("other", true), null);
  assert.ok(!/[—]/.test(LANDING_TEXT.candidate + LANDING_TEXT.poster), "no em dash");
  const s = memory(); markLanded(s, "candidate"); assert.equal(takeLanded(s), "candidate"); assert.equal(takeLanded(s), null, "shown once");
  s.setItem("fgj-landed", "<b>x</b>"); assert.equal(takeLanded(s), null, "unknown values are ignored");
});

test("the both-roles note: exact wording, and it is chosen for a session with BOTH claims only", () => {
  assert.equal(BOTH_ROLES_TEXT, "This address is also registered as an employer, so the employer buttons show above. Searching here works as a candidate.");
  assert.ok(!/[\u2014]/.test(BOTH_ROLES_TEXT), "no em dash");
  assert.equal(roleNoteKind({ isPoster: true, isCandidate: true }), "both");
  assert.equal(roleNoteKind({ isPoster: true, isCandidate: false }), "employer", "an employer-only session keeps its own notice");
  assert.equal(roleNoteKind({ isPoster: false, isCandidate: true }), null, "a candidate-only session gets no note");
  assert.equal(roleNoteKind(null), null);
  assert.equal(roleNoteKind({}), null);
});

test("which landing wording a page gets: by the page, not the role (employer pages, search, the two kinds of comments page)", () => {
  for (const p of ["dashboard.html", "analytics.html", "team.html", "edit.html", "register.html"]) assert.equal(landingKindForPage("/" + p, ""), "poster", p);
  assert.equal(landingKindForPage("/search.html", ""), "candidate");
  assert.equal(landingKindForPage("/comments.html", "?ref=d21m48ybzqbfxxxxxxxx"), "candidate");
  assert.equal(landingKindForPage("/comments.html", "?id=3f1d5b1e-0000-4000-8000-000000000001"), "poster");
  assert.equal(landingKindForPage("/comments.html", ""), null);
  assert.equal(landingKindForPage("/index.html", ""), null);
  assert.equal(landingKindForPage("/employer-signin.html", ""), null);
  assert.equal(landingKindForPage("", ""), null);
});
