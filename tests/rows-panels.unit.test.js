// rows-panels.unit.test.js - the Recruiter firms rows and the AI and hiring policy link row (prompt BC and its addition BC1, October 10, 2026): the pure models (rows, words, what an edit sends, every refusal), the new api calls and
// their strict answer checks, and the two panels on a tiny fake DOM (the shared rows panel, js/row-panel.js). The destination links rows are in tests/linkpanel.test.js and run on the SAME shared panel. Nothing here touches a network.
import test from "node:test";
import assert from "node:assert/strict";
import { createApi, shapes, isAuthFailure } from "../js/api.js";
import { all, byClass, byTag, text, serialize, btn, rowEl, win, FEl } from "./fake-dom.js";
import { FP, firmRows, firmMeta, firmTitle, planFirmEdit, firmConfirmText, firmRefusal, firmSuccess, firmWarn, checkAria, editAria, removeAria } from "../js/firm-panel-model.js";
import { policyRows, policyRowMeta, policyRowNotice, planPolicyEdit, policyAria, POLICY_TITLE, POLICY_REMOVE_CONFIRM, POLICY_ROW_HINT } from "../js/policy-link.js";
import { applyLinks, recruiterFirms } from "../js/edit-form.js";
import { LP } from "../js/link-panel-model.js";
import { mountFirmPanel } from "../js/firm-panel.js";
import { mountPolicyPanel } from "../js/policy-panel.js";

const BASE = "https://example.test", KEY = "sb_publishable_TESTKEY", PID = "11111111-1111-4111-8111-111111111111";
const TICKET = "https://example.test/functions/v1/check-link-go/c1.AAAAAAAAAAAAAAAAAAAAAA.AAAAAA.AAAAAAAAAAAAAAAAAAAAAA";
const EXP = "2026-10-05T12:01:00+00:00";
const DOT = "·";
const mk = (handler) => { const calls = []; const api = createApi({ baseUrl: BASE, key: KEY, getToken: async () => "TOKEN.abc.def", fetchImpl: async (url, init) => { calls.push({ url, init, body: init && init.body ? JSON.parse(init.body) : null }); const r = await handler(url, init); return { ok: r.status < 300, status: r.status, headers: { get: (k) => (r.headers && r.headers[k]) || null }, text: async () => JSON.stringify(r.body) }; } }); return { api, calls }; };
const F = (position, name, extra) => Object.assign({ position, kind: "recruiter", firm: name, label: null, shown_as: "Employer's own site", check_status: "ok", check_http: 200 }, extra || {});
const FNO = (position, name) => ({ position, kind: "recruiter", firm: name, label: null, shown_as: null, check_status: null, check_http: null });
const A = (position, extra) => Object.assign({ position, kind: "apply", firm: null, label: null, shown_as: "LinkedIn", check_status: "ok", check_http: 200 }, extra || {});
const POL = (extra) => Object.assign({ position: 1, kind: "policy", firm: null, label: null, shown_as: "Employer's own site", check_status: "ok", check_http: 200 }, extra || {});
const FANSWER = (op, position, links, extra) => Object.assign({ posting_id: PID, kind: "recruiter", op, position, changed: true, active_links: links.length, links }, extra || {});
const PANSWER = (links, extra) => Object.assign({ posting_id: PID, kind: "policy", changed: true, active_links: links.length, links }, extra || {});

// ============================================================ the firm model
test("firm rows: one per named firm in position order by the STORED position; a gap stays a gap; apply links and the policy link are not rows; a fourth firm and bad entries are dropped", () => {
  const rows = firmRows([A(1), F(3, "Third Search Group"), POL(), F(1, "Acme Staffing"), FNO(2, "Name Only Partners"), F(4, "Too Many"), { position: 5, kind: "recruiter", firm: "" }, null]);
  assert.deepEqual(rows.map((r) => [r.position, r.title]), [[1, "Firm 1: Acme Staffing"], [2, "Firm 2: Name Only Partners"], [3, "Firm 3: Third Search Group"]]);
  assert.deepEqual(firmRows([F(1, "A"), F(3, "C")]).map((r) => r.title), ["Firm 1: A", "Firm 3: C"]);
  assert.deepEqual(firmRows([F(2, "B"), F(2, "Second B")]).map((r) => r.name), ["B"]);
  assert.deepEqual(firmRows(undefined), []); assert.deepEqual(firmRows([]), []);
  assert.equal(firmTitle(2, "  padded  "), "Firm 2: padded"); assert.equal(firmTitle(2, ""), "Firm 2");
});

test("firm rows: whether a firm has an address is read from shown_as only; the row carries no other field (an address could not ride in)", () => {
  const [a, b] = firmRows([F(1, "With", { url: "https://secret.example/x", url_enc: "x", link_id: "y" }), FNO(2, "Without")]);
  assert.equal(a.hasAddress, true); assert.equal(b.hasAddress, false);
  assert.deepEqual(Object.keys(a).sort(), ["checkFailed", "checkHttp", "hasAddress", "name", "position", "shownAs", "title"]);
  assert.doesNotMatch(JSON.stringify(a) + JSON.stringify(b), /secret\.example|url_enc|link_id/);
});

