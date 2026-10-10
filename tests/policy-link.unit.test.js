// policy-link.unit.test.js - the employer's AI and hiring policy link (prompt BA, October 10, 2026): the gate states, the address check, what the editor says for each state of the link check, what a candidate is shown,
// the answer shapes, and what is sent. No browser. The server's own rules are proven in the database test and the edge function tests (ai-policy-link-migration).
import test from "node:test";
import assert from "node:assert/strict";
import { policyView, policyStoredText, policyLapsedText, policySavedText, mapPolicyError, checkPolicyUrl, candidatePolicyLine, applicationLinks, policyLink, isPolicy,
  POLICY_LABEL, POLICY_HINT, POLICY_LOCKED, POLICY_LINE_LABEL, POLICY_REMOVE_CONFIRM } from "../js/policy-link.js";
import { applyLinks, recruiterFirms, checkLinks, planNotice, checkEdit } from "../js/edit-form.js";
import { aiNoteProblem } from "../js/ai-notes.js";
import { detailLinks, linkChoices, parseLinkChoice } from "../js/comments-model.js";
import { shapes, createApi } from "../js/api.js";
import { PANEL, summarize } from "../js/dirty-state.js";
import { FRAGMENT_KEYS } from "../js/fragment-prefill.js";

const NOW = Date.parse("2026-10-10T12:00:00Z");
const VERIFIED = { verified: true, source: "pilot", expires_at: null, lapsed: false };
const LAPSED = { verified: false, source: "paid", expires_at: "2026-10-01T00:00:00Z", lapsed: true };
const FREE = { verified: false, source: null, expires_at: null, lapsed: false };
const POLICY = (o) => Object.assign({ position: 1, kind: "policy", firm: null, label: null, shown_as: "Employer's own site", check_status: "ok", check_http: 200 }, o || {});
const APPLY = (n) => ({ position: n, kind: "apply", firm: null, label: "Careers", shown_as: "Employer's own site", check_status: "ok", check_http: 200 });

test("the gate: on the tier the box is offered; not on it the sales notice and no box; lapsed the stored link is kept and hidden (not deleted)", () => {
  assert.deepEqual(policyView({ plan: VERIFIED, destination_links: [] }, NOW), { show: "form", stored: false, status: "empty", http: null, shownAs: null });
  assert.equal(policyView({ plan: FREE, destination_links: [] }, NOW).show, "locked");
  assert.equal(policyView({ plan: undefined, destination_links: [] }, NOW).show, "locked");
  const lapsed = policyView({ plan: LAPSED, destination_links: [POLICY()] }, NOW);
  assert.equal(lapsed.show, "lapsed"); assert.equal(lapsed.stored, true);
  assert.equal(policyView({ plan: LAPSED, destination_links: [] }, NOW).stored, false);
  assert.match(policyLapsedText(lapsed), /kept but hidden from candidates until it is renewed/);
  assert.match(policyLapsedText({ show: "lapsed", stored: false }), /paused until it is renewed/);
  assert.match(POLICY_LOCKED, /destination links tier/);
  // the same tier check as the destination links and the recruiter firms (one function)
  for (const p of [VERIFIED, LAPSED, FREE]) assert.equal(policyView({ plan: p, destination_links: [] }, NOW).show === "form", planNotice(p, NOW).state === "active");
});

