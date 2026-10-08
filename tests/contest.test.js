// contest.test.js - contested comments (item A): the model (notice, six reasons, limits, validators, the words for every answer), the API call and the two reader shapes, and the screen parts
// (js/contest-ui.js) run against a tiny fake DOM. Nothing here touches a network: the API is built over a stub fetch, or replaced by a stub.
import test from "node:test";
import assert from "node:assert/strict";
import { createApi, shapes, CONTEST_CATEGORY_CODES } from "../js/api.js";
import { CONTEST_NOTICE, CONTEST_CONFIRM, CONTEST_ALREADY, CONTEST_CATEGORIES, contestCategoryLabel, DEFAULT_CONTEST_LIMITS, contestLimits, normalizeExplanation, contestCounter, checkContestCategory, checkContestExplanation, contestRefusal } from "../js/comments-model.js";

const BASE = "https://example.test", KEY = "sb_publishable_TESTKEY", uuid = "11111111-1111-4111-8111-111111111111", FILED = "2026-10-02T15:43:27.412+00:00";
const OK = { ok: true, contest: { id: uuid, status: "open", filed_at: FILED } };
const mk = (handler) => { const calls = []; const api = createApi({ baseUrl: BASE, key: KEY, getToken: async () => "TOKEN.abc.def", fetchImpl: async (url, init) => { calls.push({ url, init, body: init && init.body ? JSON.parse(init.body) : null }); const r = await handler(url); return { ok: r.status < 300, status: r.status, headers: { get: (k) => (r.headers && r.headers[k]) || null }, text: async () => JSON.stringify(r.body) }; } }); return { api, calls }; };
const good = "The opening was filled in August and this comment describes a different team.";   // 77 characters

test("the notice is the exact approved text, and the six reasons are the approved list with matching codes in the API", () => {
  assert.equal(CONTEST_NOTICE, "This comment has been contested by the employer and is under review. It may be removed after additional investigation, at the sole discretion of FightGhostJobs.com.");
  assert.deepEqual(CONTEST_CATEGORIES.map((c) => [c.code, c.label]), [
    ["inaccurate", "Factually inaccurate about this opening"], ["closed_or_outdated", "Opening closed or comment outdated"], ["confidential_or_personal", "Contains confidential or personal information"],
    ["not_about_posting", "Not about this opening"], ["abusive", "Abusive language"], ["other", "Other"]]);
  assert.deepEqual(CONTEST_CATEGORY_CODES, CONTEST_CATEGORIES.map((c) => c.code));
  assert.equal(contestCategoryLabel("abusive"), "Abusive language"); assert.equal(contestCategoryLabel("Abusive"), null);
  assert.equal(CONTEST_ALREADY, "This comment has already been contested and cannot be contested again.");
  assert.match(CONTEST_CONFIRM, /stays visible/); assert.match(CONTEST_CONFIRM, /only once/);
  assert.deepEqual({ ...DEFAULT_CONTEST_LIMITS }, { min: 30, max: 1000 });
});

test("the reason is checked: only the six codes, exactly", () => {
  for (const c of CONTEST_CATEGORY_CODES) assert.equal(checkContestCategory(c), null);
  for (const bad of ["", "Inaccurate", " other", "spam", null, undefined]) assert.match(checkContestCategory(bad), /Choose a reason/);
});

test("the explanation is required for every reason: trimmed, counted in characters, limits from the server when it has spoken", () => {
  assert.deepEqual(checkContestExplanation("  " + good + "\r\n ", DEFAULT_CONTEST_LIMITS), { text: good, problem: null });
  assert.match(checkContestExplanation("", DEFAULT_CONTEST_LIMITS).problem, /required for every reason/); assert.match(checkContestExplanation(" \n\t ", DEFAULT_CONTEST_LIMITS).problem, /required/);
  assert.match(checkContestExplanation("too short", DEFAULT_CONTEST_LIMITS).problem, /at least 30 characters \(9 now\)/);
  assert.equal(checkContestExplanation("x".repeat(30), DEFAULT_CONTEST_LIMITS).problem, null); assert.equal(checkContestExplanation("x".repeat(1000), DEFAULT_CONTEST_LIMITS).problem, null);
  assert.match(checkContestExplanation("x".repeat(1001), DEFAULT_CONTEST_LIMITS).problem, /1,000 characters \(1,001 now\)/);
  assert.equal(checkContestExplanation("\u{1F600}".repeat(30), DEFAULT_CONTEST_LIMITS).problem, null);                     // characters, not UTF-16 units
  assert.match(checkContestExplanation("x".repeat(40), { min: 50, max: 200 }).problem, /at least 50/); assert.equal(checkContestExplanation("x".repeat(150), { min: 50, max: 200 }).problem, null);
  assert.equal(checkContestExplanation("tabs\tand\nnewlines are fine in an explanation here", DEFAULT_CONTEST_LIMITS).problem, null);
  for (const bad of ["a" + String.fromCharCode(0) + "b", "zero" + String.fromCharCode(8203) + "width", "bidi" + String.fromCharCode(8238) + "mark", "bom" + String.fromCharCode(65279) + "here"]) assert.match(checkContestExplanation(bad + " ".repeat(0) + "x".repeat(40), DEFAULT_CONTEST_LIMITS).problem, /Plain text only/);
  assert.equal(normalizeExplanation("\r\n a\r\nb \n"), "a\nb");
});

