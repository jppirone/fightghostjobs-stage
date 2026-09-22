// unit.test.js - the pure logic of the site (formatting, disclosure wording, search-input rules, the register form). Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { fmtDate, fmtStamp, fmtDateTz, fmtClose, tzLabel, groupCode, locationLine, initials, plural, waitText } from "../js/format.js";
import { postingChips, aiFilteringChip, aiInterviewChip, statusChips, notOpenMessage, TOOLTIP_FILTERING, TOOLTIP_INTERVIEW } from "../js/chips.js";
import { classifyQuery, checkCompany, normalizeCode, noMatchMessage, NO_MATCH_NOTE } from "../js/search-input.js";
import { checkReq, resolveSearch, noMatchMessage as noMatchMsg, NO_MATCH_NOTE_REQ } from "../js/search-input.js";
import { isDuplicateReq } from "../js/register-form.js";
import { validateForm, buildCreateBody, mapServerErrors, MIN_WINDOW_DAYS, MAX_WINDOW_DAYS, collectLinks, linksOutcome, collectFirms, firmsOutcome } from "../js/register-form.js";

test("dates read like the design (Sep 2), in UTC when asked", () => {
  assert.equal(fmtDate("2026-09-02T12:00:00Z", "UTC"), "Sep 2");
  assert.equal(fmtDate("2026-10-17T23:59:59Z", "UTC"), "Oct 17");
  assert.equal(fmtDate("nope"), ""); assert.equal(fmtDate(null), "");
  assert.equal(fmtStamp("2026-09-18T16:12:00Z", "UTC"), "Sep 18, 2026 · 4:12 PM");
  assert.equal(fmtStamp("2026-09-18T00:05:00Z", "UTC"), "Sep 18, 2026 · 12:05 AM");
});

test("dates name the zone they are read in, and the close date is an exact moment", () => {
  assert.equal(fmtDateTz("2026-09-02T12:00:00Z", "UTC"), "Sep 2 (UTC)");
  assert.equal(fmtClose("2026-11-05T02:08:44Z", "UTC"), "Nov 5, 2:08 AM UTC");
  assert.equal(fmtClose("2026-11-05T14:30:00Z", "UTC"), "Nov 5, 2:30 PM UTC");
  assert.equal(fmtClose("2026-11-05T00:00:00Z", "UTC"), "Nov 5, 12:00 AM UTC");
  assert.equal(fmtClose("2026-11-05T12:00:00Z", "UTC"), "Nov 5, 12:00 PM UTC");
  assert.equal(fmtClose("nope"), ""); assert.equal(fmtDateTz(null), ""); assert.equal(tzLabel(undefined), "");
  // in the viewer's own zone the label is whatever that zone is called (EST, GMT+1, ...): never empty, never a raw offset of a different zone
  for (const iso of ["2026-09-21T02:08:44Z", "2026-11-05T02:08:44Z"]) { const z = tzLabel(iso); assert.ok(z !== "" && z.length <= 12, z); assert.ok(fmtClose(iso).endsWith(" " + z)); assert.ok(fmtDateTz(iso).endsWith(" (" + z + ")")); }
});

test("the employer's code is grouped, never invented", () => {
  assert.equal(groupCode("D21M48YBZQBF"), "D21M-48YB-ZQBF");
  assert.equal(groupCode("short"), "short");
  assert.equal(groupCode(null), "");
});

test("location line: remote, places, neither", () => {
  assert.equal(locationLine(true, []), "Remote");
  assert.equal(locationLine(false, ["Tampa, FL"]), "Tampa, FL");
  assert.equal(locationLine(true, ["Tampa, FL", " Austin "]), "Remote · Tampa, FL · Austin");
  assert.equal(locationLine(false, []), "Location not stated");
  assert.equal(locationLine(null, ["", "  "]), "Location not stated");
});

test("small helpers", () => {
  assert.equal(initials("John Pirone"), "JP"); assert.equal(initials("cher"), "C"); assert.equal(initials(""), "?");
  assert.equal(plural(1, "posting", "postings"), "1 posting"); assert.equal(plural(2, "posting", "postings"), "2 postings");
  assert.equal(waitText(45), "45 seconds"); assert.equal(waitText(1), "1 second"); assert.equal(waitText(600), "10 minutes"); assert.equal(waitText(undefined), "1 second");
});

