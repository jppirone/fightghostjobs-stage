// linkpanel.test.js - the "Destination links" rows panel (item 4): the pure model (rows with gaps, label or "Link N", what an edit sends, the words for every refusal), the three API calls and the strict answer checks
// (a check ticket is exactly { go_url, expires_at }; an edit or remove answer carries no key an address could ride in), and the panel itself (js/link-panel.js) on a tiny fake DOM. Nothing here touches a network.
import test from "node:test";
import assert from "node:assert/strict";
import { createApi, shapes } from "../js/api.js";
import { LP, panelRows, rowMeta, planEdit, confirmText, refusalFor, successText, checkAria, editAria, removeAria, linkName, linkTitle } from "../js/link-panel-model.js";

const BASE = "https://example.test", KEY = "sb_publishable_TESTKEY", PID = "11111111-1111-4111-8111-111111111111";
const TICKET = "https://example.test/functions/v1/check-link-go/c1.AAAAAAAAAAAAAAAAAAAAAA.AAAAAA.AAAAAAAAAAAAAAAAAAAAAA";
const EXP = "2026-10-05T12:01:00+00:00";
const mk = (handler) => { const calls = []; const api = createApi({ baseUrl: BASE, key: KEY, getToken: async () => "TOKEN.abc.def", fetchImpl: async (url, init) => { calls.push({ url, init, body: init && init.body ? JSON.parse(init.body) : null }); const r = await handler(url, init); return { ok: r.status < 300, status: r.status, headers: { get: (k) => (r.headers && r.headers[k]) || null }, text: async () => JSON.stringify(r.body) }; } }); return { api, calls }; };
const L = (position, extra) => Object.assign({ position, kind: "apply", firm: null, label: null, shown_as: "LinkedIn", check_status: "ok", check_http: 200 }, extra || {});
const ANSWER = (op, position, links, extra) => Object.assign({ posting_id: PID, kind: "apply", op, position, changed: true, active_links: links.length, links }, extra || {});

// ---- the model
test("rows: one per stored APPLICATION link, in position order, titled Link N: LABEL (or Link N when unlabelled) by the stored position; a gap stays a gap", () => {
  const rows = panelRows([L(3, { label: "Careers site" }), L(1), { position: 2, kind: "recruiter", firm: "Acme Staffing", label: null, shown_as: null }, L(5, { label: "   " })]);
  assert.deepEqual(rows.map((r) => [r.position, r.title]), [[1, "Link 1"], [3, "Link 3: Careers site"], [5, "Link 5"]]);
  assert.deepEqual(panelRows([L(1), L(3)]).map((r) => r.title), ["Link 1", "Link 3"]);                         // link 2 was removed: the others keep their numbers
  assert.deepEqual(panelRows([{ position: 2, label: null }]).map((r) => r.title), ["Link 2"]);                  // an answer from before pass C has no kind: it is an application link
  for (const bad of [{ position: 0 }, { position: 11 }, { position: 1.5 }, { position: "2" }, null, undefined]) assert.deepEqual(panelRows([bad]), []);
  assert.deepEqual(panelRows([L(2), L(2, { label: "second" })]).map((r) => r.title), ["Link 2"]);               // a repeated position keeps its first entry
  assert.deepEqual(panelRows(undefined), []); assert.deepEqual(panelRows([]), []);
  assert.equal(linkName(7), "Link 7");
});

test("row title: ONE form, \"Link N: LABEL\" for a labelled row and \"Link N\" for an unlabelled one; N is the stored position (gaps stay gaps); a long label is kept whole", () => {
  assert.equal(linkTitle(3, "Careers site"), "Link 3: Careers site"); assert.equal(linkTitle(3, null), "Link 3"); assert.equal(linkTitle(3, ""), "Link 3"); assert.equal(linkTitle(3, "   "), "Link 3"); assert.equal(linkTitle(3, undefined), "Link 3");
  assert.equal(linkTitle(10, "  padded  "), "Link 10: padded");
  const rows = panelRows([L(1, { label: "First" }), L(4, { label: "Fourth" }), L(7), L(9, { label: "x".repeat(100) })]);
  assert.deepEqual(rows.map((r) => r.title), ["Link 1: First", "Link 4: Fourth", "Link 7", "Link 9: " + "x".repeat(100)]);       // positions 1, 4, 7, 9: the gaps stay gaps
  assert.equal(rows[3].label, "x".repeat(100));                               // the label field itself stays the bare label (the edit box is prefilled with it)
  assert.deepEqual(panelRows([L(2, { label: "Careers: main" })]).map((r) => r.title), ["Link 2: Careers: main"]);
});

test("dialog texts use the same form: the edit title, the confirm sentences and the remove question carry the number AND the label", () => {
  assert.equal(LP.editTitle(3, "Careers site"), "Replace the address for Link 3: Careers site"); assert.equal(LP.editTitle(3, null), "Replace the address for Link 3"); assert.equal(LP.editTitle(3), "Replace the address for Link 3");
  assert.equal(LP.removeConfirm(2, "Careers site"), "Remove Link 2: Careers site? Candidates will no longer see it. Your other links are not changed."); assert.equal(LP.removeConfirm(2, null), "Remove Link 2? Candidates will no longer see it. Your other links are not changed.");
  assert.equal(confirmText(3, planEdit("https://jobs.example.invalid/a", "Careers site", "Careers site"), "Careers site"), "Replace the address for Link 3: Careers site? Candidates will be sent to the address you entered. Your other links are not changed.");
  assert.equal(confirmText(3, planEdit("", "New", "Careers site"), "Careers site"), "Change the label for Link 3: Careers site? The address is kept. Your other links are not changed.");   // the stored label, not the new one
  assert.equal(confirmText(3, planEdit("", "New", null), null), "Change the label for Link 3? The address is kept. Your other links are not changed.");
});

test("rows carry only position, label, what candidates see and the save-time check: nothing else from the server is ever read", () => {
  const rows = panelRows([Object.assign(L(1, { label: "x" }), { url: "https://secret.example/apply?token=abc", url_enc: "00ff", host: "secret.example", link_id: PID })]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["checkFailed", "checkHttp", "label", "position", "shownAs", "title"]);
  assert.doesNotMatch(JSON.stringify(rows), /secret|token=|00ff|link_id/);
});

test("row meta says what candidates see, and the save-time check in the page's existing words", () => {
  assert.equal(rowMeta(panelRows([L(1)])[0]), "Candidates see: LinkedIn");
  assert.equal(rowMeta(panelRows([L(2, { shown_as: null })])[0]), "Candidates see: Application link 2");
  assert.equal(rowMeta(panelRows([L(1, { check_status: "failed", check_http: 404 })])[0]), "Candidates see: LinkedIn (did not answer when we checked: HTTP 404)");
  assert.equal(rowMeta(panelRows([L(1, { check_status: "failed", check_http: null })])[0]), "Candidates see: LinkedIn (did not answer when we checked)");
  assert.equal(rowMeta(panelRows([L(1, { check_status: "skipped", check_http: null })])[0]), "Candidates see: LinkedIn");
});