test("firm meta: what candidates see in the details window's own form, where it goes, the check that did not answer, and a plain sentence for a firm with no address", () => {
  const [a, b, c] = firmRows([F(1, "Acme Staffing"), FNO(2, "Name Only Partners"), F(3, "Third", { check_status: "failed", check_http: 404 })]);
  assert.deepEqual(firmMeta(a), ["Candidates see: Recruiter firm: Acme Staffing " + DOT + " Employer's own site"]);
  assert.deepEqual(firmMeta(b), ["Candidates see: Recruiter firm: Name Only Partners", "No address was added for this firm, so there is nothing to check."]);
  assert.deepEqual(firmMeta(c), ["Candidates see: Recruiter firm: Third " + DOT + " Employer's own site (did not answer when we checked: HTTP 404)"]);
  const [d] = firmRows([F(1, "No Number", { check_status: "failed", check_http: null })]);
  assert.match(firmMeta(d)[0], /\(did not answer when we checked\)$/);
});

test("firm accessible names: Check link for firm N, Edit firm N, Remove firm N", () => {
  assert.equal(checkAria(1), "Check link for firm 1"); assert.equal(editAria(2), "Edit firm 2"); assert.equal(removeAria(3), "Remove firm 3");
});

test("firm edit: a blank address keeps the address; the name is sent only when it differs; a blank name is refused; the same address rules as the other boxes", () => {
  assert.deepEqual(planFirmEdit("", "Acme Staffing", "Acme Staffing"), { ok: true, errors: {}, change: null, replacesAddress: false, changesName: false });
  assert.deepEqual(planFirmEdit("", "  Acme Talent  ", "Acme Staffing").change, { name: "Acme Talent" });
  assert.deepEqual(planFirmEdit("https://new.example/a", "Acme Staffing", "Acme Staffing").change, { url: "https://new.example/a" });
  assert.deepEqual(planFirmEdit(" https://new.example/a ", "Renamed", "Acme Staffing").change, { url: "https://new.example/a", name: "Renamed" });
  assert.equal(planFirmEdit("", "", "Acme").errors.second, "Enter the firm's name.");
  assert.match(planFirmEdit("", "n".repeat(201), "Acme").errors.second, /200 characters or fewer/);
  assert.match(planFirmEdit("", "Bad" + String.fromCharCode(7) + "Name", "Acme").errors.second, /plain text/);
  assert.equal(planFirmEdit("http://plain.example/a", "Acme", "Acme").errors.url, "The address must start with https://");
  assert.equal(planFirmEdit("https://", "Acme", "Acme").errors.url, "That does not look like a web address.");
  assert.match(planFirmEdit("https://x.example/" + "a".repeat(2050), "Acme", "Acme").errors.url, /2048 characters or fewer/);
});

test("firm edit: the confirm sentence says plainly what will change and that the other firms are not touched", () => {
  const p1 = planFirmEdit("https://n.example/a", "Acme", "Acme"), p2 = planFirmEdit("", "Acme Talent", "Acme"), p3 = planFirmEdit("https://n.example/a", "Acme Talent", "Acme");
  assert.equal(firmConfirmText(1, p1, "Acme"), "Replace the address for Firm 1: Acme? Candidates will be sent to the address you entered. Your other firms are not changed.");
  assert.equal(firmConfirmText(1, p2, "Acme"), "Change the name of Firm 1: Acme? The address is kept. Your other firms are not changed.");
  assert.match(firmConfirmText(1, p3, "Acme"), /The name is changed too\.$/);
  assert.equal(FP.removeConfirm(2, "Beta"), "Remove Firm 2: Beta? Candidates will no longer see it. Your other firms are not changed.");
});

test("firm refusals: plain words for every code, and what the page must do", () => {
  assert.equal(firmRefusal("edit", { code: "plan_required" }, isAuthFailure).stale, true);
  assert.equal(firmRefusal("edit", { code: "plan_required" }, isAuthFailure).text, LP.PLAN_REQUIRED);
  assert.equal(firmRefusal("edit", { code: "recruiter_off" }, isAuthFailure).text, FP.RECRUITER_OFF);
  assert.equal(firmRefusal("remove", { code: "link_not_found" }, isAuthFailure).text, FP.FIRM_GONE);
  assert.equal(firmRefusal("remove", { code: "link_not_found" }, isAuthFailure).where, "panel");
  assert.equal(firmRefusal("check", { code: "rate_limited", retryAfter: 30 }, isAuthFailure).text, "You are checking links too fast. Try again in 30 seconds.");
  assert.equal(firmRefusal("edit", { code: "rate_limited", retryAfter: 30 }, isAuthFailure).text, "Too many requests just now. Try again in 30 seconds.");
  assert.deepEqual([firmRefusal("edit", { errors: [{ field: "name", message: "name must not be empty" }] }, isAuthFailure).where, firmRefusal("edit", { errors: [{ field: "url", message: "the same url appears twice" }] }, isAuthFailure).where], ["second", "url"]);
  assert.equal(firmRefusal("edit", { code: "network" }, isAuthFailure).text, "Could not reach the server. Check your connection and try again.");
  assert.equal(firmRefusal("edit", { code: "bad_response" }, isAuthFailure).where, "row");
  assert.equal(firmRefusal("edit", { status: 401, code: "unauthorized" }, isAuthFailure).sessionEnded, true);
});