test("the live counter shows the count against the maximum and the minimum", () => {
  assert.equal(contestCounter("", DEFAULT_CONTEST_LIMITS), "0 / 1,000 characters (at least 30)");
  assert.equal(contestCounter("  hello  ", DEFAULT_CONTEST_LIMITS), "5 / 1,000 characters (at least 30)");
  assert.equal(contestCounter("x".repeat(12), { min: 50, max: 200 }), "12 / 200 characters (at least 50)");
});

test("the server's numbers replace the defaults only when they are sane integers", () => {
  assert.deepEqual(contestLimits({ code: "explanation_length", min: 50, max: 200 }, DEFAULT_CONTEST_LIMITS), { min: 50, max: 200 });
  for (const bad of [{ min: "50", max: 200 }, { min: 0, max: 200 }, { min: 300, max: 200 }, { min: 50, max: 5001 }, { min: 50.5, max: 200 }, {}]) assert.deepEqual(contestLimits({ code: "explanation_length", ...bad }, { min: 31, max: 999 }), { min: 31, max: 999 });
  assert.deepEqual(contestLimits({ code: "limit_open", min: 50, max: 200 }, { min: 31, max: 999 }), { min: 31, max: 999 });                 // only an explanation_length answer carries them
  assert.deepEqual(contestLimits(null, undefined), { min: 30, max: 1000 });
});

test("every answer of the contest function has plain words; the neutral and the settled ones", () => {
  const L = { min: 50, max: 200 };
  assert.deepEqual(contestRefusal({ code: "invalid_category" }, L), { text: "Choose a reason from the list.", where: "category", settled: false });
  assert.deepEqual(contestRefusal({ code: "explanation_length" }, L), { text: "The explanation must be between 50 and 200 characters.", where: "explanation", settled: false });
  assert.equal(contestRefusal({ code: "explanation_chars" }, L).where, "explanation");
  assert.deepEqual(contestRefusal({ code: "already_contested" }, L), { text: "This comment has already been contested and cannot be contested again.", where: "form", settled: true });
  const nf = contestRefusal({ code: "not_found" }, L); assert.equal(nf.settled, true); assert.doesNotMatch(nf.text, /owner|someone|exist|hidden|organization/i);
  assert.match(contestRefusal({ code: "limit_open", limit: 5 }, L).text, /already has 5 contests under review/); assert.match(contestRefusal({ code: "limit_open" }, L).text, /most contests under review/);
  assert.match(contestRefusal({ code: "limit_month", limit: 20 }, L).text, /already filed 20 contests in the last 30 days/); assert.equal(contestRefusal({ code: "limit_month", limit: 20 }, L).settled, false);
  assert.match(contestRefusal({ code: "rate_limited", retryAfter: 30 }, L).text, /Try again in 30 seconds/); assert.match(contestRefusal({ code: "rate_limited" }, L).text, /Try again in 60 seconds/);
  assert.match(contestRefusal({ code: "server_error" }, L).text, /server had a problem/); assert.match(contestRefusal({ code: "network" }, L).text, /Could not reach/); assert.match(contestRefusal({ code: "bad_response" }, L).text, /did not expect/);
  for (const c of ["invalid_category", "explanation_length", "explanation_chars", "already_contested", "not_found", "limit_open", "limit_month", "rate_limited", "server_error"]) assert.doesNotMatch(contestRefusal({ code: c, limit: 5 }, L).text, /within \d|business day|hours?\b.*review/i, c);
});