test("accessible names include the link number", () => {
  assert.equal(checkAria(2), "Check Link 2"); assert.equal(editAria(2), "Edit Link 2"); assert.equal(removeAria(2), "Remove Link 2");
});

test("edit: a blank address keeps the address; the label is sent only when it differs from the stored one; blank clears it", () => {
  assert.deepEqual(planEdit("", "Careers", "Careers"), { ok: true, errors: {}, change: null, replacesAddress: false, changesLabel: false });
  assert.deepEqual(planEdit("   ", "  Careers ", "Careers").change, null);
  assert.deepEqual(planEdit("", "New note", "Careers").change, { label: "New note" });
  assert.deepEqual(planEdit("", "", "Careers").change, { label: null });
  assert.deepEqual(planEdit("", "", null).change, null); assert.deepEqual(planEdit("", "x", null).change, { label: "x" });
  assert.deepEqual(planEdit(" https://jobs.example.invalid/apply/1 ", "Careers", "Careers").change, { url: "https://jobs.example.invalid/apply/1" });
  assert.deepEqual(planEdit("https://jobs.example.invalid/a", "Other", "Careers").change, { url: "https://jobs.example.invalid/a", label: "Other" });
  const p = planEdit("https://jobs.example.invalid/a", "Other", "Careers"); assert.equal(p.replacesAddress, true); assert.equal(p.changesLabel, true);
});

test("edit: the address and label are checked the way the whole-set form checks them", () => {
  assert.equal(planEdit("http://jobs.example.invalid/a", "", null).errors.url, "The address must start with https://");
  assert.equal(planEdit("jobs.example.invalid", "", null).errors.url, "The address must start with https://");
  assert.equal(planEdit("https://", "", null).errors.url, "That does not look like a web address.");
  assert.equal(planEdit("https://x.example.invalid/" + "a".repeat(2100), "", null).errors.url, "Keep the address to 2048 characters or fewer.");
  assert.equal(planEdit("", "x".repeat(101), null).errors.label, "Keep the label to 100 characters or fewer.");
  assert.equal(planEdit("", "a\tb", null).errors.label, "Keep the label to plain text.");
  const bad = planEdit("ftp://x", "", null); assert.equal(bad.ok, false); assert.equal(bad.change, null);
  assert.equal(planEdit("", "x".repeat(100), null).ok, true);
});

test("edit: the confirm sentence says plainly what will change", () => {
  assert.equal(confirmText(2, planEdit("https://jobs.example.invalid/a", "", null)), "Replace the address for Link 2? Candidates will be sent to the address you entered. Your other links are not changed.");
  assert.match(confirmText(2, planEdit("https://jobs.example.invalid/a", "new", null)), /The label is changed too\.$/);
  assert.equal(confirmText(3, planEdit("", "new", null)), "Change the label for Link 3? The address is kept. Your other links are not changed.");
  assert.equal(LP.removeConfirm(2), "Remove Link 2? Candidates will no longer see it. Your other links are not changed.");
});

test("every refusal has plain words, and says what the page must do", () => {
  for (const code of ["unauthorized", "no_session", "reverification_required"]) assert.equal(refusalFor("edit", { code }).sessionEnded, true, code);
  const plan = refusalFor("check", { code: "plan_required" }); assert.equal(plan.planLost, true); assert.equal(plan.stale, true); assert.match(plan.text, /not on it \(or the tier has ended\)/);
  for (const op of ["check", "edit", "remove"]) { const s = refusalFor(op, { code: "posting_status" }); assert.equal(s.stale, true); assert.equal(s.text, ""); }
  assert.equal(refusalFor("edit", { code: "request_refused", field: "status", message: "x" }).stale, true);
  const gone = refusalFor("remove", { code: "link_not_found" }); assert.deepEqual([gone.where, gone.stale, gone.text], ["panel", true, "That link is no longer stored, so nothing was changed."]);
  assert.match(refusalFor("check", { code: "not_found" }).text, /^That posting was not found\./);
  assert.equal(refusalFor("check", { code: "rate_limited", retryAfter: 30 }).text, "You are checking links too fast. Try again in 30 seconds.");
  assert.equal(refusalFor("check", { code: "rate_limited" }).text, "You are checking links too fast. Try again in 30 seconds.");
  assert.equal(refusalFor("edit", { code: "rate_limited", retryAfter: 120 }).text, "Too many requests just now. Try again in 2 minutes.");
  assert.equal(refusalFor("remove", { code: "rate_limited", retryAfter: 20 }).text, "Too many requests just now. Try again in 20 seconds.");
  const under = refusalFor("edit", { code: "request_refused", field: "url", message: "the same url appears twice" }); assert.deepEqual([under.where, under.text], ["url", "the same url appears twice"]);
  const lab = refusalFor("edit", { code: "request_refused", errors: [{ field: "label", message: "Keep the label to plain text." }] }); assert.equal(lab.where, "label");
  assert.equal(refusalFor("edit", { code: "request_refused", errors: [{ field: "links[0].url", message: "Not an address." }] }).where, "url");
  assert.equal(refusalFor("check", { code: "network" }).text, "Could not reach the server. Check your connection and try again.");
  assert.match(refusalFor("edit", { code: "bad_response" }).text, /did not expect/); assert.match(refusalFor("remove", { code: "server_error" }).text, /server had a problem/);
  assert.equal(refusalFor("edit", { code: "kind_not_supported", field: "kind", message: "kind_not_supported" }).text, "That was refused.");     // the server's own code words are never shown
  assert.equal(refusalFor("check", { code: "weird", message: "raw server text" }).text, "That was refused.");
  assert.doesNotMatch(JSON.stringify(["unknown", "x"].map((c) => refusalFor("edit", { code: c }).text)), /undefined/);
});

test("success wording: replaced, label changed, removed, and the two no-change sentences", () => {
  const withUrl = planEdit("https://jobs.example.invalid/a", "", null), labelOnly = planEdit("", "n", null);
  assert.equal(successText("edit", { position: 2, changed: true }, withUrl), "Link 2 was replaced.");
  assert.equal(successText("edit", { position: 2, changed: true }, labelOnly), "The label for Link 2 was changed.");
  assert.equal(successText("edit", { position: 2, changed: false }, withUrl), "That is the address already stored, so nothing was changed.");
  assert.equal(successText("edit", { position: 2, changed: false }, labelOnly), "Nothing was changed.");
  assert.equal(successText("remove", { position: 2, changed: true }), "Link 2 was removed.");
});

// ---- the API calls
test("api check: the body is exactly posting_id and position, the session token goes in the header, and the answer is a ticket link", async () => {
  const a = mk(() => ({ status: 200, body: { go_url: TICKET, expires_at: EXP } }));
  const r = await a.api.checkDestinationLink(PID, 2);
  assert.equal(r.ok, true); assert.equal(r.data.go_url, TICKET);
  assert.equal(a.calls.length, 1); assert.equal(a.calls[0].url, BASE + "/functions/v1/check-destination-link");
  assert.deepEqual(a.calls[0].body, { posting_id: PID, position: 2 }); assert.equal(a.calls[0].init.headers.Authorization, "Bearer TOKEN.abc.def"); assert.equal(a.calls[0].init.headers.apikey, KEY);
  assert.doesNotMatch(a.calls[0].init.body, /poster_id|organization_id|url/);
});