test("the two AI disclosures are independent, worded exactly as designed, and null is said plainly", () => {
  assert.deepEqual(aiFilteringChip(true), { text: "AI-assisted filtering", tooltip: TOOLTIP_FILTERING });
  assert.deepEqual(aiFilteringChip(false), { text: "No AI filtering", tooltip: TOOLTIP_FILTERING });
  assert.equal(aiFilteringChip(null).text, "AI filtering not disclosed");
  assert.deepEqual(aiInterviewChip(true), { text: "AI used for interviewing/other", tooltip: TOOLTIP_INTERVIEW });
  assert.deepEqual(aiInterviewChip(false), { text: "No AI interview/other", tooltip: TOOLTIP_INTERVIEW });
  assert.equal(aiInterviewChip(undefined).text, "AI interview/other not disclosed");
  assert.match(TOOLTIP_FILTERING, /^Resume screening or keyword\/ATS-style matching used to prioritize applications before a human reviews them\.$/);
  assert.match(TOOLTIP_INTERVIEW, /^Any AI that interacts with a candidate directly — an AI-conducted interview, a chatbot screening call, or similar\.$/);
  assert.doesNotMatch(TOOLTIP_FILTERING + TOOLTIP_INTERVIEW, /reject/i);   // design brief 12: the tooltip describes the mechanism, never an outcome
});

const base = { company_name: "Meridian", title: "Senior Data Analyst", locations: ["Remote"], is_remote: true, posted_at: "2026-09-02T12:00:00Z", closes_at: "2026-10-17T12:00:00Z", applicant_cap: 250,
  status: "live", closed_reason: null, ai_filtering: false, ai_interview_other: false, ai_disclosure_shown: false, third_party_recruiter: false, masked_code: "****-****-QBF1", masked_req: "R****0", posting_ref: "a".repeat(20), last_edited_at: null };

test("a live posting's chips, in the designed order", () => {
  const t = postingChips(base, "UTC").map((c) => c.text);
  assert.deepEqual(t, ["Posted Sep 2 (UTC)", "Closes Oct 17, 12:00 PM UTC", "No AI filtering", "No AI interview/other", "No recruiter", "Capped at 250 applicants"]);
  assert.equal(postingChips(base, "UTC")[1].bold, true);
});

test("cap, recruiter and last-edited variants", () => {
  const p = Object.assign({}, base, { applicant_cap: null, third_party_recruiter: true, ai_filtering: true, last_edited_at: "2026-09-20T09:00:00Z" });
  const t = postingChips(p, "UTC").map((c) => c.text);
  assert.ok(t.includes("No applicant cap set")); assert.ok(t.includes("Third-party recruiter involved")); assert.ok(t.includes("AI-assisted filtering")); assert.ok(t.includes("Edited Sep 20 (UTC)"));
});

test("status wording for every state a candidate can be shown", () => {
  assert.deepEqual(statusChips(base, "UTC"), [{ text: "Closes Oct 17, 12:00 PM UTC", bold: true }]);
  assert.equal(statusChips(Object.assign({}, base, { status: "paused" }), "UTC")[0].text, "Paused");
  assert.equal(statusChips(Object.assign({}, base, { status: "paused" }), "UTC")[1].text, "Close date Oct 17, 12:00 PM UTC (the clock keeps running)");
  assert.equal(statusChips(Object.assign({}, base, { status: "expired", closed_reason: "expired_no_action" }), "UTC")[1].text, "Was set to close Oct 17, 12:00 PM UTC");
  assert.equal(statusChips(Object.assign({}, base, { status: "expired", closed_reason: "expired_no_action" }), "UTC")[0].text, "Expired · No action taken");
  assert.equal(statusChips(Object.assign({}, base, { status: "closed", closed_reason: "filled" }), "UTC")[0].text, "Closed · Filled");
  assert.equal(statusChips(Object.assign({}, base, { status: "closed", closed_reason: "withdrawn" }), "UTC")[0].text, "Closed · Withdrawn");
  assert.match(notOpenMessage("closed", "filled"), /filled/); assert.match(notOpenMessage("closed", "withdrawn"), /withdrew/);
  assert.match(notOpenMessage("expired", "expired_no_action"), /no action/); assert.match(notOpenMessage("paused", null), /paused/);
});