test("api: the request is exactly comment_id, category and explanation, with the session token and no identity in the body", async () => {
  const a = mk(() => ({ status: 201, body: OK }));
  const r = await a.api.contestComment(61, "other", good);
  assert.equal(r.ok, true); assert.equal(r.data.contest.id, uuid);
  assert.equal(a.calls.length, 1); assert.equal(a.calls[0].url, BASE + "/functions/v1/contest-comment");
  assert.deepEqual(a.calls[0].body, { comment_id: 61, category: "other", explanation: good }); assert.deepEqual(Object.keys(a.calls[0].body), ["comment_id", "category", "explanation"]);
  assert.equal(a.calls[0].init.headers.Authorization, "Bearer TOKEN.abc.def"); assert.equal(a.calls[0].init.headers.apikey, KEY);
  const none = createApi({ baseUrl: BASE, key: KEY, getToken: async () => null, fetchImpl: async () => { throw new Error("no call expected"); } });
  assert.deepEqual(await none.contestComment(61, "other", good), { ok: false, status: 401, error: { code: "no_session" } });
});

test("api: a malformed request is refused before any call", async () => {
  const a = mk(() => ({ status: 201, body: OK }));
  for (const args of [[0, "other", good], [-1, "other", good], [1.5, "other", good], ["61", "other", good], [null, "other", good], [61, "Other", good], [61, "", good], [61, "spam", good], [61, "other", 5], [61, "other", null], [61, undefined, good]]) {
    const r = await a.api.contestComment(...args); assert.equal(r.ok, false); assert.equal(r.error.code, "invalid_request");
  }
  assert.equal(a.calls.length, 0);
});

test("api: the answer is checked: anything but ok:true with an open contest and a real id is a broken answer", async () => {
  for (const bad of [{}, { ok: false }, { ok: true }, { ok: true, contest: { id: "nope", status: "open", filed_at: FILED } }, { ok: true, contest: { id: uuid, status: "left", filed_at: FILED } },
    { ok: true, contest: { id: uuid, status: "open" } }, { ok: true, contest: null }, [], null]) {
    const r = await mk(() => ({ status: 201, body: bad })).api.contestComment(61, "other", good); assert.equal(r.ok, false, JSON.stringify(bad)); assert.equal(r.error.code, "bad_response");
  }
});

test("api: refusals keep their code, and the server's numbers ride along only when they are whole positive numbers", async () => {
  const run = async (status, body, headers) => (await mk(() => ({ status, body, headers })).api.contestComment(61, "other", good));
  let r = await run(400, { code: "explanation_length", min: 50, max: 200 }); assert.equal(r.ok, false); assert.equal(r.status, 400); assert.equal(r.error.code, "explanation_length"); assert.equal(r.error.min, 50); assert.equal(r.error.max, 200);
  r = await run(400, { code: "explanation_length", min: "50", max: -1 }); assert.equal(r.error.min, undefined); assert.equal(r.error.max, undefined);
  r = await run(409, { code: "limit_open", limit: 5 }); assert.equal(r.error.code, "limit_open"); assert.equal(r.error.limit, 5);
  r = await run(409, { code: "limit_month", limit: 20 }); assert.equal(r.error.code, "limit_month"); assert.equal(r.error.limit, 20);
  r = await run(409, { code: "already_contested" }); assert.equal(r.error.code, "already_contested"); assert.equal(r.error.limit, undefined);
  r = await run(400, { code: "invalid_category", field: "category" }); assert.equal(r.error.code, "invalid_category"); assert.equal(r.error.field, "category");
  r = await run(404, { code: "not_found" }); assert.equal(r.error.code, "not_found");
  r = await run(404, {}); assert.equal(r.error.code, "not_found");
  r = await run(429, { code: "rate_limited" }, { "retry-after": "42" }); assert.equal(r.error.code, "rate_limited"); assert.equal(r.error.retryAfter, 42);
  r = await run(500, { error: "boom" }); assert.equal(r.error.code, "server_error");
});

// the three contest keys of a reader item, for each of the four states
const STATE = {
  none: { contested: false, contest_state: "none", contest_filed_at: null },
  open: { contested: true, contest_state: "open", contest_filed_at: FILED },
  left: { contested: false, contest_state: "left", contest_filed_at: FILED },
  removed: { contested: false, contest_state: "removed", contest_filed_at: FILED },
};
const item = (extra, id = 7) => Object.assign({ id, body: "x".repeat(12), created_at: "2026-10-01T10:00:00Z" }, extra);
const page = (items) => ({ total: items.length, comments: items, next_offset: null });
const REF = "0123456789abcdefghjk";
const READERS = [["candidate", (a) => a.candidateListComments(REF), (b) => b], ["employer", (a) => a.employerListComments(uuid), (b) => Object.assign({ posting_id: uuid }, b)]];