test("api check: a malformed request is refused before any call", async () => {
  const a = mk(() => ({ status: 200, body: { go_url: TICKET, expires_at: EXP } }));
  for (const args of [[PID, 0], [PID, 11], [PID, 1.5], [PID, "2"], [PID, null], ["nope", 1], [undefined, 1], [null, 1]]) { const r = await a.api.checkDestinationLink(...args); assert.equal(r.ok, false); assert.equal(r.error.code, "invalid_request"); }
  assert.equal(a.calls.length, 0);
});

test("api check: the answer must be exactly go_url (an https link with no credentials) and expires_at; anything else is a broken answer", async () => {
  const bads = [{}, { go_url: TICKET }, { expires_at: EXP }, { go_url: TICKET, expires_at: EXP, url: "https://secret.example/x" }, { go_url: TICKET, expires_at: EXP, link_id: PID }, { go_url: "http://example.test/x", expires_at: EXP },
    { go_url: "ftp://example.test/x", expires_at: EXP }, { go_url: "/functions/v1/check-link-go/c1.x", expires_at: EXP }, { go_url: "https://user:pw@example.test/x", expires_at: EXP }, { go_url: "https://example.test/x", expires_at: "later" },
    { go_url: "https://example.test/x", expires_at: 5 }, { go_url: 5, expires_at: EXP }, { go_url: "javascript:alert(1)", expires_at: EXP }, [], null, "ok"];
  for (const bad of bads) { const r = await mk(() => ({ status: 200, body: bad })).api.checkDestinationLink(PID, 1); assert.equal(r.ok, false, JSON.stringify(bad)); assert.equal(r.error.code, "bad_response"); }
  assert.equal(shapes.checkIssue({ go_url: TICKET, expires_at: EXP }), true);
});

test("api check: refusals keep their codes (plan, posting status, link gone, not found, rate limit with its wait)", async () => {
  const run = async (status, body, headers) => (await mk(() => ({ status, body, headers })).api.checkDestinationLink(PID, 1));
  let r = await run(403, { error: "plan_required", code: "plan_required" }); assert.equal(r.error.code, "plan_required");
  r = await run(409, { error: "posting_status", code: "posting_status", current_status: "closed" }); assert.equal(r.error.code, "posting_status");
  r = await run(404, { error: "link_not_found", code: "link_not_found" }); assert.equal(r.error.code, "link_not_found");
  r = await run(404, { error: "not_found", code: "not_found" }); assert.equal(r.error.code, "not_found");
  r = await run(429, { error: "rate_limited", code: "rate_limited" }, { "retry-after": "180" }); assert.equal(r.error.code, "rate_limited"); assert.equal(r.error.retryAfter, 180);
  r = await run(401, {}); assert.equal(r.error.code, "unauthorized");
  r = await run(500, { error: "Internal error" }); assert.equal(r.error.code, "server_error");
});

test("api edit: the body names the posting, kind, op and position; the address goes only when typed; a label change goes alone; no identity", async () => {
  const links = [L(1), L(3)];
  const a = mk(() => ({ status: 200, body: ANSWER("edit", 3, links) }));
  let r = await a.api.editDestinationLink(PID, 3, { url: "  https://jobs.example.invalid/apply/2  ", label: "Careers" }); assert.equal(r.ok, true);
  assert.deepEqual(a.calls[0].body, { posting_id: PID, kind: "apply", op: "edit", position: 3, url: "https://jobs.example.invalid/apply/2", label: "Careers" });
  r = await a.api.editDestinationLink(PID, 3, { label: "New note" }); assert.deepEqual(a.calls[1].body, { posting_id: PID, kind: "apply", op: "edit", position: 3, label: "New note" });
  r = await a.api.editDestinationLink(PID, 3, { label: null }); assert.deepEqual(a.calls[2].body, { posting_id: PID, kind: "apply", op: "edit", position: 3, label: null });
  r = await a.api.editDestinationLink(PID, 3, { url: "   ", label: "x" }); assert.deepEqual(a.calls[3].body, { posting_id: PID, kind: "apply", op: "edit", position: 3, label: "x" });      // a blank address means keep it: it is not sent
  r = await a.api.editDestinationLink(PID, 3, { url: "https://jobs.example.invalid/a" }); assert.deepEqual(Object.keys(a.calls[4].body), ["posting_id", "kind", "op", "position", "url"]);
  for (const c of a.calls) { assert.equal(c.url, BASE + "/functions/v1/set-destination-links"); assert.equal("links" in c.body, false); assert.doesNotMatch(JSON.stringify(c.body), /poster_id|organization_id/); }
});

test("api edit: nothing to change, or a malformed request, is refused before any call", async () => {
  const a = mk(() => ({ status: 200, body: ANSWER("edit", 1, [L(1)]) }));
  for (const args of [[PID, 1, {}], [PID, 1, { url: "" }], [PID, 1, { url: "  " }], [PID, 1, undefined], [PID, 1, null], [PID, 0, { label: "x" }], [PID, 11, { label: "x" }], [PID, "1", { label: "x" }], ["nope", 1, { label: "x" }], [PID, 1, { url: 5 }], [PID, 1, { label: 5 }], [PID, 1, { label: undefined }]]) {
    const r = await a.api.editDestinationLink(...args); assert.equal(r.ok, false, JSON.stringify(args)); assert.equal(r.error.code, "invalid_request");
  }
  assert.equal(a.calls.length, 0);
});

test("api remove: the body is exactly posting_id, kind, op and position", async () => {
  const a = mk(() => ({ status: 200, body: ANSWER("remove", 2, [L(1), L(3)]) }));
  const r = await a.api.removeDestinationLink(PID, 2); assert.equal(r.ok, true); assert.equal(r.data.active_links, 2);
  assert.deepEqual(a.calls[0].body, { posting_id: PID, kind: "apply", op: "remove", position: 2 }); assert.equal(a.calls[0].url, BASE + "/functions/v1/set-destination-links");
  for (const args of [[PID, 0], [PID, 11], [PID, 1.2], [PID, "1"], ["x", 1]]) assert.equal((await a.api.removeDestinationLink(...args)).error.code, "invalid_request");
  assert.equal(a.calls.length, 1);
});

