// comments.test.js - the comments page's pure logic (js/comments-model.js) and the API layer's comment calls and shapes.
import test from "node:test";
import assert from "node:assert/strict";
import { checkComment, checkReason, checkLinkReport, refusalText, ago, linkChoices, parseLinkChoice, COMMENT_RULES, MAX_COMMENT } from "../js/comments-model.js";
import { createApi, shapes } from "../js/api.js";

const BASE = "https://example.test", KEY = "sb_publishable_TESTKEY", ref = "0123456789abcdefghjk", uuid = "11111111-1111-4111-8111-111111111111";
const mk = (handler) => { const calls = []; const api = createApi({ baseUrl: BASE, key: KEY, getToken: async () => "TOKEN.abc.def", fetchImpl: async (url, init) => { calls.push({ url, body: init && init.body ? JSON.parse(init.body) : null }); const r = await handler(url); return { ok: r.status < 300, status: r.status, headers: { get: () => null }, text: async () => JSON.stringify(r.body) }; } }); return { api, calls }; };

test("a comment is checked before it is sent: trimmed, line breaks normalised, 10 to 2,000 characters, plain text", () => {
  assert.deepEqual(checkComment("  This posting has been up for months.\r\n No reply.  "), { text: "This posting has been up for months.\n No reply.", problem: null });
  assert.match(checkComment("").problem, /Write your comment/); assert.match(checkComment("too short").problem, /at least 10/);
  assert.match(checkComment("x".repeat(MAX_COMMENT + 1)).problem, /2,000 characters \(2,001 now\)/);
  assert.equal(checkComment("x".repeat(MAX_COMMENT)).problem, null);
  assert.match(checkComment("plaintext here").problem, /Plain text only/); assert.match(checkComment("zero​width text here").problem, /Plain text only/);
  assert.equal(checkComment("tabs\tand\nnewlines are fine here").problem, null);
});

test("the server's refusals read in words, and the two new reasons point the right way", () => {
  assert.match(refusalText({ reason: "link" }), /Report a wrong link/); assert.match(refusalText({ reason: "source" }), /where you found this posting/); assert.match(refusalText({ reason: "civility" }), /not allowed here/);
  assert.match(refusalText({ reason: "short" }), /at least 10/); assert.equal(refusalText({ message: "custom" }), "custom"); assert.equal(refusalText(null), "The comment was not accepted.");
  assert.match(COMMENT_RULES, /Comments are public and anonymous; anyone can report one\./); assert.match(COMMENT_RULES, /unless this page already shows that platform/);
});

test("reports: a one-line reason of at most 300; a wrong-link detail of at most 500 (line breaks fine)", () => {
  assert.equal(checkReason("names where the job was found"), null); assert.match(checkReason("  "), /Say why/); assert.match(checkReason("a\nb"), /One line/); assert.match(checkReason("x".repeat(301)), /300/);
  assert.equal(checkLinkReport("Went to a job board listing for another role.\nSecond line."), null); assert.match(checkLinkReport(""), /Say what happened/); assert.match(checkLinkReport("x".repeat(501)), /500/);
});

test("relative times, anonymous", () => {
  const now = Date.parse("2026-09-22T12:00:00Z");
  assert.equal(ago("2026-09-22T11:59:40Z", now), "just now"); assert.equal(ago("2026-09-22T11:45:00Z", now), "15 minutes ago"); assert.equal(ago("2026-09-22T09:00:00Z", now), "3 hours ago");
  assert.equal(ago("2026-09-21T09:00:00Z", now), "yesterday"); assert.equal(ago("2026-09-18T09:00:00Z", now), "4 days ago"); assert.equal(ago("2026-09-01T09:00:00Z", now), "3 weeks ago");
  assert.equal(ago("2026-07-01T09:00:00Z", now), "on Jul 1, 2026"); assert.equal(ago("nope", now), "");
});

test("the wrong-link choices come from the posting's links, with a 'something else' choice; a choice parses back to kind + position", () => {
  const links = [{ position: 1, kind: "apply", label: "LinkedIn" }, { position: 2, kind: "apply", label: null }, { position: 1, kind: "recruiter", firm: "Acme Staffing", label: null }];
  assert.deepEqual(linkChoices(links).map((c) => c.value), ["apply:1", "apply:2", "recruiter:1", ""]);
  assert.equal(linkChoices(links)[1].text, "Link 2: Application link 2"); assert.equal(linkChoices(links)[2].text, "Recruiter firm: Acme Staffing");
  assert.deepEqual(parseLinkChoice("recruiter:1"), { kind: "recruiter", position: 1 }); assert.deepEqual(parseLinkChoice(""), { kind: null, position: null }); assert.deepEqual(parseLinkChoice("apply:11"), { kind: null, position: null });
});

test("api: the comment calls send what the page has, and the answers are checked (ids on items, at most 25, a report id back)", async () => {
  const page = { total: 27, comments: [{ id: 7, body: "x".repeat(12), created_at: "2026-09-22T10:00:00Z" }], next_offset: 1 };
  const a = mk(() => ({ status: 200, body: page }));
  assert.equal((await a.api.candidateListComments(ref, 25)).ok, true); assert.deepEqual(a.calls[0].body, { posting_ref: ref, offset: 25 });
  assert.equal((await mk(() => ({ status: 200, body: { total: 1, comments: [{ body: "no id", created_at: "t" }], next_offset: null } })).api.candidateListComments(ref)).ok, false);
  assert.equal((await mk(() => ({ status: 200, body: { total: 30, comments: Array.from({ length: 26 }, (_, i) => ({ id: i + 1, body: "b", created_at: "t" })), next_offset: 26 } })).api.candidateListComments(ref)).ok, false);
  const e = mk(() => ({ status: 200, body: Object.assign({ posting_id: uuid }, page) }));
  assert.equal((await e.api.employerListComments(uuid)).ok, true); assert.equal(e.calls[0].url, BASE + "/functions/v1/list-posting-comments"); assert.deepEqual(e.calls[0].body, { posting_id: uuid });
  const rc = mk(() => ({ status: 201, body: { report_id: 3 } }));
  assert.equal((await rc.api.candidateReportComment(7, "names the source")).ok, true); assert.deepEqual(rc.calls[0].body, { comment_id: 7, reason: "names the source" });
  const rl = mk(() => ({ status: 201, body: { report_id: 4 } }));
  assert.equal((await rl.api.candidateReportLink(ref, "apply", 1, "went elsewhere")).ok, true); assert.deepEqual(rl.calls[0].body, { posting_ref: ref, detail: "went elsewhere", kind: "apply", position: 1 });
  const rl2 = mk(() => ({ status: 201, body: { report_id: 5 } }));
  await rl2.api.candidateReportLink(ref, null, null, "something else"); assert.deepEqual(rl2.calls[0].body, { posting_ref: ref, detail: "something else" });
  assert.equal((await mk(() => ({ status: 201, body: { ok: true } })).api.candidateReportLink(ref, null, null, "x")).ok, false);
  assert.equal(shapes.detail({ posting: null }), false);
});