test("api: both readers pass all four contest states through, with the date, on the item the page receives", async () => {
  for (const [name, read, wrap] of READERS) {
    const items = Object.keys(STATE).map((k, i) => item(STATE[k], i + 1));
    const r = await read(mk(() => ({ status: 200, body: wrap(page(items)) })).api); assert.equal(r.ok, true, name);
    assert.deepEqual(r.data.comments.map((c) => [c.contested, c.contest_state, c.contest_filed_at]), [[false, "none", null], [true, "open", FILED], [false, "left", FILED], [false, "removed", FILED]], name);
  }
});

test("api: the contest keys are required on both readers; a missing, mistyped, unknown or inconsistent one is a broken answer, never 'no contest'", async () => {
  const drop = (o, k) => { const c = Object.assign({}, o); delete c[k]; return c; };
  const bads = [];
  for (const st of Object.keys(STATE)) for (const k of ["contested", "contest_state", "contest_filed_at"]) bads.push([st + " without " + k, drop(STATE[st], k)]);
  bads.push(["old reader: contested only", { contested: true }], ["old reader: contested false only", { contested: false }], ["nothing", {}]);
  for (const v of [undefined, null, "true", 1, 0]) bads.push(["contested " + String(v), Object.assign({}, STATE.none, { contested: v })]);
  for (const v of [undefined, null, "", "OPEN", "Open", "decided", "modified", "closed", "under_review", 1, true, ["open"]]) bads.push(["state " + String(v), Object.assign({}, STATE.open, { contest_state: v })]);
  for (const v of [undefined, 0, 1, true, {}, [], 1759419807412, "", "not a date", "2026-13-45"]) bads.push(["filed_at " + JSON.stringify(v), Object.assign({}, STATE.open, { contest_filed_at: v })]);
  // inconsistent: 'none' iff filed_at is null; contested iff state is 'open'
  bads.push(["none with a date", Object.assign({}, STATE.none, { contest_filed_at: FILED })], ["open without a date", Object.assign({}, STATE.open, { contest_filed_at: null })],
    ["left without a date", Object.assign({}, STATE.left, { contest_filed_at: null })], ["removed without a date", Object.assign({}, STATE.removed, { contest_filed_at: null })],
    ["open but contested false", Object.assign({}, STATE.open, { contested: false })], ["left but contested true", Object.assign({}, STATE.left, { contested: true })],
    ["removed but contested true", Object.assign({}, STATE.removed, { contested: true })], ["none but contested true", Object.assign({}, STATE.none, { contested: true })]);
  for (const [name, read, wrap] of READERS) for (const [label, extra] of bads) {
    const r = await read(mk(() => ({ status: 200, body: wrap(page([item(STATE.none, 1), item(extra, 2)])) })).api);
    assert.equal(r.ok, false, name + ": " + label); assert.equal(r.error.code, "bad_response", name + ": " + label);
  }
  for (const st of Object.keys(STATE)) assert.equal(shapes.commentItem(item(STATE[st])), true, st);
  assert.equal(shapes.commentItem(item({})), false);
  assert.equal(shapes.commentItem(item(Object.assign({}, STATE.open, { contest_filed_at: "2026-10-02T15:43:27+00:00" }))), true);       // any parseable ISO timestamp
});