test("search company rule mirrors the backend (2+ letters/digits, 200 max)", () => {
  assert.equal(checkCompany("A").ok, false); assert.equal(checkCompany("  ").ok, false); assert.equal(checkCompany("Ab").ok, true);
  assert.equal(checkCompany("x".repeat(201)).ok, false); assert.equal(checkCompany("Meridian Health Systems").value, "Meridian Health Systems");
});

test("one box, two meanings: a code (with a digit or grouped) versus a title", () => {
  assert.deepEqual(classifyQuery("Data Analyst"), { ok: true, kind: "phrase", value: "Data Analyst" });
  assert.equal(classifyQuery("D21M-48YB-ZQBF").kind, "code");
  assert.equal(classifyQuery("d21m 48yb zqbf").kind, "code");
  assert.equal(classifyQuery("D21M48YBZQBF").kind, "code");
  assert.equal(classifyQuery("XX63-M3Y3-W3JS").kind, "code");          // the shape a recruiter reads out
  assert.equal(classifyQuery("ABCD-EFGH-JKMN").kind, "code");          // grouped, even with no digit
  const w = classifyQuery("Receptionist");                             // twelve letters: a word first, a code only as a fallback
  assert.equal(w.kind, "phrase"); assert.equal(w.alsoTryCode, true);
  assert.equal(classifyQuery("Senior Receptionist").alsoTryCode, undefined);
  assert.equal(classifyQuery("").ok, false); assert.equal(classifyQuery("  ").ok, false);
  assert.equal(classifyQuery("ab").ok, false); assert.equal(classifyQuery("a b").ok, false);
  assert.equal(classifyQuery("x".repeat(81)).ok, false);
  assert.equal(classifyQuery("C++").ok, false);                        // fewer than 3 letters/digits
  assert.equal(classifyQuery("C++ Developer").kind, "phrase");
});

test("the empty-result message echoes exactly what was searched, then says closed or expired postings appear only by postID", () => {
  assert.ok(NO_MATCH_NOTE.endsWith("Closed or expired postings appear only when you search by postID."));
  const m = noMatchMessage("Fight Ghost Jobs", "Senior Product Manager", "phrase");
  assert.ok(m.startsWith("No postings found for \"Fight Ghost Jobs\" + \"Senior Product Manager\". "), m);
  assert.ok(m.endsWith(NO_MATCH_NOTE));
  assert.ok(noMatchMessage("Acme", "D21M-48YB-ZQBF", "code").startsWith("No postings found for \"Acme\" + code \"D21M-48YB-ZQBF\". "));
  assert.ok(noMatchMessage("  Acme   Inc ", " a   b c ", "phrase").startsWith("No postings found for \"Acme Inc\" + \"a b c\". "));      // whitespace tidied
  assert.ok(noMatchMessage("x".repeat(500), "y".repeat(500), "phrase").length < 500);                                                         // never echoes an unbounded string
  assert.match(noMatchMessage("<b>x</b>", "<img src=x>", "phrase"), /<b>x<\/b>/);                                                              // plain text: the page inserts it as text, never as HTML
});

test("code normalisation matches the database (I,L -> 1; O -> 0; spaces and hyphens ignored)", () => {
  assert.equal(normalizeCode("xx63-m3y3 w3js"), "XX63M3Y3W3JS");
  assert.equal(normalizeCode("Il0o"), "1100");
});

const good = { title: "Senior Data Analyst", req: "4471", company: "Acme Corp", locEntries: [{ id: "gn:4174757", kind: "place", display: "Tampa, FL" }], remote: false, appcap: "250", closeout: "Closes when the role is filled", desc: "About the job...", aiFilter: false, aiInterview: true, recruiter: false };