test("api edit and remove: the answer is checked; an unknown key anywhere (an address would be one), a wrong count, order, op or position is a broken answer", async () => {
  const good = ANSWER("edit", 3, [L(1), L(3)]);
  const bads = [
    ["extra top key", Object.assign({}, good, { url: "https://secret.example/x" })], ["extra link key url", Object.assign({}, good, { links: [L(1), Object.assign(L(3), { url: "https://secret.example/x" })] })],
    ["extra link key host", Object.assign({}, good, { links: [L(1), Object.assign(L(3), { host: "secret.example" })] })], ["extra link key url_enc", Object.assign({}, good, { links: [L(1), Object.assign(L(3), { url_enc: "00" })] })],
    ["wrong op", ANSWER("remove", 3, [L(1), L(3)])], ["wrong position", ANSWER("edit", 2, [L(1), L(3)])], ["bad posting id", Object.assign({}, good, { posting_id: "x" })], ["other posting id", Object.assign({}, good, { posting_id: "22222222-2222-4222-8222-222222222222" })],
    ["count mismatch", Object.assign({}, good, { active_links: 3 })], ["not ascending", ANSWER("edit", 3, [L(3), L(1)])], ["duplicate position", ANSWER("edit", 3, [L(1), L(1)])], ["recruiter row", ANSWER("edit", 3, [L(1), { position: 1, kind: "recruiter", firm: "Acme", label: null, shown_as: null }])],
    ["firm given on an apply row", ANSWER("edit", 3, [L(1, { firm: "Acme" })])], ["position 11", ANSWER("edit", 3, [L(11)])], ["changed missing", (({ changed, ...o }) => o)(good)], ["changed a string", Object.assign({}, good, { changed: "yes" })],
    ["kind recruiter", Object.assign({}, good, { kind: "recruiter" })], ["links missing", (({ links, ...o }) => o)(good)], ["bad check status", ANSWER("edit", 3, [L(3, { check_status: "great" })])], ["more than ten", ANSWER("edit", 3, Array.from({ length: 11 }, (_, i) => L(i + 1)))], ["array", []], ["null", null]];
  for (const [name, body] of bads) {
    const r = await mk(() => ({ status: 200, body })).api.editDestinationLink(PID, 3, { label: "x" }); assert.equal(r.ok, false, name); assert.equal(r.error.code, "bad_response", name);
  }
  assert.equal((await mk(() => ({ status: 200, body: ANSWER("edit", 3, [L(1), L(3)]) })).api.editDestinationLink(PID, 3, { label: "x" })).ok, true);
  assert.equal((await mk(() => ({ status: 200, body: ANSWER("edit", 3, []) })).api.editDestinationLink(PID, 3, { label: "x" })).ok, true);          // no link left is a fine answer
  assert.equal((await mk(() => ({ status: 200, body: ANSWER("edit", 2, [L(1), L(3)]) })).api.removeDestinationLink(PID, 2)).error.code, "bad_response");      // an edit answer to a remove
  assert.equal((await mk(() => ({ status: 200, body: ANSWER("remove", 2, [L(1)]) })).api.removeDestinationLink(PID, 3)).error.code, "bad_response");        // another position
  assert.equal((await mk(() => ({ status: 200, body: ANSWER("remove", 2, [L(1), L(3, { label: null, shown_as: null, check_status: null, check_http: null })]) })).api.removeDestinationLink(PID, 2)).ok, true);
});

test("api edit and remove: refusals keep their codes and the field", async () => {
  const run = async (status, body, headers) => (await mk(() => ({ status, body, headers })).api.editDestinationLink(PID, 1, { url: "https://jobs.example.invalid/a" }));
  let r = await run(400, { error: "the same url appears twice", field: "url" }); assert.equal(r.error.field, "url"); assert.equal(r.error.message, "the same url appears twice");
  r = await run(400, { error: "kind_not_supported", field: "kind", code: "kind_not_supported" }); assert.equal(r.error.code, "kind_not_supported");
  r = await run(404, { error: "link_not_found", code: "link_not_found" }); assert.equal(r.error.code, "link_not_found");
  r = await run(403, { error: "plan_required", code: "plan_required" }); assert.equal(r.error.code, "plan_required");
  r = await run(429, { error: "rate_limited", code: "rate_limited" }, { "retry-after": "30" }); assert.equal(r.error.retryAfter, 30);
});

// ---- the panel, on a tiny fake DOM (just what js/dom.js and js/link-panel.js use)
class FNode {}
class FText extends FNode { constructor(t) { super(); this.data = String(t); this.parent = null; } get textContent() { return this.data; } }
class FEl extends FNode {
  constructor(tag) { super(); this.tag = tag; this.attrs = {}; this.children = []; this.listeners = {}; this.parent = null; this.value = ""; this.disabled = false; this.className = ""; }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } removeAttribute(k) { delete this.attrs[k]; }
  get hidden() { return "hidden" in this.attrs; } set hidden(v) { if (v) this.attrs.hidden = ""; else delete this.attrs.hidden; }
  append(...kids) { for (const k of kids) { const n = k instanceof FNode ? k : new FText(k); if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = this; this.children.push(n); } }
  replaceChildren() { for (const c of this.children) c.parent = null; this.children = []; }
  get textContent() { return this.children.map((c) => c.textContent).join(""); } set textContent(v) { this.replaceChildren(); this.append(String(v)); }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  async fire(t) { for (const fn of this.listeners[t] || []) await fn({ preventDefault() {} }); }
  focus() { globalThis.document.activeElement = this; }
}
globalThis.Node = FNode;
globalThis.document = { createElement: (t) => new FEl(t), createTextNode: (t) => new FText(t), activeElement: null };
const { mountLinkPanel } = await import("../js/link-panel.js");
const all = (el, pred, out = []) => { if (el instanceof FEl) { if (pred(el)) out.push(el); for (const c of el.children) all(c, pred, out); } return out; };
const byClass = (el, cls) => all(el, (e) => e.className.split(" ").includes(cls));
const byTag = (el, tag) => all(el, (e) => e.tag === tag);
const visible = (el) => { for (let e = el; e; e = e.parent) if (e.hidden) return false; return true; };
const text = (el) => all(el, (e) => visible(e) && e !== el && e.children.some((c) => c instanceof FText)).map((e) => e.children.filter((c) => c instanceof FText).map((c) => c.data).join("")).join(" | ");
const serialize = (el) => JSON.stringify(all(el, () => true).map((e) => [e.tag, e.attrs, e.value, e.children.filter((c) => c instanceof FText).map((c) => c.data)]));
const btn = (el, name) => byTag(el, "button").find((b) => b.attrs["aria-label"] === name || (!b.attrs["aria-label"] && b.children.map((c) => c.textContent).join("") === name));
const rowEl = (host, n) => byClass(host, "link-row").find((r) => r.attrs["data-position"] === String(n));
const win = () => ({ closed: false, opener: "the-opener", location: null, closeCalls: 0, close() { this.closed = true; this.closeCalls++; } });