// ---- the screen parts, on a tiny fake DOM (just what js/dom.js and js/contest-ui.js use)
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
  remove() { if (this.parent) { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; } }
  after(n) { const p = this.parent; if (n.parent) n.remove(); n.parent = p; p.children.splice(p.children.indexOf(this) + 1, 0, n); }
}
globalThis.Node = FNode;
globalThis.document = { createElement: (t) => new FEl(t), createTextNode: (t) => new FText(t), activeElement: null };
const { h } = await import("../js/dom.js");
const { fmtDate } = await import("../js/format.js");
const { contestNotice, contestDecided, addContestPart, mountContest } = await import("../js/contest-ui.js");
const all = (el, pred, out = []) => { if (el instanceof FEl) { if (pred(el)) out.push(el); for (const c of el.children) all(c, pred, out); } return out; };
const byClass = (el, cls) => all(el, (e) => e.className.split(" ").includes(cls));
const one = (el, cls) => { const r = byClass(el, cls); assert.equal(r.length, 1, cls + " x" + r.length); return r[0]; };
const byTag = (el, tag) => all(el, (e) => e.tag === tag);
const wire = (apiStub) => {
  const meta = h("div", {}, h("span", {}, "Verified candidate")), body = h("p", {}, "The comment text"), card = h("article", {}, meta, body);
  const limits = { min: 30, max: 1000 }; const session = { ended: 0 };
  const ctl = mountContest({ api: apiStub, comment: { id: 61 }, card, after: body, meta, limits, onAuthFailure: async () => { session.ended++; } });
  return { meta, body, card, limits, session, ...ctl, select: byTag(ctl.form, "select")[0], text: byTag(ctl.form, "textarea")[0], err: one(ctl.form, "field-error"), count: all(ctl.form, (e) => e.attrs.id === "contest-61-count")[0],
    fields: one(ctl.form, "contest-fields"), confirm: one(ctl.form, "contest-confirm"), buttons: Object.fromEntries(byTag(ctl.form, "button").map((b) => [b.textContent, b])) };
};
const fillAndContinue = async (w, cat, text) => { w.select.value = cat; w.text.value = text; await w.form.fire("submit"); };

test("screen: the notice block carries the exact text for candidates, and the owner also sees that it is under review", () => {
  const cand = contestNotice(); assert.equal(one(cand, "contest-notice-text").textContent, CONTEST_NOTICE); assert.equal(byClass(cand, "contest-notice-tag").length, 0);
  const own = contestNotice({ employer: true }); assert.equal(one(own, "contest-notice-text").textContent, CONTEST_NOTICE); assert.equal(one(own, "contest-notice-tag").textContent, "Under review");
  assert.match(one(contestNotice({ employer: true, since: FILED }), "contest-notice-tag").textContent, /^Under review since [A-Z][a-z]{2} \d{1,2}$/);
  assert.equal(cand.getAttribute("role"), "note");
});

test("screen: the control is a button in the comment's own row with a form that starts closed, labelled fields, six reasons and a live counter", () => {
  const w = wire({ contestComment: async () => { throw new Error("no call expected"); } });
  assert.equal(w.trigger.textContent, "Contest this comment"); assert.equal(w.trigger.getAttribute("aria-expanded"), "false"); assert.ok(w.meta.children.includes(w.trigger));
  assert.equal(w.form.hidden, true); assert.ok(w.card.children.includes(w.form));
  assert.deepEqual(byTag(w.select, "option").map((o) => o.textContent), ["Choose a reason"].concat(CONTEST_CATEGORIES.map((c) => c.label)));
  assert.deepEqual(byTag(w.select, "option").map((o) => o.attrs.value), [""].concat(CONTEST_CATEGORY_CODES));
  const labels = byTag(w.form, "label"); assert.deepEqual(labels.map((l) => [l.textContent, l.getAttribute("for")]), [["Reason", w.select.getAttribute("id")], ["Explanation", w.text.getAttribute("id")]]);
  assert.equal(w.count.textContent, "0 / 1,000 characters (at least 30)"); w.text.value = "twelve chars"; return w.text.fire("input").then(() => assert.equal(w.count.textContent, "12 / 1,000 characters (at least 30)"));
});

test("screen: open moves focus to the first field, cancel closes and returns focus; nothing is sent either way", async () => {
  const w = wire({ contestComment: async () => { throw new Error("no call expected"); } });
  await w.trigger.fire("click"); assert.equal(w.form.hidden, false); assert.equal(w.trigger.getAttribute("aria-expanded"), "true"); assert.equal(globalThis.document.activeElement, w.select);
  await w.buttons["Cancel"].fire("click"); assert.equal(w.form.hidden, true); assert.equal(w.trigger.getAttribute("aria-expanded"), "false"); assert.equal(globalThis.document.activeElement, w.trigger);
});

test("screen: a missing reason or a short explanation stops at the form, with the message under the field and focus on it", async () => {
  const w = wire({ contestComment: async () => { throw new Error("no call expected"); } });
  await w.trigger.fire("click");
  await fillAndContinue(w, "", good); assert.equal(w.err.hidden, false); assert.match(w.err.textContent, /Choose a reason/); assert.equal(globalThis.document.activeElement, w.select); assert.equal(w.select.getAttribute("aria-invalid"), "true");
  await fillAndContinue(w, "other", "short"); assert.match(w.err.textContent, /at least 30 characters \(5 now\)/); assert.equal(globalThis.document.activeElement, w.text); assert.equal(w.select.getAttribute("aria-invalid"), null); assert.equal(w.text.getAttribute("aria-invalid"), "true");
  assert.equal(w.confirm.hidden, true);
  await fillAndContinue(w, "other", "x".repeat(1001)); assert.match(w.err.textContent, /1,000 characters \(1,001 now\)/);
});

