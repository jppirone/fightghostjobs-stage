// register-bj.unit.test.js - prompt BJ (October 11, 2026): the register page's policy link and address checks, the unsaved summary of a form that does not exist yet, the plain words of an opening's history,
// the typed place's count, and the one place line. Pure functions only: no browser, no network.
import test from "node:test";
import assert from "node:assert/strict";
import { collectPolicy, policyOutcome, linkProblems, checkReport, collectLinks, collectFirms } from "../js/register-form.js";
import { plainChangeNote } from "../js/edit-form.js";
import { registerSnapshot, summarizeRegister, REGISTER_UNSAVED } from "../js/dirty-state.js";
import { PLACE_WORDS, MAX_PLACE_TEXT } from "../js/place-text.js";
import { placeNodes, placeParts, PLACE_NOTE } from "../js/place.js";

// ---- the policy address, judged as typed (the edit page's rule)
test("a blank policy box means no link; a typed address is judged by the edit page's rule", () => {
  assert.deepEqual(collectPolicy(""), { used: false, ok: true });
  assert.deepEqual(collectPolicy("   "), { used: false, ok: true });
  const bad = collectPolicy("https//example.com/policy");
  assert.equal(bad.used, true); assert.equal(bad.ok, false); assert.equal(bad.error, "The address must start with https://");
  assert.equal(collectPolicy("http://example.com/policy").ok, false);
  assert.equal(collectPolicy("https://").ok, false);
  const good = collectPolicy("  https://example.com/ai-policy ");
  assert.deepEqual(good, { used: true, ok: true, url: "https://example.com/ai-policy" });
});

// ---- every problem of every section, in ONE list
test("every link section is judged together: one plain list names each section that needs fixing", () => {
  const links = collectLinks([{ url: "https://ok.example/apply", label: "" }, { url: "https//bad.example/apply", label: "" }]);
  const firms = collectFirms([{ name: "", url: "https//firm.example" }], true);
  const policy = collectPolicy("www.example.com/policy");
  const r = linkProblems({ links, firms, policy, firmsIgnored: false });
  assert.equal(r.ok, false);
  assert.equal(r.items.length >= 3, true, JSON.stringify(r.items));
  assert.match(r.text, /^Nothing was saved\. Please fix: /);
  assert.match(r.text, /destination link 2/);
  assert.match(r.text, /recruiter firm 1/);
  assert.match(r.text, /the AI and hiring policy link/);
  assert.equal(/destination link 1/.test(r.text), false, "the row that is fine is not named");
});

test("a firm typed while the recruiter switch is off is one plain reminder, naming the section", () => {
  const ok = { used: false, ok: true, links: [], rowOf: [], errors: {} };
  const r = linkProblems({ links: ok, firms: ok, policy: { used: false, ok: true }, firmsIgnored: true });
  assert.equal(r.ok, false);
  assert.equal(r.items.length, 1);
  assert.match(r.text, /recruiter firms/);
  assert.match(r.text, /Third-party recruiter involved/);
});

test("nothing wrong: ok, no text", () => {
  const ok = { used: false, ok: true, links: [], rowOf: [], errors: {} };
  assert.deepEqual(linkProblems({ links: ok, firms: ok, policy: { used: false, ok: true }, firmsIgnored: false }), { ok: true, items: [], text: "" });
});

// ---- what is told after the opening exists
test("the policy outcome: nothing sent says nothing; a saved link, a failed check and a refusal each say what happened", () => {
  assert.equal(policyOutcome(null, null), null);
  const saved = policyOutcome({ changed: true, links: [{ position: 1, kind: "policy", firm: null, label: null, shown_as: "Employer's own site", check_status: "ok", check_http: 200 }] }, null);
  assert.equal(saved.kind, "ok"); assert.match(saved.text, /^Saved\./);
  const failed = policyOutcome({ changed: true, links: [{ position: 1, kind: "policy", firm: null, label: null, check_status: "failed", check_http: 404 }] }, null);
  assert.equal(failed.kind, "notice"); assert.match(failed.text, /did not answer \(HTTP 404\)/);
  const refused = policyOutcome(null, { general: "Nothing was changed." });
  assert.equal(refused.kind, "error"); assert.match(refused.text, /The opening itself is saved/);
});

test("the check report: one sentence for every address that did not answer, nothing when all answered", () => {
  const okAll = { links: [{ position: 1, kind: "apply", check_status: "ok", check_http: 200 }], firms: [{ position: 1, kind: "recruiter", firm: "Northwind", check_status: "ok" }], policy: [{ position: 1, kind: "policy", check_status: "ok" }] };
  assert.equal(checkReport(okAll), null);
  assert.equal(checkReport({ links: null, firms: null, policy: null }), null);
  const r = checkReport({ links: [{ position: 1, kind: "apply", check_status: "ok", check_http: 200 }, { position: 2, kind: "apply", check_status: "failed", check_http: 404 }],
    firms: [{ position: 1, kind: "recruiter", firm: "Northwind", check_status: "failed", check_http: null }], policy: [{ position: 1, kind: "policy", check_status: "failed", check_http: 500 }] });
  assert.equal(r.kind, "notice");
  assert.match(r.text, /destination link 2 answered HTTP 404/);
  assert.match(r.text, /recruiter firm Northwind could not be reached/);
  assert.match(r.text, /the AI and hiring policy link answered HTTP 500/);
  assert.match(r.text, /saved anyway/);
  assert.equal((r.text.match(/When we checked/g) || []).length, 1, "one sentence, not one per address");
});