function setup(over = {}) {
  const host = new FEl("div"), hint = new FEl("div"), note = new FEl("div"), log = [], timers = [];
  const wins = []; const o = Object.assign({ opens: "window", links: [L(1), L(2, { label: "Careers" }), L(3)] }, over);
  const api = Object.assign({
    checkDestinationLink: async (id, pos) => { log.push(["check", id, pos, wins.length]); return { ok: true, status: 200, data: { go_url: TICKET, expires_at: EXP } }; },
    editDestinationLink: async (id, pos, change) => { log.push(["edit", id, pos, change]); return { ok: true, status: 200, data: ANSWER("edit", pos, o.links) }; },
    removeDestinationLink: async (id, pos) => { log.push(["remove", id, pos]); return { ok: true, status: 200, data: ANSWER("remove", pos, o.links.filter((l) => l.position !== pos)) }; },
  }, over.api || {});
  const events = { ended: 0, stale: 0, changed: [] };
  const panel = mountLinkPanel({ host, hintEl: hint, noteEl: note, api, getPostingId: () => PID, openBlank: () => { if (o.opens === "blocked") return null; const w = win(); wins.push(w); return w; },
    schedule: (ms, fn) => timers.push({ ms, fn }), now: () => Date.parse("2026-10-05T12:00:00+00:00"), isBlocked: () => !!over.blocked,
    onSessionEnded: async () => { events.ended++; }, onStale: async () => { events.stale++; }, onChanged: async (l) => { events.changed.push(l); } });
  panel.render(o.links);
  return { host, hint, note, panel, log, timers, wins, events };
}

test("panel: one row per stored link by its stored position, three buttons each with the link number in their names; the hint and the address-bar note appear once there are rows", () => {
  const s = setup({ links: [L(1), L(3, { label: "Careers site" })] });
  assert.deepEqual(byClass(s.host, "link-row-title").map((e) => e.textContent), ["Link 1", "Link 3: Careers site"]);
  assert.deepEqual(byClass(s.host, "link-row-meta").map((e) => e.textContent), ["Candidates see: LinkedIn", "Candidates see: LinkedIn"]);
  const r3 = rowEl(s.host, 3); assert.deepEqual(byClass(r3, "link-row-actions")[0].children.map((b) => [b.textContent, b.attrs["aria-label"]]), [["Check link", "Check Link 3"], ["Edit", "Edit Link 3"], ["Remove", "Remove Link 3"]]);
  assert.equal(s.hint.hidden, false); assert.equal(s.note.hidden, false);
  assert.equal(byClass(s.host, "link-row-actions").every((a) => a.children.length === 3), true);
  s.panel.render([]); assert.equal(s.hint.hidden, true); assert.equal(s.note.hidden, true); assert.match(text(s.host), /No destination links are stored for this posting yet\./); assert.equal(byClass(s.host, "link-row").length, 0);
});

test("panel: the edit form's address box is created empty and is never given a value, even when the server sends one; the label is prefilled", () => {
  const hostile = [Object.assign(L(1, { label: "Greenhouse" }), { url: "https://secret.example/apply?id=42", value: "https://secret.example/apply?id=42", host: "secret.example", address: "https://secret.example/apply?id=42" })];
  const s = setup({ links: hostile });
  const form = byTag(s.host, "form")[0], inputs = byTag(form, "input");
  assert.equal(inputs.length, 2); const [addr, label] = inputs;
  assert.equal(addr.value, ""); assert.equal("value" in addr.attrs, false); assert.equal(addr.attrs.autocomplete, "off"); assert.equal(addr.attrs["aria-label"], "Destination address 1"); assert.equal(addr.attrs.placeholder, "Address, starting with https://");
  assert.equal(label.value, "Greenhouse"); assert.equal(label.attrs["aria-label"], "Label for link 1 (optional)");
  assert.doesNotMatch(serialize(s.host), /secret\.example|id=42/);                  // nothing of it anywhere in the tree: not as text, not as an attribute, not as a value
});

test("panel, Check link: the tab is opened inside the click BEFORE the request, then pointed at the ticket link with its opener cut; the note says it opened and the address-bar note stays", async () => {
  const s = setup();
  await btn(rowEl(s.host, 2), "Check Link 2").fire("click");
  assert.deepEqual(s.log, [["check", PID, 2, 1]]);                          // exactly one window existed when the request was made
  assert.equal(s.wins.length, 1); assert.equal(s.wins[0].opener, null); assert.equal(s.wins[0].location, TICKET); assert.equal(s.wins[0].closeCalls, 0);
  assert.match(text(rowEl(s.host, 2)), /Opened in a new tab\. This one-time check link is used up; press Check link again to open it again\./);
  assert.equal(byTag(s.host, "a").length, 0);                               // no link is shown when the tab worked
  assert.equal(s.note.hidden, false);
  assert.doesNotMatch(serialize(s.host), /check-link-go|c1\./);              // the ticket link is nowhere on the page
  assert.equal(byTag(s.host, "button").every((b) => !b.disabled), true);
});

test("panel, Check link: the window is opened first even when the answer is slow, and a click while one check runs does nothing", async () => {
  let release; const gate = new Promise((r) => { release = r; });
  const s = setup({ api: { checkDestinationLink: async (id, pos) => { s.log.push(["check", pos, s.wins.length]); await gate; return { ok: true, status: 200, data: { go_url: TICKET, expires_at: EXP } }; } } });
  const first = btn(rowEl(s.host, 1), "Check Link 1").fire("click"), second = btn(rowEl(s.host, 3), "Check Link 3").fire("click");
  assert.equal(s.wins.length, 1); assert.equal(s.wins[0].location, null);   // the blank tab exists, nothing has been sent to it yet
  assert.equal(byTag(s.host, "button").every((b) => b.disabled), true);
  release(); await Promise.all([first, second]);
  assert.equal(s.log.length, 1); assert.equal(s.wins[0].location, TICKET);
});

test("panel, Check link: a refusal closes the blank tab and says why, in the row", async () => {
  for (const [error, re] of [[{ code: "rate_limited", retryAfter: 30 }, /You are checking links too fast\. Try again in 30 seconds\./], [{ code: "network" }, /Could not reach the server/], [{ code: "not_found" }, /That posting was not found/], [{ code: "bad_response" }, /did not expect/]]) {
    const s = setup({ api: { checkDestinationLink: async () => ({ ok: false, status: 400, error }) } });
    await btn(rowEl(s.host, 1), "Check Link 1").fire("click");
    assert.equal(s.wins[0].closed, true); assert.equal(s.wins[0].location, null); assert.match(text(rowEl(s.host, 1)), re); assert.equal(byTag(s.host, "a").length, 0);
  }
  const ended = setup({ api: { checkDestinationLink: async () => ({ ok: false, status: 401, error: { code: "unauthorized" } }) } });
  await btn(rowEl(ended.host, 1), "Check Link 1").fire("click"); assert.equal(ended.events.ended, 1); assert.equal(ended.wins[0].closed, true);
  const stale = setup({ api: { checkDestinationLink: async () => ({ ok: false, status: 409, error: { code: "posting_status" } }) } });
  await btn(rowEl(stale.host, 1), "Check Link 1").fire("click"); assert.equal(stale.events.stale, 1);
  const gone = setup({ api: { checkDestinationLink: async () => ({ ok: false, status: 404, error: { code: "link_not_found" } }) } });
  await btn(rowEl(gone.host, 1), "Check Link 1").fire("click"); assert.equal(gone.events.stale, 1); assert.match(text(gone.host), /That link is no longer stored, so nothing was changed\./);
});