test("firm success words: a new address, a new name, removed, and the two no-change sentences; the check warning for an address that did not answer", () => {
  const rep = planFirmEdit("https://n.example/a", "Acme", "Acme"), ren = planFirmEdit("", "New", "Acme");
  assert.equal(firmSuccess("edit", { position: 2, changed: true }, rep), "Firm 2 has a new address.");
  assert.equal(firmSuccess("edit", { position: 2, changed: true }, ren), "Firm 2 was renamed.");
  assert.equal(firmSuccess("remove", { position: 2 }, null), "Firm 2 is no longer named.");
  assert.equal(firmSuccess("edit", { position: 2, changed: false }, rep), LP.SAME_ADDRESS);
  assert.equal(firmSuccess("edit", { position: 2, changed: false }, ren), "Nothing was changed.");
  assert.equal(firmWarn({ links: [F(2, "B", { check_status: "failed", check_http: 404 })] }, 2), "When we checked, the address answered HTTP 404. It is saved anyway. Make sure it is right.");
  assert.equal(firmWarn({ links: [F(2, "B")] }, 2), null);
  assert.equal(firmWarn({ links: [F(2, "B", { check_status: "failed", check_http: null })] }, 2), "When we checked, the address could not be reached. It is saved anyway. Make sure it is right.");
});

// ============================================================ the policy row model
test("policy row: one row when a link is stored, none otherwise; the stored check decides the lines and the amber notice", () => {
  assert.deepEqual(policyRows([]), []); assert.deepEqual(policyRows([A(1), F(1, "Firm")]), []); assert.deepEqual(policyRows(undefined), []);
  const [ok] = policyRows([A(1), POL()]), [failed] = policyRows([POL({ check_status: "failed", check_http: 404 })]), [unch] = policyRows([POL({ check_status: "skipped", check_http: null })]), [never] = policyRows([POL({ check_status: null, check_http: null })]);
  assert.deepEqual([ok.position, ok.title, ok.status], [1, POLICY_TITLE, "ok"]);
  assert.deepEqual(policyRowMeta(ok), ["Candidates see: AI and hiring policy: Employer's own site", "When we checked, the address answered."]);
  assert.equal(policyRowNotice(ok), null);
  assert.deepEqual(policyRowMeta(failed), ["Candidates see: nothing yet."]);
  assert.equal(policyRowNotice(failed).kind, "notice");
  assert.match(policyRowNotice(failed).text, /did not answer \(HTTP 404\)\. Candidates are not shown it\./);
  assert.match(policyRowNotice(unch).text, /could not be checked just now, so candidates are not shown it yet/);
  assert.equal(never.status, "unchecked");
  assert.deepEqual(Object.keys(ok).sort(), ["http", "position", "shownAs", "status", "title"]);
});

test("policy edit: the new address is required (there is nothing else to change) and checked like the box beside it", () => {
  assert.deepEqual(planPolicyEdit(" https://policy.example/p ").change, { url: "https://policy.example/p" });
  assert.equal(planPolicyEdit("").ok, false); assert.match(planPolicyEdit("").errors.url, /Enter the address of the page/);
  assert.match(planPolicyEdit("http://x.example/").errors.url, /must start with https/);
  assert.equal(policyAria.check, "Check link for AI and hiring policy link"); assert.equal(policyAria.edit, "Edit AI and hiring policy link"); assert.equal(policyAria.remove, "Remove AI and hiring policy link");
  assert.match(POLICY_ROW_HINT, /^The address is not shown on this page\./);
});

// ============================================================ the api
test("api: Check link for a firm and for the policy link send exactly the kind and position, no identity; a malformed request is refused before any call", async () => {
  const a = mk(() => ({ status: 200, body: { go_url: TICKET, expires_at: EXP } }));
  assert.equal((await a.api.checkRecruiterFirm(PID, 2)).ok, true);
  assert.deepEqual(a.calls[0].body, { posting_id: PID, kind: "recruiter", position: 2 }); assert.equal(a.calls[0].url, BASE + "/functions/v1/check-destination-link");
  assert.equal((await a.api.checkPolicyLink(PID)).ok, true);
  assert.deepEqual(a.calls[1].body, { posting_id: PID, kind: "policy", position: 1 });
  assert.doesNotMatch(a.calls[0].init.body + a.calls[1].init.body, /poster_id|organization_id|url/);
  for (const bad of [() => a.api.checkRecruiterFirm(PID, 4), () => a.api.checkRecruiterFirm(PID, 0), () => a.api.checkRecruiterFirm("nope", 1), () => a.api.checkPolicyLink("nope")]) { const r = await bad(); assert.equal(r.ok, false); assert.equal(r.error.code, "invalid_request"); }
  assert.equal(a.calls.length, 2);
});