test("screen: a valid form goes to a confirm step that says the comment stays visible; Go back returns to the fields; File contest sends the code and the trimmed text, then the notice replaces the control", async () => {
  const calls = []; const w = wire({ contestComment: async (...a) => { calls.push(a); return { ok: true, status: 201, data: OK }; } });
  await w.trigger.fire("click"); await fillAndContinue(w, "closed_or_outdated", "  " + good + "  ");
  assert.equal(w.fields.hidden, true); assert.equal(w.confirm.hidden, false); assert.match(w.confirm.textContent, /stays visible to everyone, with a notice that it is under review/); assert.match(w.confirm.textContent, /only once/); assert.equal(calls.length, 0);
  assert.equal(globalThis.document.activeElement, one(w.confirm, "contest-confirm-title"));
  await w.buttons["Go back"].fire("click"); assert.equal(w.fields.hidden, false); assert.equal(w.confirm.hidden, true); assert.equal(globalThis.document.activeElement, w.text); assert.equal(calls.length, 0);
  await w.form.fire("submit"); await w.buttons["File contest"].fire("click");
  assert.deepEqual(calls, [[61, "closed_or_outdated", good]]);
  assert.equal(w.trigger.parent, null); assert.equal(w.form.parent, null);
  const notice = one(w.card, "contest-notice"); assert.equal(w.card.children[w.card.children.indexOf(w.body) + 1], notice);
  assert.equal(one(notice, "contest-notice-text").textContent, CONTEST_NOTICE); assert.match(one(notice, "contest-notice-tag").textContent, /^Under review since /); assert.equal(globalThis.document.activeElement, notice);
  assert.equal(byTag(w.card, "button").length, 0);
});

test("screen: sending twice at once sends once", async () => {
  let release, calls = 0; const gate = new Promise((r) => { release = r; });
  const w = wire({ contestComment: async () => { calls++; await gate; return { ok: true, status: 201, data: OK }; } });
  await w.trigger.fire("click"); await fillAndContinue(w, "other", good);
  const first = w.buttons["File contest"].fire("click"), second = w.buttons["File contest"].fire("click");
  assert.equal(w.buttons["File contest"].disabled, true); release(); await Promise.all([first, second]); assert.equal(calls, 1);
});

test("screen: an explanation_length answer updates the limits, the counter and the message, and goes back to the field", async () => {
  const w = wire({ contestComment: async () => ({ ok: false, status: 400, error: { code: "explanation_length", min: 50, max: 200 } }) });
  await w.trigger.fire("click"); await fillAndContinue(w, "other", good); await w.buttons["File contest"].fire("click");
  assert.deepEqual(w.limits, { min: 50, max: 200 }); assert.equal(w.count.textContent, Array.from(good).length + " / 200 characters (at least 50)");
  assert.equal(w.fields.hidden, false); assert.equal(w.confirm.hidden, true); assert.equal(w.err.textContent, "The explanation must be between 50 and 200 characters."); assert.equal(globalThis.document.activeElement, w.text);
  assert.equal(w.form.parent, w.card);
  await fillAndContinue(w, "other", "x".repeat(210)); assert.match(w.err.textContent, /200 characters \(210 now\)/);                       // the new maximum is enforced before the next send
});

test("screen: an invalid_category answer goes back to the reason field", async () => {
  const w = wire({ contestComment: async () => ({ ok: false, status: 400, error: { code: "invalid_category" } }) });
  await w.trigger.fire("click"); await fillAndContinue(w, "other", good); await w.buttons["File contest"].fire("click");
  assert.equal(w.fields.hidden, false); assert.equal(w.err.textContent, "Choose a reason from the list."); assert.equal(globalThis.document.activeElement, w.select);
});

test("screen: already contested shows the plain message and removes the control for good", async () => {
  const w = wire({ contestComment: async () => ({ ok: false, status: 409, error: { code: "already_contested" } }) });
  await w.trigger.fire("click"); await fillAndContinue(w, "other", good); await w.buttons["File contest"].fire("click");
  assert.equal(w.trigger.parent, null); assert.equal(w.form.parent, null);
  const boxes = byClass(w.card, "alert"); assert.equal(boxes.length, 1); assert.equal(boxes[0].textContent, "This comment has already been contested and cannot be contested again.");
  assert.equal(byClass(w.card, "contest-notice").length, 0);
});