test("panel, Check link: a blocked tab leaves a link to click for one minute (rel noopener, new tab), then says the check expired", async () => {
  const s = setup({ opens: "blocked" });
  await btn(rowEl(s.host, 3), "Check Link 3").fire("click");
  const a = byTag(rowEl(s.host, 3), "a"); assert.equal(a.length, 1);
  assert.equal(a[0].textContent, "Open Link 3"); assert.equal(a[0].attrs.href, TICKET); assert.equal(a[0].attrs.target, "_blank"); assert.equal(a[0].attrs.rel, "noopener noreferrer");
  assert.match(text(rowEl(s.host, 3)), /Your browser blocked the new tab\. Open the link here \(it works for one minute\): /);
  assert.equal(s.timers.length, 1); assert.equal(s.timers[0].ms, 60000);          // until the ticket's own expiry
  assert.doesNotMatch(text(s.host), /check-link-go|https:/);                       // the ticket link is a link target only, never text
  s.timers[0].fn();
  assert.equal(byTag(s.host, "a").length, 0); assert.match(text(rowEl(s.host, 3)), /That check expired before it opened\. Press Check link again\./);
});

test("panel, Check link: a tab the person closed at once is treated like a blocked one; the timer does not touch a newer note", async () => {
  const t = setup({ api: { checkDestinationLink: async () => { t.wins[0].closed = true; return { ok: true, status: 200, data: { go_url: TICKET, expires_at: EXP } }; } } });
  await btn(rowEl(t.host, 1), "Check Link 1").fire("click"); assert.equal(byTag(t.host, "a").length, 1);
  let n = 0; const u = setup({ opens: "blocked", api: { checkDestinationLink: async () => ({ ok: true, status: 200, data: { go_url: TICKET + (++n), expires_at: EXP } }) } });
  await btn(rowEl(u.host, 1), "Check Link 1").fire("click"); u.panel.render([L(1)]);
  await btn(rowEl(u.host, 1), "Check Link 1").fire("click"); u.timers[0].fn(); assert.equal(byTag(u.host, "a").length, 1);       // the first timer is for the first ticket: the second ticket's link stays
});

test("panel, Edit: opens a form that says the address is not shown; a blank address with the same label sends nothing", async () => {
  const s = setup(); const row = rowEl(s.host, 2), form = byTag(row, "form")[0];
  assert.equal(form.hidden, true);
  await btn(row, "Edit Link 2").fire("click"); assert.equal(form.hidden, false); assert.equal(btn(row, "Edit Link 2").attrs["aria-expanded"], "true");
  assert.match(text(form), /Replace the address for Link 2: Careers/); assert.match(text(form), /The current address is not shown\. Enter the full new address, or leave the box empty to keep it\. You can change the label too\./);
  assert.equal(globalThis.document.activeElement, byTag(form, "input")[0]);
  await form.fire("submit");
  assert.equal(s.log.length, 0); assert.equal(form.hidden, true); assert.match(text(row), /Nothing was changed\./);
});

test("panel, Edit: a label-only change asks first, then sends only the label; the address box was never involved", async () => {
  const s = setup(); const row = rowEl(s.host, 2), form = byTag(row, "form")[0], [addr, label] = byTag(form, "input");
  await btn(row, "Edit Link 2").fire("click"); label.value = "Careers page"; await form.fire("submit");
  assert.equal(s.log.length, 0); assert.match(text(form), /Change the label for Link 2: Careers\? The address is kept\. Your other links are not changed\./);
  assert.equal(globalThis.document.activeElement.className, "link-confirm-text");
  await btn(form, "Go back").fire("click"); assert.equal(s.log.length, 0); assert.equal(globalThis.document.activeElement, addr);
  await form.fire("submit"); await btn(form, "Save").fire("click");
  assert.deepEqual(s.log, [["edit", PID, 2, { label: "Careers page" }]]);
  assert.equal(s.events.changed.length, 1); assert.match(text(s.host), /The label for Link 2 was changed\./); assert.match(globalThis.document.activeElement.textContent, /The label for Link 2 was changed\./);
});

test("panel, Edit: a new address replaces that one link; the confirm step says so; the box is emptied after the request, and nothing else is sent", async () => {
  const s = setup({ api: { editDestinationLink: async (id, pos, change) => { s.log.push(["edit", id, pos, change]); return { ok: true, status: 200, data: ANSWER("edit", pos, [L(1), L(2, { label: "Careers", check_status: "ok" }), L(3)]) }; } } });
  let row = rowEl(s.host, 3), form = byTag(row, "form")[0], [addr, label] = byTag(form, "input");
  await btn(row, "Edit Link 3").fire("click"); addr.value = "  https://jobs.example.invalid/apply/3  ";
  await form.fire("submit");
  assert.match(text(form), /Replace the address for Link 3\? Candidates will be sent to the address you entered\. Your other links are not changed\./);
  assert.equal(serialize(s.host).split("jobs.example.invalid").length - 1, 1);                              // the address is only in the box it was typed in: once, as that box's value
  await btn(form, "Save").fire("click");
  assert.deepEqual(s.log, [["edit", PID, 3, { url: "https://jobs.example.invalid/apply/3" }]]);
  assert.equal(addr.value, "");                                              // emptied
  assert.match(text(s.host), /Link 3 was replaced\./);
  assert.doesNotMatch(serialize(s.host), /jobs\.example\.invalid/);
  assert.equal(s.events.changed.length, 1);
});

test("panel, Edit: the box is emptied when the request fails too, and the server's words appear under the right box", async () => {
  const s = setup({ api: { editDestinationLink: async () => ({ ok: false, status: 400, error: { code: "request_refused", field: "url", message: "the same url appears twice", errors: [], retryAfter: null } }) } });
  const row = rowEl(s.host, 1), form = byTag(row, "form")[0], [addr] = byTag(form, "input");
  await btn(row, "Edit Link 1").fire("click"); addr.value = "https://jobs.example.invalid/dup"; await form.fire("submit"); await btn(form, "Save").fire("click");
  assert.equal(addr.value, ""); assert.equal(form.hidden, false);
  const errs = byClass(form, "field-error"); assert.equal(errs[0].hidden, false); assert.equal(errs[0].textContent, "the same url appears twice");
  assert.equal(byTag(form, "button").every((b) => !b.disabled), true);
});

test("panel, Edit: the form checks the address before asking, and a bad address stops at the form with the message and focus", async () => {
  const s = setup(); const row = rowEl(s.host, 1), form = byTag(row, "form")[0], [addr] = byTag(form, "input");
  await btn(row, "Edit Link 1").fire("click"); addr.value = "http://jobs.example.invalid/a"; await form.fire("submit");
  assert.equal(s.log.length, 0); assert.equal(byClass(form, "field-error")[0].textContent, "The address must start with https://"); assert.equal(addr.attrs["aria-invalid"], "true"); assert.equal(globalThis.document.activeElement, addr);
});