test("api: edit and remove of ONE firm name the opening, kind recruiter, op and position; the address goes only when typed and the name only when given; nothing to change is refused before any call", async () => {
  const links = [F(1, "Acme"), F(2, "Beta Renamed")];
  const a = mk(() => ({ status: 200, body: FANSWER("edit", 2, links) }));
  assert.equal((await a.api.editRecruiterFirm(PID, 2, { name: "Beta Renamed" })).ok, true);
  assert.deepEqual(a.calls[0].body, { posting_id: PID, kind: "recruiter", op: "edit", position: 2, name: "Beta Renamed" });
  await a.api.editRecruiterFirm(PID, 2, { url: " https://new.example/a ", name: "N" });
  assert.deepEqual(a.calls[1].body, { posting_id: PID, kind: "recruiter", op: "edit", position: 2, url: "https://new.example/a", name: "N" });
  for (const bad of [{}, { url: "" }, { name: "  " }, { url: 5 }, { name: 5 }, null]) { const r = await a.api.editRecruiterFirm(PID, 2, bad); assert.equal(r.ok, false); }
  assert.equal((await a.api.editRecruiterFirm(PID, 4, { name: "x" })).ok, false);
  assert.equal(a.calls.length, 2);
  const b = mk(() => ({ status: 200, body: FANSWER("remove", 2, [F(1, "Acme")]) }));
  assert.equal((await b.api.removeRecruiterFirm(PID, 2)).ok, true);
  assert.deepEqual(b.calls[0].body, { posting_id: PID, kind: "recruiter", op: "remove", position: 2 });
  assert.equal((await b.api.removeRecruiterFirm(PID, 9)).ok, false);
});

test("api: the firm answers are checked; an unknown key anywhere (an address would be one), another kind, a wrong op or position, a fourth firm or a wrong order is a broken answer", async () => {
  const run = async (body) => { const a = mk(() => ({ status: 200, body })); return a.api.editRecruiterFirm(PID, 2, { name: "x" }); };
  assert.equal((await run(FANSWER("edit", 2, [F(1, "A"), F(2, "B")]))).ok, true);
  for (const [why, body] of [
    ["an address key on a row", FANSWER("edit", 2, [F(1, "A"), F(2, "B", { url: "https://leak.example/" })])],
    ["an unknown key in the answer", FANSWER("edit", 2, [F(2, "B")], { url: "https://leak.example/" })],
    ["the answer says apply", FANSWER("edit", 2, [F(2, "B")], { kind: "apply" })],
    ["a row of another kind", FANSWER("edit", 2, [A(1), F(2, "B")])],
    ["a wrong op", FANSWER("remove", 2, [F(2, "B")])],
    ["a wrong position", FANSWER("edit", 3, [F(2, "B")])],
    ["a count that does not match", FANSWER("edit", 2, [F(2, "B")], { active_links: 2 })],
    ["a fourth firm", FANSWER("edit", 2, [F(1, "A"), F(2, "B"), F(3, "C"), F(3, "D")])],
    ["rows out of order", FANSWER("edit", 2, [F(2, "B"), F(1, "A")])],
    ["a firm without a name", FANSWER("edit", 2, [F(2, null)])],
  ]) { const r = await run(body); assert.equal(r.ok, false, why); assert.equal(r.error.code, "bad_response", why); }
  assert.equal(shapes.firmRow(F(1, "A")), true);
});

test("api: the policy link's save and remove answers keep their shape (one entry of kind policy at position 1)", async () => {
  const a = mk(() => ({ status: 200, body: PANSWER([POL()]) }));
  const r = await a.api.setPolicyLink(PID, "https://policy.example/p");
  assert.equal(r.ok, true); assert.deepEqual(a.calls[0].body, { posting_id: PID, kind: "policy", links: [{ url: "https://policy.example/p" }] });
  const b = mk(() => ({ status: 200, body: PANSWER([], { changed: true }) }));
  assert.equal((await b.api.setPolicyLink(PID, null)).ok, true); assert.deepEqual(b.calls[0].body, { posting_id: PID, kind: "policy", links: [] });
});

// ============================================================ the firm panel on a fake DOM
function setupFirms(over = {}) {
  const host = new FEl("div"), hint = new FEl("div"), log = [], timers = [], wins = [];
  const o = Object.assign({ opens: "window", links: [F(1, "Acme Staffing"), F(2, "Beta Partners"), FNO(3, "Name Only Partners")] }, over);
  const api = Object.assign({
    checkRecruiterFirm: async (id, pos) => { log.push(["check", id, pos, wins.length]); return { ok: true, status: 200, data: { go_url: TICKET, expires_at: EXP } }; },
    editRecruiterFirm: async (id, pos, change) => { log.push(["edit", id, pos, change]); return { ok: true, status: 200, data: FANSWER("edit", pos, o.after || o.links) }; },
    removeRecruiterFirm: async (id, pos) => { log.push(["remove", id, pos]); return { ok: true, status: 200, data: FANSWER("remove", pos, o.links.filter((l) => l.position !== pos)) }; },
    // the apply links' calls must never be used by this panel
    checkDestinationLink: async () => { log.push(["WRONG apply check"]); return { ok: false, status: 0, error: { code: "network" } }; },
    editDestinationLink: async () => { log.push(["WRONG apply edit"]); return { ok: false, status: 0, error: { code: "network" } }; },
    removeDestinationLink: async () => { log.push(["WRONG apply remove"]); return { ok: false, status: 0, error: { code: "network" } }; },
  }, over.api || {});
  const events = { ended: 0, stale: 0, changed: [] };
  const panel = mountFirmPanel({ host, hintEl: hint, api, getPostingId: () => PID, openBlank: () => { if (o.opens === "blocked") return null; const w = win(); wins.push(w); return w; },
    schedule: (ms, fn) => timers.push({ ms, fn }), now: () => Date.parse("2026-10-05T12:00:00+00:00"), isBlocked: () => !!over.blocked,
    onSessionEnded: async () => { events.ended++; }, onStale: async () => { events.stale++; }, onChanged: async (l) => { events.changed.push(l); } });
  panel.render(o.links);
  return { host, hint, panel, log, timers, wins, events };
}