test("screen: not_found shows one neutral message and removes the control", async () => {
  const w = wire({ contestComment: async () => ({ ok: false, status: 404, error: { code: "not_found" } }) });
  await w.trigger.fire("click"); await fillAndContinue(w, "other", good); await w.buttons["File contest"].fire("click");
  assert.equal(w.trigger.parent, null); assert.equal(w.form.parent, null);
  const box = one(w.card, "alert"); assert.match(box.textContent, /could not be contested/); assert.doesNotMatch(box.textContent, /owner|someone|exist/i);
});

test("screen: a limit or a rate limit keeps the form open on the confirm step with the message, and the person can go back or cancel", async () => {
  for (const [error, re] of [[{ code: "limit_open", limit: 5 }, /already has 5 contests under review/], [{ code: "limit_month", limit: 20 }, /already filed 20 contests in the last 30 days/], [{ code: "rate_limited", retryAfter: 30 }, /Try again in 30 seconds/], [{ code: "server_error" }, /server had a problem/], [{ code: "network" }, /Could not reach/]]) {
    const w = wire({ contestComment: async () => ({ ok: false, status: 409, error }) });
    await w.trigger.fire("click"); await fillAndContinue(w, "other", good); await w.buttons["File contest"].fire("click");
    assert.equal(w.err.hidden, false); assert.match(w.err.textContent, re); assert.equal(w.confirm.hidden, false); assert.equal(w.form.parent, w.card); assert.equal(w.buttons["File contest"].disabled, false);
    await w.buttons["Cancel"].fire("click"); assert.equal(w.form.hidden, true);
  }
});

test("screen: an ended session is handed to the page, and nothing else changes on screen", async () => {
  const w = wire({ contestComment: async () => ({ ok: false, status: 401, error: { code: "unauthorized" } }) });
  await w.trigger.fire("click"); await fillAndContinue(w, "other", good); await w.buttons["File contest"].fire("click");
  assert.equal(w.session.ended, 1); assert.equal(w.form.parent, w.card);
});

// ---- the four states in both views: what a comment card shows (addContestPart is what js/pages/comments.js calls for every comment)
const cardFor = (mode, comment) => {
  const meta = h("div", {}, h("span", {}, "Verified candidate")), body = h("p", {}, "The comment text"), card = h("article", {}, meta, body);
  addContestPart({ mode, comment: Object.assign({ id: 61 }, comment), api: { contestComment: async () => { throw new Error("no call expected"); } }, card, after: body, meta, limits: { min: 30, max: 1000 }, onAuthFailure: async () => {} });
  return { card, meta, body, notices: byClass(card, "contest-notice"), decided: byClass(card, "alert"), triggers: byTag(meta, "button").filter((b) => b.textContent === "Contest this comment"), forms: byTag(card, "form") };
};

test("screen, owner view, state none: the Contest button and a closed form; no notice and no sentence", () => {
  const v = cardFor("employer", STATE.none);
  assert.equal(v.triggers.length, 1); assert.equal(v.forms.length, 1); assert.equal(v.forms[0].hidden, true); assert.equal(v.notices.length, 0); assert.equal(v.decided.length, 0);
});

test("screen, owner view, state open: the notice with the exact text and 'Under review since <date>' from contest_filed_at; no button, no form, no sentence", () => {
  const v = cardFor("employer", STATE.open);
  assert.equal(v.notices.length, 1); assert.equal(one(v.notices[0], "contest-notice-text").textContent, CONTEST_NOTICE);
  assert.equal(one(v.notices[0], "contest-notice-tag").textContent, "Under review since " + fmtDate(FILED));
  assert.match(one(v.notices[0], "contest-notice-tag").textContent, /^Under review since [A-Z][a-z]{2} \d{1,2}$/);
  assert.equal(v.triggers.length, 0); assert.equal(v.forms.length, 0); assert.equal(byTag(v.card, "button").length, 0); assert.equal(v.decided.length, 0);
  assert.equal(v.card.children[v.card.children.indexOf(v.body) + 1], v.notices[0]);
});