test("panel, Edit: the same address already stored says so plainly; Cancel sends nothing and empties the box", async () => {
  const s = setup({ api: { editDestinationLink: async (id, pos, change) => { s.log.push(["edit", change]); return { ok: true, status: 200, data: ANSWER("edit", pos, [L(1), L(2, { label: "Careers" }), L(3)], { changed: false }) }; } } });
  const row = rowEl(s.host, 1), form = byTag(row, "form")[0], [addr] = byTag(form, "input");
  await btn(row, "Edit Link 1").fire("click"); addr.value = "https://jobs.example.invalid/same"; await form.fire("submit"); await btn(form, "Save").fire("click");
  assert.match(text(s.host), /That is the address already stored, so nothing was changed\./);
  const t = setup(); const r2 = rowEl(t.host, 1), f2 = byTag(r2, "form")[0], [a2] = byTag(f2, "input");
  await btn(r2, "Edit Link 1").fire("click"); a2.value = "https://jobs.example.invalid/x"; await f2.fire("submit"); await btn(f2, "Cancel").fire("click");
  assert.equal(t.log.length, 0); assert.equal(a2.value, ""); assert.equal(f2.hidden, true); assert.equal(globalThis.document.activeElement, btn(r2, "Edit Link 1"));
});

test("panel, Edit: a failed save-time check of the new address is said in the page's existing words; the link is saved anyway", async () => {
  const s = setup({ api: { editDestinationLink: async (id, pos) => ({ ok: true, status: 200, data: ANSWER("edit", pos, [L(1, { check_status: "failed", check_http: 404 }), L(3)]) }) } });
  const row = rowEl(s.host, 1), form = byTag(row, "form")[0], [addr] = byTag(form, "input");
  await btn(row, "Edit Link 1").fire("click"); addr.value = "https://jobs.example.invalid/a"; await form.fire("submit"); await btn(form, "Save").fire("click");
  assert.match(text(s.host), /Link 1 was replaced\. When we checked, link 1 answered HTTP 404\. It is saved anyway/);
});

test("panel, labelled and unlabelled rows: the title, the edit title and the confirm and remove sentences all use Link N: LABEL (Link N when there is no label); a label with markup is text only", async () => {
  const hostile = "<b>x</b> & \"q\"";
  const s = setup({ links: [L(1), L(4, { label: "Careers site" }), L(6, { label: hostile }), L(8, { label: "y".repeat(100) })] });
  assert.deepEqual(byClass(s.host, "link-row-title").map((e) => e.textContent), ["Link 1", "Link 4: Careers site", "Link 6: " + hostile, "Link 8: " + "y".repeat(100)]);      // gaps stay gaps, the number is always there
  assert.equal(byTag(s.host, "b").length, 0);                                                                            // markup in a label is placed as text, never parsed
  const r4 = rowEl(s.host, 4), f4 = byTag(r4, "form")[0], c4 = byClass(r4, "link-remove")[0];
  assert.equal(byClass(f4, "link-edit-title")[0].textContent, "Replace the address for Link 4: Careers site"); assert.equal(f4.attrs["aria-label"], "Replace the address for Link 4: Careers site");
  await btn(r4, "Remove Link 4").fire("click"); assert.equal(byClass(c4, "link-confirm-text")[0].textContent, "Remove Link 4: Careers site? Candidates will no longer see it. Your other links are not changed.");
  const r1 = rowEl(s.host, 1), f1 = byTag(r1, "form")[0], c1 = byClass(r1, "link-remove")[0];
  assert.equal(byClass(f1, "link-edit-title")[0].textContent, "Replace the address for Link 1");
  await btn(r1, "Remove Link 1").fire("click"); assert.equal(byClass(c1, "link-confirm-text")[0].textContent, "Remove Link 1? Candidates will no longer see it. Your other links are not changed.");
  const r6 = rowEl(s.host, 6), f6 = byTag(r6, "form")[0], [addr6, label6] = byTag(f6, "input");
  await btn(r6, "Edit Link 6").fire("click"); addr6.value = "https://jobs.example.invalid/a"; await f6.fire("submit");
  assert.equal(byClass(f6, "link-confirm-text")[0].textContent, "Replace the address for Link 6: " + hostile + "? Candidates will be sent to the address you entered. Your other links are not changed.");
  assert.equal(byTag(s.host, "b").length, 0);
  assert.equal(label6.value, hostile);                                                                                        // the edit box holds the bare label, no number
  assert.equal(btn(r4, "Check Link 4").textContent, "Check link");                                                            // the button names are unchanged
});

test("panel, Remove: asks first in the row; Cancel sends nothing; confirming removes that one row and the others keep their numbers", async () => {
  let links = [L(1), L(2), L(3)];
  const s = setup({ links, api: { removeDestinationLink: async (id, pos) => { s.log.push(["remove", id, pos]); links = links.filter((l) => l.position !== pos); return { ok: true, status: 200, data: ANSWER("remove", pos, links) }; } } });
  const row = rowEl(s.host, 2), confirm = byClass(row, "link-remove")[0];
  assert.equal(confirm.hidden, true);
  await btn(row, "Remove Link 2").fire("click"); assert.equal(confirm.hidden, false); assert.match(text(confirm), /Remove Link 2\? Candidates will no longer see it\. Your other links are not changed\./);
  await btn(confirm, "Cancel").fire("click"); assert.equal(confirm.hidden, true); assert.equal(s.log.length, 0);
  await btn(row, "Remove Link 2").fire("click"); await byTag(confirm, "button").find((b) => b.textContent === "Remove").fire("click");
  assert.deepEqual(s.log, [["remove", PID, 2]]);
  assert.deepEqual(byClass(s.host, "link-row-title").map((e) => e.textContent), ["Link 1", "Link 3"]);          // a gap: not renumbered
  assert.match(text(s.host), /Link 2 was removed\./); assert.equal(s.events.changed.length, 1); assert.deepEqual(s.events.changed[0].map((l) => l.position), [1, 3]);
  assert.ok(rowEl(s.host, 3)); assert.equal(rowEl(s.host, 2), undefined);
  assert.match(globalThis.document.activeElement.textContent, /Link 2 was removed\./);                 // the row that had the focus is gone: the sentence about it has it
});

test("panel, Remove: removing the last link leaves the empty sentence and hides the hint and the address-bar note; a refusal shows its words and keeps the row", async () => {
  const s = setup({ links: [L(1)], api: { removeDestinationLink: async (id, pos) => ({ ok: true, status: 200, data: ANSWER("remove", pos, []) }) } });
  await btn(rowEl(s.host, 1), "Remove Link 1").fire("click"); await byTag(byClass(rowEl(s.host, 1), "link-remove")[0], "button")[0].fire("click");
  assert.match(text(s.host), /No destination links are stored for this posting yet\./); assert.equal(s.hint.hidden, true); assert.equal(s.note.hidden, true); assert.match(text(s.host), /Link 1 was removed\./);
  const t = setup({ api: { removeDestinationLink: async () => ({ ok: false, status: 429, error: { code: "rate_limited", retryAfter: 45 } }) } });
  await btn(rowEl(t.host, 1), "Remove Link 1").fire("click"); await byTag(byClass(rowEl(t.host, 1), "link-remove")[0], "button")[0].fire("click");
  assert.ok(rowEl(t.host, 1)); assert.match(text(rowEl(t.host, 1)), /Too many requests just now\. Try again in 45 seconds\./); assert.equal(t.events.changed.length, 0);
});