test("register form: a complete form has no problems and builds exactly the body the backend wants", () => {
  assert.deepEqual(validateForm(good), {});
  const b = buildCreateBody(good);
  assert.deepEqual(b, { req_number: "4471", title: "Senior Data Analyst", company_name: "Acme Corp", tier: "standard", initial_closeout_condition: "Closes when the role is filled", description_text: "About the job...",
    is_remote: false, location_ids: ["gn:4174757"], ai_filtering: false, ai_interview_other: true, third_party_recruiter: false, applicant_cap: 250 });
  assert.equal("poster_id" in b || "organization_id" in b || "status" in b, false);      // identity and status are never the page's to send
});

test("both AI disclosures are ALWAYS sent as real booleans, off included (never omitted, never null)", () => {
  for (const [a, i] of [[false, false], [true, false], [false, true], [true, true]]) {
    const b = buildCreateBody(Object.assign({}, good, { aiFilter: a, aiInterview: i }));
    assert.strictEqual(b.ai_filtering, a); assert.strictEqual(b.ai_interview_other, i);
  }
  const b = buildCreateBody(Object.assign({}, good, { aiFilter: undefined, aiInterview: undefined }));
  assert.strictEqual(b.ai_filtering, false); assert.strictEqual(b.ai_interview_other, false);
});

test("register form: what is missing is named; the cap, remote and location rules", () => {
  const e = validateForm({ title: " ", req: "", company: "", locEntries: [], remote: false, appcap: "", closeout: "", desc: "" });
  assert.deepEqual(Object.keys(e).sort(), ["closeout", "company", "desc", "jtitle", "locpicker", "req"]);
  assert.equal(validateForm(Object.assign({}, good, { locEntries: [], remote: true })).locpicker, undefined);
  assert.equal(buildCreateBody(Object.assign({}, good, { locEntries: [], remote: true })).is_remote, true);
  assert.equal("location_ids" in buildCreateBody(Object.assign({}, good, { locEntries: [], remote: true })), false);
  assert.equal("locations" in buildCreateBody(good), false);        // free text is never sent
  for (const bad of ["0", "-3", "12.5", "abc", "99999999999"]) assert.ok(validateForm(Object.assign({}, good, { appcap: bad })).appcap, bad);
  assert.equal(validateForm(Object.assign({}, good, { appcap: "" })).appcap, undefined);
  assert.equal("applicant_cap" in buildCreateBody(Object.assign({}, good, { appcap: "" })), false);
  assert.equal(buildCreateBody(Object.assign({}, good, { appcap: " 1 " })).applicant_cap, 1);
});

test("the req number is required: blank is refused under its own input; a value is trimmed and always sent", () => {
  for (const blank of ["", "   ", undefined, null]) assert.ok(validateForm(Object.assign({}, good, { req: blank })).req, JSON.stringify(blank));
  assert.equal(validateForm(good).req, undefined);
  assert.equal(buildCreateBody(Object.assign({}, good, { req: "  4471-A " })).req_number, "4471-A");
  assert.equal(buildCreateBody(good).req_number, "4471");
});

test("the window: 14 to 45 days, empty means the default, anything else is named under its input", () => {
  for (const ok of ["14", "15", "30", "44", "45", " 21 ", ""]) assert.equal(validateForm(Object.assign({}, good, { win: ok })).livedays, undefined, JSON.stringify(ok));
  for (const bad of ["13", "0", "-1", "46", "60", "100", "1e1", "14.5", "abc", "1 4", "9999"]) assert.ok(validateForm(Object.assign({}, good, { win: bad })).livedays, bad);
  assert.equal(buildCreateBody(Object.assign({}, good, { win: "21" })).window_days, 21);
  assert.strictEqual(buildCreateBody(Object.assign({}, good, { win: " 45 " })).window_days, 45);
  assert.equal("window_days" in buildCreateBody(Object.assign({}, good, { win: "" })), false);        // left alone -> the backend's default (45)
  assert.equal("window_days" in buildCreateBody(good), false);
  assert.deepEqual(mapServerErrors({ errors: [{ field: "window_days", message: "window_days must be between 14 and 45 when tier is 'standard' (received 13)" }] }).byField, { livedays: "window_days must be between 14 and 45 when tier is 'standard' (received 13)" });
  assert.equal(MIN_WINDOW_DAYS, 14); assert.equal(MAX_WINDOW_DAYS, 45);
});