test("the editor says what the link check found, and tells the employer when candidates are not shown the link", () => {
  const v = (o) => policyView({ plan: VERIFIED, destination_links: [POLICY(o)] }, NOW);
  assert.equal(v({}).status, "ok");
  assert.match(policyStoredText(v({})), /Candidates see it as AI and hiring policy: Employer's own site\. When we checked, the address answered\./);
  assert.equal(v({ check_status: "failed", check_http: 404 }).status, "failed");
  assert.match(policyStoredText(v({ check_status: "failed", check_http: 404 })), /did not answer \(HTTP 404\)\. Candidates are not shown it\./);
  assert.match(policyStoredText(v({ check_status: "failed", check_http: null })), /did not answer\. Candidates are not shown it\./);
  for (const c of ["skipped", null]) { assert.equal(v({ check_status: c, check_http: null }).status, "unchecked"); assert.match(policyStoredText(v({ check_status: c, check_http: null })), /could not be checked just now, so candidates are not shown it yet/); }
  assert.equal(policyStoredText(policyView({ plan: VERIFIED, destination_links: [] }, NOW)), "No AI and hiring policy link is saved.");
});

test("what is said after a save, and the refusals in words", () => {
  const ok = { changed: true, active_links: 1, links: [POLICY()] };
  assert.match(policySavedText(ok, false), /^Saved\. Candidates see it as AI and hiring policy: Employer's own site\./);
  assert.match(policySavedText({ changed: true, active_links: 1, links: [POLICY({ check_status: "failed", check_http: 404 })] }, false), /did not answer \(HTTP 404\)\. Candidates are not shown it until a check answers/);
  assert.match(policySavedText({ changed: true, active_links: 1, links: [POLICY({ check_status: "skipped", check_http: null })] }, false), /could not be checked just now/);
  assert.match(policySavedText({ changed: false, active_links: 1, links: [POLICY()] }, false), /already saved, so nothing was changed/);
  assert.match(policySavedText({ changed: true, active_links: 0, links: [] }, true), /^Removed\./);
  assert.match(policySavedText({ changed: false, active_links: 0, links: [] }, true), /no AI and hiring policy link saved, so nothing was changed/);
  assert.equal(mapPolicyError({ code: "plan_required", message: "Part of the tier." }).planRequired, true);
  assert.equal(mapPolicyError({ code: "plan_required" }).planRequired, true);
  assert.equal(mapPolicyError({ code: "x", errors: [{ field: "links[0].url", message: "url host is not allowed" }] }).field, "url host is not allowed");
  assert.equal(mapPolicyError({ code: "x", field: "status", message: "the destination links of a posting cannot be changed while its status is 'closed'" }).general, "the destination links of a posting cannot be changed while its status is 'closed'");
  assert.match(POLICY_REMOVE_CONFIRM, /Remove the AI and hiring policy link/);
});

test("validation: the same address rules as the application links' address box, row for row", () => {
  const cases = ["", "   ", "http://policy.example/x", "policy.example/x", "https://", "https://policy.example/ok", "  https://policy.example/ok  ", "HTTPS://policy.example/a?b=c#d", "https://" + "a".repeat(2100) + ".example", "ftp://x.example", "not a link", "https://user:pw@policy.example/x"];
  for (const raw of cases) {
    const mine = checkPolicyUrl(raw), theirs = checkLinks([{ url: raw }]);
    const theirOk = theirs.links.length === 1 && Object.keys(theirs.errors).length === 0;
    assert.equal(mine.ok, theirOk, JSON.stringify(raw).slice(0, 50) + ": " + (mine.error || "ok"));
    if (mine.ok) assert.equal(mine.url, theirs.links[0].url);
  }
  assert.match(checkPolicyUrl("").error, /use Remove/);
  assert.match(checkPolicyUrl("http://x.example").error, /must start with https/);
});

test("the AI notes keep their rule (no web addresses) and the policy link is a separate field: the opening's own edit never carries it", () => {
  assert.match(aiNoteProblem("see https://policy.example/ai"), /No web addresses here/);
  assert.equal(aiNoteProblem("Resumes are scored by a keyword match."), null);
  const orig = { title: "T", req_number: "R1", locations: [], location_ids: [], locations_attested: false, is_remote: true, ai_filtering: false, ai_interview_other: false, ai_filtering_note: null, ai_interview_note: null,
    third_party_recruiter: false, req_searchable: true, destination_links_exclusive: false, applicant_cap: null, description_text: "d", stored_status: "live", status: "live", id: "3f1d5b1e-0000-4000-8000-000000000001" };
  const v = { title: "T2", req: "R1", desc: "d", locEntries: [], attested: false, remote: true, appcap: "", aiFilter: false, aiInterview: false, aiFilterNote: "", aiInterviewNote: "", recruiter: false, reqSearchable: true, exclusive: undefined, note: "why", policyUrl: "https://policy.example/ai" };
  const c = checkEdit(orig, v);
  assert.ok(c.body, JSON.stringify(c.errors));
  assert.ok(!JSON.stringify(c.body).includes("policy"), "the main save never carries the policy link: " + JSON.stringify(c.body));
});

test("what a candidate is shown: one line when the server sent the entry, nothing otherwise; never a summary or a verdict", () => {
  const links = [{ position: 1, kind: "apply", firm: null, label: "Employer's own site" }, { position: 1, kind: "policy", firm: null, label: "Employer's own site" }];
  assert.deepEqual(candidatePolicyLine(links), { position: 1, label: "AI and hiring policy:", where: "Employer's own site" });
  // the server sends the entry only while the organization is on the tier, the opening is live and the stored check answered: every other state arrives as NO entry
  for (const state of ["the check failed", "the check could not be tried", "never checked", "the plan lapsed", "not on the tier", "no policy link"]) assert.equal(candidatePolicyLine([links[0]]), null, state);
  assert.equal(candidatePolicyLine([]), null); assert.equal(candidatePolicyLine(null), null); assert.equal(candidatePolicyLine(undefined), null);
  assert.equal(candidatePolicyLine([{ position: 1, kind: "policy", firm: null, label: null }]), null, "an entry without a place is not shown");
  assert.equal(candidatePolicyLine([{ position: 1, kind: "policy", firm: null, label: "" }]), null);
  assert.equal(POLICY_LINE_LABEL, "AI and hiring policy:");
  // the words: no claim about the page
  for (const s of [POLICY_LABEL, POLICY_HINT, POLICY_LOCKED, POLICY_LINE_LABEL, POLICY_REMOVE_CONFIRM, policyStoredText(policyView({ plan: VERIFIED, destination_links: [POLICY()] }, NOW)), policySavedText({ changed: true, links: [POLICY()] }, false)])
    assert.ok(!/verif|approv|complian|certif|endors|guarantee|summar|vouch|safe|legal/i.test(s), s);
});

test("the policy link is never an application link: it is left out of every apply and report path", () => {
  const all = [APPLY(1), { position: 1, kind: "recruiter", firm: "Firm", label: null, shown_as: null, check_status: null, check_http: null }, POLICY()];
  assert.deepEqual(applyLinks(all).map((l) => l.kind), ["apply"]);
  assert.deepEqual(recruiterFirms(all).map((l) => l.kind), ["recruiter"]);
  assert.deepEqual(applyLinks([{ position: 1, label: null }]).length, 1, "an answer from before pass C has no kind and is an application link");
  assert.equal(policyLink(all).kind, "policy"); assert.equal(policyLink([APPLY(1)]), null); assert.equal(isPolicy(POLICY()), true); assert.equal(isPolicy(APPLY(1)), false);
  assert.deepEqual(applicationLinks([{ kind: "apply" }, { kind: "policy" }, { kind: "recruiter" }, { }]).length, 3);
  const detail = { ok: true, data: { links: [{ position: 1, kind: "apply", firm: null, label: "x" }, { position: 1, kind: "policy", firm: null, label: "y" }] } };
  assert.deepEqual(detailLinks(detail).map((l) => l.kind), ["apply"], "the wrong-link report's picker never offers the policy link");
  assert.ok(linkChoices(detailLinks(detail)).every((c) => !/policy/.test(c.value + c.text)));
  assert.deepEqual(parseLinkChoice("policy:1"), { kind: null, position: null }, "a report for a policy link is not formed");
});

test("answer shapes: the detail answer takes ten application links, three firms and one policy link; the policy link is position 1, has a place, is never a firm; a second one or a fifteenth entry breaks the answer", () => {
  const row = { company_name: "C", title: "T", locations: [], is_remote: true, posted_at: "2026-10-01T00:00:00Z", closes_at: "2026-11-01T00:00:00Z", applicant_cap: null, status: "live", closed_reason: null, ai_filtering: false, ai_interview_other: false, ai_disclosure_shown: false,
    third_party_recruiter: false, masked_code: "****-****-ABCD", masked_req: null, posting_ref: "a".repeat(20), last_edited_at: null };
  const d = (links) => ({ posting: row, links, comment_count: 0 });
  const A = (n) => Array.from({ length: n }, (_, i) => ({ position: i + 1, kind: "apply", firm: null, label: "L" }));
  const R = (n) => Array.from({ length: n }, (_, i) => ({ position: i + 1, kind: "recruiter", firm: "F" + i, label: null }));
  const P = { position: 1, kind: "policy", firm: null, label: "Employer's own site" };
  assert.equal(shapes.detail(d([...A(10), ...R(3), P])), true);
  assert.equal(shapes.detail(d([...A(10), ...R(3), P, P])), false, "two policy links");
  assert.equal(shapes.detail(d([...A(10), ...R(3), P, A(1)[0]])), false, "fifteen entries");
  assert.equal(shapes.detail(d([{ ...P, position: 2 }])), false);
  assert.equal(shapes.detail(d([{ ...P, label: null }])), false);
  assert.equal(shapes.detail(d([{ ...P, firm: "Firm" }])), false);
  assert.equal(shapes.detail(d([{ ...P, kind: "other" }])), false);
  assert.equal(shapes.linkIssue({ expires_at: "x", links: [{ position: 1, kind: "policy", label: "x", go_url: "https://f.example/go/abc" }] }), true);
  assert.equal(shapes.linkIssue({ expires_at: "x", links: [{ position: 1, kind: "nonsense", label: "x", go_url: "https://f.example/go/abc" }] }), false);
  const stored = (links) => ({ active_links: links.filter((l) => l.kind === "policy").length, kind: "policy", changed: true, links });
  assert.equal(shapes.policyAnswer(stored([POLICY()])), true);
  assert.equal(shapes.policyAnswer(stored([])), true);
  assert.equal(shapes.policyAnswer({ ...stored([POLICY()]), kind: "apply" }), false);
  assert.equal(shapes.policyAnswer(stored([POLICY({ position: 2 })])), false);
  assert.equal(shapes.policyAnswer({ ...stored([POLICY()]), active_links: 2 }), false);
  assert.equal(shapes.policyAnswer({ ...stored([POLICY()]), address: "https://x.example" }) , true, "extra keys here are ignored: the page reads only what it needs");
  assert.equal(shapes.storedLinks([...A(10), ...R(3), POLICY()]), true);
  assert.equal(shapes.storedLinks([POLICY(), POLICY()]), false);
  assert.equal(shapes.storedLinks(Array.from({ length: 15 }, (_, i) => APPLY((i % 10) + 1))), false);
  // the one-link answer (edit and remove of an application link) still lists application links only
  assert.equal(shapes.linkOpAnswer({ posting_id: "3f1d5b1e-0000-4000-8000-000000000001", kind: "apply", op: "remove", position: 1, changed: true, active_links: 1, links: [{ ...APPLY(2) }] }), true);
  assert.equal(shapes.linkOpAnswer({ posting_id: "3f1d5b1e-0000-4000-8000-000000000001", kind: "apply", op: "remove", position: 1, changed: true, active_links: 1, links: [POLICY()] }), false);
});

test("the request: exactly { posting_id, kind policy, links } with one address, or links [] to remove; the session token goes in the header; nothing else", async () => {
  const seen = [];
  const api = createApi({ baseUrl: "https://x.example", key: "pk", getToken: async () => "tok", fetchImpl: async (url, init) => {
    seen.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
    return new Response(JSON.stringify({ posting_id: "3f1d5b1e-0000-4000-8000-000000000001", kind: "policy", changed: true, active_links: 1, links: [POLICY()] }), { status: 200 });
  } });
  const r = await api.setPolicyLink("3f1d5b1e-0000-4000-8000-000000000001", "https://policy.example/ai");
  assert.equal(r.ok, true);
  assert.equal(seen[0].url, "https://x.example/functions/v1/set-destination-links");
  assert.deepEqual(seen[0].body, { posting_id: "3f1d5b1e-0000-4000-8000-000000000001", kind: "policy", links: [{ url: "https://policy.example/ai" }] });
  assert.equal(seen[0].auth, "Bearer tok");
  await api.setPolicyLink("3f1d5b1e-0000-4000-8000-000000000001", null);
  assert.deepEqual(seen[1].body, { posting_id: "3f1d5b1e-0000-4000-8000-000000000001", kind: "policy", links: [] });
  // the application path asks for one-time links with the posting reference only: no policy flag, no kind
  const api2 = createApi({ baseUrl: "https://x.example", key: "pk", getToken: async () => "tok", fetchImpl: async (url, init) => { seen.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ expires_at: "x", links: [] }), { status: 200 }); } });
  await api2.candidateLinkIssue("a".repeat(20));
  assert.deepEqual(seen.at(-1).body, { posting_ref: "a".repeat(20) });
});

test("the extension's hand-off carries the company and one other value only: nothing about a policy link can ride in it", () => {
  assert.deepEqual(Object.keys(FRAGMENT_KEYS).sort(), ["c", "p", "r", "t"]);
  assert.deepEqual(Object.values(FRAGMENT_KEYS).sort(), ["company", "postid", "req", "title"]);
});

test("the unsaved bar names the policy link section by its own words and says Save changes does not save it", () => {
  const s = summarize({ form: false, panels: [PANEL.POLICY], status: "live", noteMissing: false, noteRequired: false });
  assert.equal(s.headline, "AI and hiring policy link not saved yet");
  assert.match(s.detail, /Save changes does not save it/);
  const both = summarize({ form: true, panels: [PANEL.POLICY, PANEL.LINKS], status: "live", noteMissing: false, noteRequired: false });
  assert.match(both.detail, /AI and hiring policy link and destination links not saved yet/i);
});