test("panel: while the page is saving something else, or one request runs, a row button does nothing; the edit and remove questions are not both open", async () => {
  const s = setup({ blocked: true }); await btn(rowEl(s.host, 1), "Check Link 1").fire("click"); await btn(rowEl(s.host, 1), "Edit Link 1").fire("click"); await btn(rowEl(s.host, 1), "Remove Link 1").fire("click");
  assert.equal(s.log.length, 0); assert.equal(s.wins.length, 0); assert.equal(byTag(rowEl(s.host, 1), "form")[0].hidden, true); assert.equal(byClass(rowEl(s.host, 1), "link-remove")[0].hidden, true);
  const t = setup(); const row = rowEl(t.host, 1);
  await btn(row, "Edit Link 1").fire("click"); await btn(row, "Remove Link 1").fire("click");
  assert.equal(byTag(row, "form")[0].hidden, true); assert.equal(byClass(row, "link-remove")[0].hidden, false);
  await btn(row, "Edit Link 1").fire("click"); assert.equal(byClass(row, "link-remove")[0].hidden, true); assert.equal(byTag(row, "form")[0].hidden, false);
});

test("panel: a redraw with the same rows keeps a half-typed edit; a redraw with changed rows starts again from the server's rows and drops the old notes", async () => {
  const s = setup(); const row = rowEl(s.host, 1), form = byTag(row, "form")[0], [addr] = byTag(form, "input");
  await btn(row, "Edit Link 1").fire("click"); addr.value = "typed"; s.panel.render([L(1), L(2, { label: "Careers" }), L(3)]);
  assert.equal(byTag(rowEl(s.host, 1), "form")[0], form); assert.equal(addr.value, "typed");
  s.panel.render([L(1), L(3)]); assert.equal(rowEl(s.host, 2), undefined); assert.deepEqual(byClass(s.host, "link-row-title").map((e) => e.textContent), ["Link 1", "Link 3"]);
  assert.equal(byTag(rowEl(s.host, 1), "form")[0].hidden, true); assert.equal(byTag(byTag(rowEl(s.host, 1), "form")[0], "input")[0].value, "");
});

test("panel: a hostile label or note from the server is text only", () => {
  const s = setup({ links: [L(1, { label: "<img src=x onerror=alert(1)>", shown_as: "<b>LinkedIn</b>" })] });
  assert.equal(byTag(s.host, "img").length, 0); assert.equal(byTag(s.host, "b").length, 0);
  assert.equal(byClass(s.host, "link-row-title")[0].textContent, "Link 1: <img src=x onerror=alert(1)>"); assert.equal(byClass(s.host, "link-row-meta")[0].textContent, "Candidates see: <b>LinkedIn</b>");
});

// ---- the candidate side already names a link by its STORED position (so a gap after a Remove reads "Application link 1" and "Application link 3"); nothing in search.js is changed for item 4
test("candidate fallback name uses the stored position, not the place in the list", async () => {
  const fs = await import("node:fs"), path = await import("node:path"), { fileURLToPath } = await import("node:url");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  assert.ok(fs.readFileSync(path.join(root, "js", "pages", "search.js"), "utf8").includes('(link.label || "Application link " + link.position)'));
  assert.match(fs.readFileSync(path.join(root, "js", "comments-model.js"), "utf8"), /"Application link " \+ /);
});

// ---- unsaved work in the rows panel (edit page unsaved-changes guard): an open edit form with something typed is pending; nothing else is
test("panel, unsaved work: an edit form that is open but untouched is not pending; a typed address or a changed label is; Cancel and discard() clear it", async () => {
  const s = setup({ links: [L(1), L(2, { label: "Careers" })] });
  assert.equal(s.panel.hasPending(), false);
  const r2 = rowEl(s.host, 2); await btn(r2, "Edit Link 2").fire("click");
  const form = byTag(r2, "form")[0], [addr, label] = byTag(form, "input");
  assert.equal(form.hidden, false); assert.equal(s.panel.hasPending(), false, "opened, nothing typed: the label is prefilled with the stored one, so it matches");
  addr.value = "   "; assert.equal(s.panel.hasPending(), false, "blanks are not work");
  addr.value = "https://jobs.example.invalid/x"; assert.equal(s.panel.hasPending(), true);
  addr.value = ""; label.value = "Careers site"; assert.equal(s.panel.hasPending(), true, "a changed label is unsaved work too");
  label.value = "Careers"; assert.equal(s.panel.hasPending(), false, "back to the stored label: not pending");
  addr.value = "https://jobs.example.invalid/x"; assert.equal(s.panel.hasPending(), true);
  await btn(form, "Cancel").fire("click"); assert.equal(form.hidden, true); assert.equal(s.panel.hasPending(), false, "Cancel closes the form and empties the address");
  await btn(r2, "Edit Link 2").fire("click"); const f2 = byTag(rowEl(s.host, 2), "form")[0]; byTag(f2, "input")[0].value = "https://jobs.example.invalid/y"; assert.equal(s.panel.hasPending(), true);
  s.panel.discard();                                                                    // draws every row again from the stored links: the form and what was typed in it are gone
  assert.equal(s.panel.hasPending(), false); assert.equal(byTag(s.host, "form").every((f) => f.hidden), true);
  assert.doesNotMatch(serialize(s.host), /jobs\.example\.invalid/, "what was typed is nowhere in the redrawn tree");
});

test("panel, unsaved work: after a successful edit the form closes and nothing is pending; a refused edit leaves the typed work pending", async () => {
  const s = setup();
  const r1 = rowEl(s.host, 1); await btn(r1, "Edit Link 1").fire("click");
  let form = byTag(r1, "form")[0]; byTag(form, "input")[0].value = "https://jobs.example.invalid/new";
  await form.fire("submit"); await btn(form, "Save").fire("click");                       // saved
  assert.equal(s.log.length, 1); assert.equal(s.panel.hasPending(), false);
  const bad = setup({ api: { editDestinationLink: async () => ({ ok: false, status: 400, error: { code: "invalid_request", field: "url", message: "url host is not a valid domain name", errors: [{ field: "url", message: "url host is not a valid domain name" }] } }) } });
  const b1 = rowEl(bad.host, 1); await btn(b1, "Edit Link 1").fire("click");
  form = byTag(b1, "form")[0]; byTag(form, "input")[0].value = "https://nope.example.invalid/x"; byTag(form, "input")[1].value = "A new label";
  await form.fire("submit"); await btn(form, "Save").fire("click");
  assert.equal(byTag(form, "input")[0].value, "", "the address box is emptied the moment any answer arrives (the write-only rule), so the refused address is not kept");
  assert.equal(bad.panel.hasPending(), true, "the answer was a refusal: the changed label is still unsaved work, and the form is still open");
});