// ---- the history of an opening in plain words
test("a draft's automatic history line never shows a function or a column name", () => {
  assert.equal(plainChangeNote("edit-posting: changed source_location_text"), "Place changed");
  assert.equal(plainChangeNote("edit-posting: changed title, source_location_text"), "Changed: job title and place.");
  assert.equal(plainChangeNote("edit-posting: changed title, description_text, source_location_text"), "Changed: job title, job description and place.");
  assert.equal(plainChangeNote("edit-posting: changed location_ids, is_remote"), "Place changed", "two names for one thing are said once");
  assert.equal(plainChangeNote("edit-posting: changed some_future_column"), "Other details changed");
  assert.equal(plainChangeNote("Fixed a typo in the third paragraph"), "Fixed a typo in the third paragraph");
  assert.equal(plainChangeNote(null), "");
  for (const note of ["edit-posting: changed req_number", "edit-posting: changed ai_filtering, ai_interview_other", "edit-posting: changed applicant_cap, destination_links_exclusive"]) {
    const w = plainChangeNote(note);
    assert.equal(/_|edit-posting/.test(w), false, w);
  }
});

// ---- the unsaved form
const V = { title: "", req: "", desc: "", locEntries: [], outside: false, locText: "", remote: false, attested: false, appcap: "", win: "45", closeout: "", goLater: false, goLive: "", aiFilter: false, aiInterview: false, aiFilterNote: "", aiInterviewNote: "", recruiter: false };
const ROWS = { links: [{ url: "", label: "" }], firms: [{ name: "", url: "" }], policy: "" };
test("the blank form is the baseline; any typed thing in any section changes it, spaces alone do not", () => {
  const base = registerSnapshot(V, ROWS);
  assert.equal(registerSnapshot({ ...V, title: "   " }, ROWS), base);
  assert.notEqual(registerSnapshot({ ...V, title: "Analyst" }, ROWS), base);
  assert.notEqual(registerSnapshot(V, { ...ROWS, links: [{ url: "https://a.example", label: "" }] }), base);
  assert.notEqual(registerSnapshot(V, { ...ROWS, firms: [{ name: "Northwind", url: "" }] }), base);
  assert.notEqual(registerSnapshot(V, { ...ROWS, policy: "https://example.com/p" }), base);
  assert.notEqual(registerSnapshot({ ...V, outside: true, locText: "Lisbon, Portugal" }, ROWS), base);
});

test("the unsaved summary names what is typed in the link sections and offers Save draft", () => {
  assert.equal(summarizeRegister({ dirty: false, sections: [] }).any, false);
  const s = summarizeRegister({ dirty: true, sections: ["destination links", "recruiter firms"] });
  assert.equal(s.any, true);
  assert.equal(s.headline, REGISTER_UNSAVED.HEAD);
  assert.match(s.detail, /Nothing is kept until you press Add opening or Save draft/);
  assert.match(s.detail, /destination links and recruiter firms/);
  assert.equal(s.showSave, true);
  assert.equal(s.leaveCanSave, true);
  assert.equal(/—/.test(JSON.stringify(s)), false, "no em dash in any words");
});

// ---- the place box
test("the typed place box says its limit and counts", () => {
  assert.equal(MAX_PLACE_TEXT, 100);
  assert.match(PLACE_WORDS.HINT, /^Up to 100 characters\./);
  assert.equal(PLACE_WORDS.COUNT(0), "0 of 100");
  assert.equal(PLACE_WORDS.COUNT(37), "37 of 100");
  assert.match(PLACE_WORDS.FULL, /100 characters/);
  assert.match(PLACE_WORDS.CUT, /cut at 100/);
});

// ---- one place line
const h = (tag, attrs, ...kids) => ({ tag, attrs, kids });
test("one place line: the same words from the same rule, the note only for a typed place", () => {
  assert.equal(PLACE_NOTE, "as provided by the employer");
  const typed = placeNodes(h, { locations: [], is_remote: false, source_location_text: "Berlin, Germany" });
  assert.equal(typed[0], "Berlin, Germany");
  assert.equal(typed[2].kids[0], "as provided by the employer");
  const list = placeNodes(h, { locations: ["Boston, MA"], is_remote: true, source_location_text: "Berlin, Germany" });
  assert.deepEqual(list, ["Remote · Boston, MA"]);
  const remoteTyped = placeNodes(h, { locations: [], is_remote: true, source_location_text: "Berlin, Germany" });
  assert.equal(remoteTyped[0], "Remote · Berlin, Germany");
  assert.equal(remoteTyped[2].kids[0], PLACE_NOTE);
  assert.deepEqual(placeNodes(h, { locations: [], is_remote: false, source_location_text: null }), [placeParts({ locations: [], is_remote: false }).text]);
});