test("a server refusal lands under the right input", () => {
  const m = mapServerErrors({ code: "request_refused", message: "x", field: "req_number", errors: [{ field: "req_number", message: "req_number is required" }, { field: "title", message: "title too long" }, { field: "tier", message: "tier bad" }] });
  assert.deepEqual(m.byField, { req: "req_number is required", jtitle: "title too long" }); assert.equal(m.general, "tier bad");
  assert.deepEqual(mapServerErrors({ message: "Something", errors: [] }), { byField: {}, general: "Something" });
  assert.deepEqual(mapServerErrors(null), { byField: {}, general: null });
});

// ---- the req number box on the search page
test("checkReq: at least one letter or digit, at most 100 characters, no control characters; the value is trimmed", () => {
  assert.deepEqual(checkReq("  R-2026/0451 "), { ok: true, value: "R-2026/0451" });
  assert.equal(checkReq("7").ok, true);
  for (const bad of ["", "   ", "---", "!!", null, undefined]) assert.equal(checkReq(bad).ok, false, String(bad));
  assert.equal(checkReq("x".repeat(100)).ok, true);
  assert.equal(checkReq("x".repeat(101)).ok, false);
  assert.equal(checkReq("R" + String.fromCharCode(10) + "100").ok, false);
});

test("resolveSearch: exactly one of the two boxes; each keeps its own rules; the focus goes to the box that needs fixing", () => {
  assert.equal(resolveSearch("Data Analyst", "").kind, "phrase");
  assert.equal(resolveSearch("XXXX-XXXX-XXXX".replace(/X/g, "7"), "").kind, "code");
  assert.deepEqual(resolveSearch("", " FGJ-1234 "), { ok: true, kind: "req", value: "FGJ-1234" });
  assert.deepEqual(resolveSearch("", "").focus, "title");
  assert.equal(resolveSearch("", "").ok, false);
  const both = resolveSearch("Analyst", "R-1"); assert.equal(both.ok, false); assert.equal(both.focus, "req");
  assert.equal(resolveSearch("", "---").focus, "req");
  assert.equal(resolveSearch("ab", "").focus, "title");                                  // a too-short title is still the title box's problem
});

test("a req lookup that finds nothing never echoes the req (it was typed into a masked box) and tells the person what to check", () => {
  const m = noMatchMsg("Acme Inc", "SECRET-REQ-991", "req");
  assert.ok(!m.includes("SECRET-REQ-991"));
  assert.ok(m.includes("Acme Inc") && m.endsWith(NO_MATCH_NOTE_REQ));
  assert.match(noMatchMsg("Acme", "Analyst", "phrase"), /"Analyst"/);                    // the other modes still echo what was searched
});

test("reused req number: once the person is asked, a one-line explanation is required and sent; before that, nothing extra is sent", () => {
  assert.equal("duplicate_explanation" in buildCreateBody(good), false);
  assert.equal(validateForm(good).dupnote, undefined);
  const asked = Object.assign({}, good, { dupAsked: true });
  for (const blank of ["", "   ", undefined, null]) assert.ok(validateForm(Object.assign({}, asked, { dupNote: blank })).dupnote, JSON.stringify(blank));
  assert.ok(validateForm(Object.assign({}, asked, { dupNote: "x".repeat(301) })).dupnote);
  assert.ok(validateForm(Object.assign({}, asked, { dupNote: "line one" + String.fromCharCode(10) + "line two" })).dupnote);
  assert.equal(validateForm(Object.assign({}, asked, { dupNote: "x".repeat(300) })).dupnote, undefined);
  assert.equal(buildCreateBody(Object.assign({}, asked, { dupNote: "  Role reopened after the offer fell through  " })).duplicate_explanation, "Role reopened after the offer fell through");
  assert.equal(isDuplicateReq({ code: "duplicate_req", field: "duplicate_explanation" }), true);
  for (const other of [{ code: "invalid_request" }, { code: "rate_limited" }, null, undefined]) assert.equal(isDuplicateReq(other), false);
  assert.equal(mapServerErrors({ field: "duplicate_explanation", message: "too long" }).byField.dupnote, "too long");
});