test("screen, owner view: the date comes from the reader, so it is the same after a reload and changes with the filing time", () => {
  const a = cardFor("employer", Object.assign({}, STATE.open, { contest_filed_at: "2026-03-05T12:00:00+00:00" })), b = cardFor("employer", Object.assign({}, STATE.open, { contest_filed_at: "2026-11-20T12:00:00+00:00" }));
  assert.equal(one(a.notices[0], "contest-notice-tag").textContent, "Under review since " + fmtDate("2026-03-05T12:00:00+00:00"));
  assert.equal(one(b.notices[0], "contest-notice-tag").textContent, "Under review since " + fmtDate("2026-11-20T12:00:00+00:00"));
  assert.notEqual(one(a.notices[0], "contest-notice-tag").textContent, one(b.notices[0], "contest-notice-tag").textContent);
});

test("screen, owner view, states left and removed: no button, no form, no notice; only the exact already-contested sentence", () => {
  for (const st of ["left", "removed"]) {
    const v = cardFor("employer", STATE[st]);
    assert.equal(v.triggers.length, 0, st); assert.equal(v.forms.length, 0, st); assert.equal(byTag(v.card, "button").length, 0, st); assert.equal(v.notices.length, 0, st);
    assert.equal(v.decided.length, 1, st); assert.equal(v.decided[0].textContent, "This comment has already been contested and cannot be contested again.", st); assert.equal(v.decided[0].textContent, CONTEST_ALREADY);
    assert.doesNotMatch(v.card.textContent, /Under review|contested by the employer|removed|left in place/, st);
  }
  assert.equal(contestDecided().textContent, CONTEST_ALREADY);
});

test("screen, candidate view: the notice (text only, no date, no label) only for an open contest; never a contest control; nothing about left or removed", () => {
  const open = cardFor("candidate", STATE.open);
  assert.equal(open.notices.length, 1); assert.equal(one(open.notices[0], "contest-notice-text").textContent, CONTEST_NOTICE); assert.equal(byClass(open.card, "contest-notice-tag").length, 0);
  assert.doesNotMatch(open.card.textContent, /Under review|since/); assert.equal(open.triggers.length, 0); assert.equal(open.forms.length, 0); assert.equal(byTag(open.card, "button").length, 0); assert.equal(open.decided.length, 0);
  for (const st of ["none", "left", "removed"]) {
    const v = cardFor("candidate", STATE[st]);
    assert.equal(v.notices.length, 0, st); assert.equal(v.triggers.length, 0, st); assert.equal(v.forms.length, 0, st); assert.equal(v.decided.length, 0, st); assert.equal(byTag(v.card, "button").length, 0, st);
    assert.equal(v.card.textContent, "Verified candidateThe comment text", st);                       // the card holds exactly what it had before: nothing was added
  }
});

test("screen: any view other than the owner's or a candidate's gets no control and no decided sentence", () => {
  for (const st of Object.keys(STATE)) { const v = cardFor("none", STATE[st]); assert.equal(v.triggers.length, 0, st); assert.equal(v.decided.length, 0, st); assert.equal(v.forms.length, 0, st); }
});

test("screen: a successful filing replaces the control with the notice and the date from the server's answer; a reload then shows the same date from the reader", async () => {
  const meta = h("div", {}, h("span", {}, "Verified candidate")), body = h("p", {}, "The comment text"), card = h("article", {}, meta, body);
  const calls = [];
  addContestPart({ mode: "employer", comment: Object.assign({ id: 61 }, STATE.none), api: { contestComment: async (...a) => { calls.push(a); return { ok: true, status: 201, data: OK }; } }, card, after: body, meta, limits: { min: 30, max: 1000 }, onAuthFailure: async () => {} });
  const form = byTag(card, "form")[0], trigger = byTag(meta, "button")[0];
  await trigger.fire("click"); byTag(form, "select")[0].value = "other"; byTag(form, "textarea")[0].value = good; await form.fire("submit");
  await byTag(form, "button").find((b) => b.textContent === "File contest").fire("click");
  assert.deepEqual(calls, [[61, "other", good]]);
  const notices = byClass(card, "contest-notice"); assert.equal(notices.length, 1); assert.equal(byTag(card, "button").length, 0); assert.equal(byTag(card, "form").length, 0);
  assert.equal(one(notices[0], "contest-notice-tag").textContent, "Under review since " + fmtDate(FILED));
  const again = cardFor("employer", STATE.open);                                                      // the reload: same words, same date, from contest_filed_at
  assert.equal(one(again.notices[0], "contest-notice-tag").textContent, one(notices[0], "contest-notice-tag").textContent);
});