test("firm panel: one row per firm in stored order with Firm N: name, the Candidates see line and Check link, Edit, Remove with the firm number in their names; the hint appears once there are rows", () => {
  const s = setupFirms();
  assert.deepEqual(byClass(s.host, "link-row-title").map((e) => e.textContent), ["Firm 1: Acme Staffing", "Firm 2: Beta Partners", "Firm 3: Name Only Partners"]);
  assert.deepEqual(byClass(rowEl(s.host, 1), "link-row-meta").map((e) => e.textContent), ["Candidates see: Recruiter firm: Acme Staffing " + DOT + " Employer's own site"]);
  assert.deepEqual(byClass(rowEl(s.host, 1), "link-row-actions")[0].children.map((b) => [b.textContent, b.attrs["aria-label"]]), [["Check link", "Check link for firm 1"], ["Edit", "Edit firm 1"], ["Remove", "Remove firm 1"]]);
  assert.equal(s.hint.hidden, false);
  s.panel.render([]); assert.equal(s.hint.hidden, true); assert.match(text(s.host), /No recruiter firm is named yet\./); assert.equal(byClass(s.host, "link-row").length, 0);
});

test("firm panel: a firm with no address has no Check link button and says so in plain words; Edit and Remove are still there", () => {
  const s = setupFirms();
  const r3 = rowEl(s.host, 3);
  assert.deepEqual(byClass(r3, "link-row-actions")[0].children.map((b) => b.textContent), ["Edit", "Remove"]);
  assert.equal(btn(r3, "Check link for firm 3"), undefined);
  assert.match(text(r3), /No address was added for this firm, so there is nothing to check\./);
  assert.deepEqual(byClass(rowEl(s.host, 2), "link-row-actions")[0].children.map((b) => b.textContent), ["Check link", "Edit", "Remove"]);
});

test("firm panel: three firms are the most that are drawn, and the order is the stored order", () => {
  const s = setupFirms({ links: [F(3, "C"), F(1, "A"), F(2, "B"), F(4, "D")] });
  assert.deepEqual(byClass(s.host, "link-row").map((r) => r.attrs["data-position"]), ["1", "2", "3"]);
});

test("firm panel: the address is nowhere on the page, even when the server sends one; the edit form's address box is created empty and the name is prefilled", () => {
  const s = setupFirms({ links: [F(1, "Acme Staffing", { url: "https://secret.example/apply", address: "https://secret.example/x" })] });
  assert.doesNotMatch(serialize(s.host), /secret\.example/);
  const form = byTag(rowEl(s.host, 1), "form")[0];
  const [addr, name] = byTag(form, "input");
  assert.equal(addr.value, ""); assert.equal(addr.attrs.autocomplete, "off"); assert.equal(addr.attrs["aria-label"], "Address for firm 1");
  assert.equal(name.value, "Acme Staffing"); assert.equal(name.attrs["aria-label"], "Name of firm 1");
});

test("firm panel, Check link: the tab is opened inside the click BEFORE the request, then pointed at the ticket link with its opener cut; the firm check call is used, never an application link's", async () => {
  const s = setupFirms();
  await btn(rowEl(s.host, 2), "Check link for firm 2").fire("click");
  assert.deepEqual(s.log, [["check", PID, 2, 1]]);
  assert.equal(s.wins[0].opener, null); assert.equal(s.wins[0].location, TICKET);
  assert.match(text(rowEl(s.host, 2)), /Opened in a new tab\./);
  assert.doesNotMatch(serialize(s.host), /check-link-go|c1\./);
});

test("firm panel, Check link: a blocked tab leaves a link to click for one minute, then says the check expired; a refusal closes the blank tab and says why", async () => {
  const s = setupFirms({ opens: "blocked" });
  await btn(rowEl(s.host, 1), "Check link for firm 1").fire("click");
  const a = byTag(s.host, "a"); assert.equal(a.length, 1); assert.equal(a[0].attrs.href, TICKET); assert.equal(a[0].attrs.rel, "noopener noreferrer"); assert.equal(a[0].textContent, "Open firm 1 link");
  assert.equal(s.timers.length, 1); s.timers[0].fn(); assert.match(text(rowEl(s.host, 1)), /That check expired before it opened/);
  const t = setupFirms({ api: { checkRecruiterFirm: async () => ({ ok: false, status: 429, error: { code: "rate_limited", retryAfter: 30 } }) } });
  await btn(rowEl(t.host, 1), "Check link for firm 1").fire("click");
  assert.equal(t.wins[0].closed, true); assert.match(text(rowEl(t.host, 1)), /You are checking links too fast\. Try again in 30 seconds\./);
});