test("register form: the destination-link rows are optional; once used, the edit page's rules apply and blank rows are ignored", () => {
  const none = collectLinks([{ url: "", label: "" }, { url: "  ", label: "" }]);
  assert.deepEqual(none, { used: false, ok: true, links: [], rowOf: [], errors: {} });
  assert.equal(collectLinks([]).used, false); assert.equal(collectLinks(undefined).used, false);
  const one = collectLinks([{ url: "https://acme.example/apply", label: "Careers site" }, { url: "", label: "" }]);
  assert.equal(one.used, true); assert.equal(one.ok, true); assert.deepEqual(one.links, [{ url: "https://acme.example/apply", label: "Careers site" }]); assert.deepEqual(one.rowOf, [0]);
  const bad = collectLinks([{ url: "http://acme.example/apply", label: "" }]);
  assert.equal(bad.used, true); assert.equal(bad.ok, false); assert.match(bad.errors[0].url, /https:\/\//);
  const labelOnly = collectLinks([{ url: "", label: "Careers" }]);                       // a label without an address is a mistake, not "no links"
  assert.equal(labelOnly.used, true); assert.equal(labelOnly.ok, false); assert.match(labelOnly.errors[0].url, /Enter the address/);
  const eleven = collectLinks(Array.from({ length: 11 }, (_, i) => ({ url: "https://acme.example/" + i, label: "" })));
  assert.equal(eleven.ok, false); assert.match(eleven.form, /Up to 10/);
});

test("register form: what the result says about the links", () => {
  assert.equal(linksOutcome(null, null), null); assert.equal(linksOutcome(undefined, null), null);
  assert.deepEqual(linksOutcome(1, null), { kind: "ok", text: "1 destination link is stored with it." });
  assert.equal(linksOutcome(3, null).text, "3 destination links are stored with it.");
  const rowProblem = linksOutcome(null, { rows: { 0: { url: "url host is not allowed" } }, general: null, planRequired: false });
  assert.equal(rowProblem.kind, "error"); assert.match(rowProblem.text, /see the messages under the addresses/); assert.match(rowProblem.text, /My postings \(Edit\)/);
  const plan = linksOutcome(null, { rows: {}, general: "Destination links are part of the verified plan.", planRequired: true });
  assert.match(plan.text, /^Destination links are part of the verified plan\. The posting itself is saved\. You can add links/);
});

test("register form: a liveness warning turns the links line into a notice", () => {
  assert.deepEqual(linksOutcome(2, null, "When we checked, link 2 answered HTTP 404. It is saved anyway — make sure it is right."), { kind: "notice", text: "2 destination links are stored with it. When we checked, link 2 answered HTTP 404. It is saved anyway — make sure it is right." });
  assert.equal(linksOutcome(1, null, null).kind, "ok");
});

test("register form: recruiter-firm rows count only while the toggle is on; the result wording", () => {
  assert.equal(collectFirms([{ name: "Acme", url: "" }], false).used, false);
  const on = collectFirms([{ name: "Acme", url: "" }, { name: "", url: "" }], true);
  assert.equal(on.used, true); assert.equal(on.ok, true); assert.deepEqual(on.links, [{ name: "Acme" }]);
  assert.equal(collectFirms([{ name: "", url: "https://a.example.com" }], true).ok, false);
  assert.equal(firmsOutcome(null, null), null); assert.equal(firmsOutcome(1, null).text, "1 recruiter firm is named on it."); assert.equal(firmsOutcome(2, null).text, "2 recruiter firms are named on it.");
  assert.match(firmsOutcome(null, { rows: {}, general: "Recruiter firms can be named only while the posting says a third-party recruiter is involved.", recruiterOff: true }).text, /^Recruiter firms can be named only.*The posting itself is saved\. You can name them/);
});