test("firm panel, Edit: a name only asks first, then sends ONLY the name; the address box was never involved; Edit changes that firm and no other", async () => {
  const s = setupFirms({ after: [F(1, "Acme Staffing"), F(2, "Beta Talent"), FNO(3, "Name Only Partners")] });
  await btn(rowEl(s.host, 2), "Edit firm 2").fire("click");
  const form = byTag(rowEl(s.host, 2), "form")[0], [addr, name] = byTag(form, "input");
  name.value = "Beta Talent";
  await form.fire("submit");
  assert.equal(s.log.length, 0, "nothing is sent before the person confirms");
  assert.match(text(form), /Change the name of Firm 2: Beta Partners\? The address is kept\. Your other firms are not changed\./);
  const save = byTag(form, "button").find((b) => b.textContent === "Save");
  await save.fire("click");
  assert.deepEqual(s.log, [["edit", PID, 2, { name: "Beta Talent" }]]);
  assert.equal(addr.value, "");
  assert.match(text(rowEl(s.host, 2)), /Firm 2 was renamed\./);
  assert.equal(s.events.changed.length, 1);
});

test("firm panel, Edit: a new address replaces that one firm's address; the confirm step says so; the box is emptied after the request; a blank name is refused at the form", async () => {
  const s = setupFirms();
  await btn(rowEl(s.host, 1), "Edit firm 1").fire("click");
  const form = byTag(rowEl(s.host, 1), "form")[0], [addr, name] = byTag(form, "input");
  addr.value = "https://new.example/apply";
  await form.fire("submit");
  assert.match(text(form), /Replace the address for Firm 1: Acme Staffing\? Candidates will be sent to the address you entered\. Your other firms are not changed\./);
  await byTag(form, "button").find((b) => b.textContent === "Save").fire("click");
  assert.deepEqual(s.log, [["edit", PID, 1, { url: "https://new.example/apply" }]]);
  assert.equal(addr.value, "");
  const t = setupFirms();
  await btn(rowEl(t.host, 1), "Edit firm 1").fire("click");
  const f2 = byTag(rowEl(t.host, 1), "form")[0], [, n2] = byTag(f2, "input");
  n2.value = "   ";
  await f2.fire("submit");
  assert.equal(t.log.length, 0); assert.match(text(f2), /Enter the firm's name\./);
});

test("firm panel, Edit: a failed save-time check of the new address is said in the row (amber) and the firm is saved anyway; the server's words appear under the right box on a refusal", async () => {
  const bad = F(1, "Acme Staffing", { check_status: "failed", check_http: 404 });
  const s = setupFirms({ after: [bad, F(2, "Beta Partners"), FNO(3, "Name Only Partners")] });
  await btn(rowEl(s.host, 1), "Edit firm 1").fire("click");
  const form = byTag(rowEl(s.host, 1), "form")[0], [addr] = byTag(form, "input");
  addr.value = "https://new.example/gone";
  await form.fire("submit"); await byTag(form, "button").find((b) => b.textContent === "Save").fire("click");
  assert.match(text(rowEl(s.host, 1)), /Firm 1 has a new address\. When we checked, the address answered HTTP 404\. It is saved anyway\. Make sure it is right\./);
  const t = setupFirms({ api: { editRecruiterFirm: async () => ({ ok: false, status: 400, error: { code: "invalid_request", errors: [{ field: "url", message: "the same url appears twice" }] } }) } });
  await btn(rowEl(t.host, 1), "Edit firm 1").fire("click");
  const f2 = byTag(rowEl(t.host, 1), "form")[0], [a2] = byTag(f2, "input");
  a2.value = "https://dup.example/a"; await f2.fire("submit"); await byTag(f2, "button").find((b) => b.textContent === "Save").fire("click");
  assert.match(text(f2), /the same url appears twice/); assert.equal(a2.value, "");
});

test("firm panel, Remove: asks first in the row; Cancel sends nothing; confirming removes that one firm and the others keep their numbers; the last firm leaves the empty sentence", async () => {
  const s = setupFirms();
  await btn(rowEl(s.host, 2), "Remove firm 2").fire("click");
  assert.match(text(rowEl(s.host, 2)), /Remove Firm 2: Beta Partners\? Candidates will no longer see it\. Your other firms are not changed\./);
  await byTag(rowEl(s.host, 2), "button").find((b) => b.textContent === "Cancel" && !b.hidden).fire("click");
  assert.equal(s.log.length, 0);
  await btn(rowEl(s.host, 2), "Remove firm 2").fire("click");
  const yes = byTag(rowEl(s.host, 2), "button").find((b) => b.attrs["aria-label"] === "Remove firm 2" && b.textContent === "Remove" && b.className.includes("btn-dark"));
  await yes.fire("click");
  assert.deepEqual(s.log, [["remove", PID, 2]]);
  assert.deepEqual(byClass(s.host, "link-row").map((r) => r.attrs["data-position"]), ["1", "3"]);
  assert.match(text(s.host), /Firm 2 is no longer named\./);
  const t = setupFirms({ links: [F(1, "Only Firm")] });
  await btn(rowEl(t.host, 1), "Remove firm 1").fire("click");
  await byTag(rowEl(t.host, 1), "button").find((b) => b.className.includes("btn-dark") && b.textContent === "Remove").fire("click");
  assert.match(text(t.host), /No recruiter firm is named yet\./); assert.equal(t.hint.hidden, true);
});

test("firm panel, unsaved work: an open edit that is untouched is not pending; a typed address or a changed name is; Cancel and discard() clear it", async () => {
  const s = setupFirms();
  assert.equal(s.panel.hasPending(), false);
  await btn(rowEl(s.host, 1), "Edit firm 1").fire("click");
  assert.equal(s.panel.hasPending(), false);
  const form = byTag(rowEl(s.host, 1), "form")[0], [addr, name] = byTag(form, "input");
  name.value = "Acme Renamed"; assert.equal(s.panel.hasPending(), true);
  name.value = "Acme Staffing"; assert.equal(s.panel.hasPending(), false);
  addr.value = "https://typed.example/a"; assert.equal(s.panel.hasPending(), true);
  s.panel.discard(); assert.equal(s.panel.hasPending(), false);
});

// ============================================================ the policy row panel on a fake DOM
function setupPolicy(over = {}) {
  const host = new FEl("div"), hint = new FEl("div"), log = [], timers = [], wins = [];
  const o = Object.assign({ opens: "window", links: [A(1), POL()] }, over);
  const api = Object.assign({
    checkPolicyLink: async (id) => { log.push(["check", id, wins.length]); return { ok: true, status: 200, data: { go_url: TICKET, expires_at: EXP } }; },
    setPolicyLink: async (id, url) => { log.push(["set", id, url]); return { ok: true, status: 200, data: PANSWER(url === null ? [] : [o.after || POL()], { changed: true }) }; },
    // the application links' and the firms' calls must never be used by this panel
    checkDestinationLink: async () => { log.push(["WRONG apply check"]); return { ok: false, status: 0, error: { code: "network" } }; },
    editDestinationLink: async () => { log.push(["WRONG apply edit"]); return { ok: false, status: 0, error: { code: "network" } }; },
    removeDestinationLink: async () => { log.push(["WRONG apply remove"]); return { ok: false, status: 0, error: { code: "network" } }; },
    removeRecruiterFirm: async () => { log.push(["WRONG firm remove"]); return { ok: false, status: 0, error: { code: "network" } }; },
    setDestinationLinks: async () => { log.push(["WRONG whole set"]); return { ok: false, status: 0, error: { code: "network" } }; },
  }, over.api || {});
  const events = { ended: 0, stale: 0, changed: [] };
  const panel = mountPolicyPanel({ host, hintEl: hint, api, getPostingId: () => PID, openBlank: () => { if (o.opens === "blocked") return null; const w = win(); wins.push(w); return w; },
    schedule: (ms, fn) => timers.push({ ms, fn }), now: () => Date.parse("2026-10-05T12:00:00+00:00"), isBlocked: () => !!over.blocked,
    onSessionEnded: async () => { events.ended++; }, onStale: async () => { events.stale++; }, onChanged: async (l) => { events.changed.push(l); } });
  panel.render(o.links);
  return { host, hint, panel, log, timers, wins, events };
}

test("policy row: nothing is drawn while no link is stored (the box and Save policy link are the page's own); with a link there is one row, its lines and three buttons with the right names", () => {
  const none = setupPolicy({ links: [A(1)] });
  assert.equal(byClass(none.host, "link-row").length, 0); assert.equal(byTag(none.host, "button").length, 0); assert.equal(none.hint.hidden, true); assert.equal(text(none.host), "");
  const s = setupPolicy();
  assert.deepEqual(byClass(s.host, "link-row-title").map((e) => e.textContent), ["AI and hiring policy link"]);
  assert.deepEqual(byClass(s.host, "link-row-meta").map((e) => e.textContent), ["Candidates see: AI and hiring policy: Employer's own site", "When we checked, the address answered."]);
  assert.deepEqual(byClass(s.host, "link-row-actions")[0].children.map((b) => [b.textContent, b.attrs["aria-label"]]), [["Check link", "Check link for AI and hiring policy link"], ["Edit", "Edit AI and hiring policy link"], ["Remove", "Remove AI and hiring policy link"]]);
  assert.equal(s.hint.hidden, false);
});

test("policy row: a check that did not answer shows the amber notice IN the row and says candidates see nothing yet; the row and its buttons stay", () => {
  const s = setupPolicy({ links: [POL({ check_status: "failed", check_http: 404 })] });
  assert.deepEqual(byClass(s.host, "link-row-meta").map((e) => e.textContent), ["Candidates see: nothing yet."]);
  const notice = byClass(s.host, "alert-notice");
  assert.equal(notice.length, 1); assert.match(notice[0].textContent, /did not answer \(HTTP 404\)\. Candidates are not shown it\./);
  assert.equal(byTag(s.host, "button").filter((b) => b.hidden === false && b.attrs["aria-label"] && /policy link$/.test(b.attrs["aria-label"])).length >= 3, true);
});

test("policy row: the address is nowhere on the page, even when the server sends one; the edit box is created empty", () => {
  const s = setupPolicy({ links: [POL({ url: "https://secret.example/policy", address: "https://secret.example/p" })] });
  assert.doesNotMatch(serialize(s.host), /secret\.example/);
  const [addr] = byTag(byTag(s.host, "form")[0], "input");
  assert.equal(addr.value, ""); assert.equal(addr.attrs.autocomplete, "off"); assert.equal(byTag(byTag(s.host, "form")[0], "input").length, 1, "an address box only: there is no second box");
});

test("policy row, Check link: the tab is opened first, then pointed at the ticket link; only the policy check call is used", async () => {
  const s = setupPolicy();
  await btn(s.host, "Check link for AI and hiring policy link").fire("click");
  assert.deepEqual(s.log, [["check", PID, 1]]);
  assert.equal(s.wins[0].opener, null); assert.equal(s.wins[0].location, TICKET);
  assert.doesNotMatch(serialize(s.host), /check-link-go|c1\./);
});

test("policy row, Edit: replaces the address only (the whole-set call with one address), asks first, empties the box; a refused address shows the server's words under the box", async () => {
  const s = setupPolicy();
  await btn(s.host, "Edit AI and hiring policy link").fire("click");
  const form = byTag(s.host, "form")[0], [addr] = byTag(form, "input");
  addr.value = "https://policy.example/new";
  await form.fire("submit");
  assert.equal(s.log.length, 0);
  assert.match(text(form), /Replace the address of the AI and hiring policy link\? Candidates are sent to the address you entered, once a check of it answers\./);
  await byTag(form, "button").find((b) => b.textContent === "Save").fire("click");
  assert.deepEqual(s.log, [["set", PID, "https://policy.example/new"]]);
  assert.equal(addr.value, "");
  assert.match(text(s.host), /Saved\. Candidates see it as AI and hiring policy: Employer's own site\./);
  const t = setupPolicy({ api: { setPolicyLink: async () => ({ ok: false, status: 400, error: { code: "invalid_request", errors: [{ field: "links[0].url", message: "url host is not allowed" }] } }) } });
  await btn(t.host, "Edit AI and hiring policy link").fire("click");
  const f2 = byTag(t.host, "form")[0], [a2] = byTag(f2, "input");
  a2.value = "https://blocked.example/p"; await f2.fire("submit"); await byTag(f2, "button").find((b) => b.textContent === "Save").fire("click");
  assert.match(text(f2), /url host is not allowed/);
});

test("policy row, Edit: a new address whose check did not answer is told in amber (candidates are shown nothing) and the answer redraws the row", async () => {
  const s = setupPolicy({ after: POL({ check_status: "failed", check_http: 404 }) });
  await btn(s.host, "Edit AI and hiring policy link").fire("click");
  const form = byTag(s.host, "form")[0], [addr] = byTag(form, "input");
  addr.value = "https://policy.example/down"; await form.fire("submit"); await byTag(form, "button").find((b) => b.textContent === "Save").fire("click");
  const note = byClass(s.host, "alert-notice").map((e) => e.textContent).join(" | ");
  assert.match(note, /Saved, but when we checked, the address did not answer \(HTTP 404\)\. Candidates are not shown it until a check answers\./);
  assert.deepEqual(byClass(s.host, "link-row-meta").map((e) => e.textContent), ["Candidates see: nothing yet."]);
});

test("policy row, Remove: asks first with the existing words; Cancel sends nothing; confirming removes only the policy link (the whole-set call with none) and the row goes", async () => {
  const s = setupPolicy();
  await btn(s.host, "Remove AI and hiring policy link").fire("click");
  assert.equal(text(rowEl(s.host, 1)).includes(POLICY_REMOVE_CONFIRM), true);
  await byTag(s.host, "button").find((b) => b.textContent === "Cancel" && !b.hidden).fire("click");
  assert.equal(s.log.length, 0);
  await btn(s.host, "Remove AI and hiring policy link").fire("click");
  await byTag(s.host, "button").find((b) => b.className.includes("btn-dark") && b.attrs["aria-label"] === "Remove AI and hiring policy link").fire("click");
  assert.deepEqual(s.log, [["set", PID, null]]);
  assert.equal(byClass(s.host, "link-row").length, 0);
  assert.match(text(s.host), /Removed\. No AI and hiring policy link is saved on this opening\./);
  assert.equal(s.events.changed.length, 1);
});

test("policy row, unsaved work: an open edit with a typed address is pending; Cancel and discard() clear it", async () => {
  const s = setupPolicy();
  assert.equal(s.panel.hasPending(), false);
  await btn(s.host, "Edit AI and hiring policy link").fire("click");
  assert.equal(s.panel.hasPending(), false);
  const [addr] = byTag(byTag(s.host, "form")[0], "input");
  addr.value = "https://typed.example/p"; assert.equal(s.panel.hasPending(), true);
  s.panel.discard(); assert.equal(s.panel.hasPending(), false);
});

// ============================================================ what stays as BA built it
test("the policy link and the firms stay out of the application links, and the other way round", () => {
  const list = [A(1), A(2), F(1, "Firm"), POL()];
  assert.deepEqual(applyLinks(list).map((x) => x.kind), ["apply", "apply"]);
  assert.deepEqual(recruiterFirms(list).map((x) => x.kind), ["recruiter"]);
  assert.deepEqual(firmRows(list).map((r) => r.position), [1]);
  assert.deepEqual(policyRows(list).map((r) => r.position), [1]);
});
