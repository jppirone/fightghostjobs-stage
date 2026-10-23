// lm-cleanup.unit.test.js - the opening tile and the details window (prompt LM, October 23, 2026), the parts that need no browser. Run: node --test tests/lm-cleanup.unit.test.js
// 1. THE TWO PARAGRAPHS ARE MOVED, NOT REWRITTEN: each is compared, byte for byte, with the text it was in the commit before this prompt (the LK commit d0858fe: search.js held the first, search.html the second). The comparison
//    reads that commit with git when it can, and ALWAYS also against a SHA-256 and a length pinned below, so it still holds on a machine without that commit. A planted change of one letter must be caught.
// 2. what the buttons of the tile are for each kind of row (js/tile-actions.js), the comment count text, the form of the pills on the tile (AI pills with and without the employer's words, the AI hiring policy pill),
//    the two new optional values of a search row, and the words of the new modules (no dash, never "verified").
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ABOUT_TITLE, ABOUT_TEXT, LINKS_ABOUT_TITLE, LINKS_ABOUT_BEFORE, LINKS_ABOUT_BOLD, LINKS_ABOUT_AFTER, LINKS_ABOUT_HTML, LINKS_HEADING, ABOUT_ICON_LABEL, LINKS_ICON_LABEL } from "../js/about-text.js";
import { tileActions, commentsText, commentsHref, commentCountOf, VIEW_LINKS, LEGACY_DETAILS, MAX_COMMENT_COUNT } from "../js/tile-actions.js";
import { postingChips } from "../js/chips.js";
import { policyPillChip, hasPolicyPill, POLICY_PILL_TEXT } from "../js/policy-pill.js";
import { shapes } from "../js/api.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
// the two paragraphs as they were, pinned (computed from the LK commit d0858fe: P1 = the string search.js put in #modalIntro, P2 = the inner HTML of #modalLinksNote in search.html)
const P1 = { len: 263, sha: "0258b0df49f69751910a2933452a09e9b29148e2cd770e0e494f75357373ead7" };
const P2 = { len: 513, sha: "06889c31f446776d14031827f86da5944877d922dcfce14b1178f6260b8b22ef" };
const same = (text, pin) => text.length === pin.len && sha(text) === pin.sha;
const gitShow = (spec) => { try { return execFileSync("git", ["show", spec], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 }); } catch { return null; } };

test("the first paragraph is byte for byte what it was (pinned hash, and the text of the commit before when git has it)", () => {
  assert.ok(same(ABOUT_TEXT, P1), "the Registered box text differs from the old paragraph");
  const js = gitShow("d0858fe:js/pages/search.js");
  if (js !== null) {
    const m = /\$\("#modalIntro"\)\.textContent = "([^"]*)";/.exec(js);
    assert.ok(m, "the old line was not found in the commit");
    assert.equal(ABOUT_TEXT, m[1]);
  }
  assert.ok(!same(ABOUT_TEXT.replace("employer's", "employers"), P1), "PLANT: one changed letter is caught by the pin");
  assert.ok(!same(ABOUT_TEXT + " ", P1), "PLANT: one added space is caught by the pin");
});

test("the second paragraph is byte for byte what it was, with its bold phrase (pinned hash, and the markup of the commit before when git has it)", () => {
  assert.ok(same(LINKS_ABOUT_HTML, P2), "the links box text differs from the old paragraph");
  assert.equal(LINKS_ABOUT_BEFORE + LINKS_ABOUT_BOLD + LINKS_ABOUT_AFTER, LINKS_ABOUT_HTML.replace("<strong>", "").replace("</strong>", ""));
  assert.equal(LINKS_ABOUT_BOLD, "Report a wrong link");
  const html = gitShow("d0858fe:search.html");
  if (html !== null) {
    const m = /<p id="modalLinksNote"[^>]*>([\s\S]*?)<\/p>/.exec(html);
    assert.ok(m, "the old paragraph was not found in the commit");
    assert.equal(LINKS_ABOUT_HTML, m[1]);
  }
  assert.ok(!same(LINKS_ABOUT_HTML.replace("on purpose", "by design"), P2), "PLANT: a reworded phrase is caught by the pin");
  assert.ok(!same(LINKS_ABOUT_HTML.replace("<strong>Report", "Report"), P2), "PLANT: a lost bold is caught by the pin");
});

test("the details window and the tile no longer carry the paragraphs themselves, and the new labels are exactly these", () => {
  const html = fs.readFileSync(path.join(ROOT, "search.html"), "utf8"), js = fs.readFileSync(path.join(ROOT, "js/pages/search.js"), "utf8");
  for (const piece of [ABOUT_TEXT, LINKS_ABOUT_BEFORE]) { assert.ok(!html.includes(piece) && !js.includes(piece), "a paragraph is still in search.html or search.js"); }
  assert.ok(!html.includes('id="modalIntro"') && !html.includes('id="modalLinksNote"'));
  assert.equal(ABOUT_TITLE, "About this information");
  assert.equal(LINKS_ABOUT_TITLE, "About these links");
  assert.equal(LINKS_HEADING, "Links");
  assert.equal(ABOUT_ICON_LABEL, "About this information");
  assert.equal(LINKS_ICON_LABEL, "About these links");
});

const row = (extra) => Object.assign({ posting_ref: "a".repeat(20), status: "live", third_party_recruiter: false }, extra);
const counts = (apply, firms, extra) => row(Object.assign({ apply_link_count: apply, recruiter_firm_count: firms, destination_links_exclusive: false }, extra || {}));

test("the buttons: View links with a Comments link when there is anything for the details window; only Comments (n) when there is not; the old button when the row has no counts", () => {
  const a = tileActions(counts(2, 0, { comment_count: 3 }), true);
  assert.deepEqual(a, { mode: "links", main: "View links", comments: { text: "Comments (3)", href: "comments.html?ref=" + "a".repeat(20) } });
  assert.equal(tileActions(counts(0, 2, { comment_count: 0 }), true).mode, "links", "named recruiter firms alone are enough for the details window");
  assert.equal(tileActions(counts(1, 0), true).comments.text, "Comments", "no count in the row: no number, never a guess");
  const none = tileActions(counts(0, 0, { comment_count: 0 }), true);
  assert.deepEqual(none, { mode: "comments", main: null, comments: { text: "Comments (0)", href: "comments.html?ref=" + "a".repeat(20) } });
  assert.deepEqual(tileActions(row({}), true), { mode: "legacy", main: "View opening details", comments: null });
  assert.deepEqual(tileActions(counts(0, 0), false), { mode: "comments", main: null, comments: null }, "the comments switch is off: nothing to show");
  assert.equal(tileActions(counts(3, 0, { comment_count: 5 }), false).comments, null);
  assert.equal(VIEW_LINKS, "View links"); assert.equal(LEGACY_DETAILS, "View opening details");
  // the policy link and the statement change nothing about the buttons; a status does not either
  assert.equal(tileActions(counts(0, 0, { has_policy_link: true, status: "paused" }), true).mode, "comments");
  assert.equal(tileActions(counts(1, 0, { status: "closed" }), true).mode, "links");
});

test("the comment count: a whole number from 0 up, written as in the details window; anything else is no number", () => {
  for (const [v, want] of [[0, "Comments (0)"], [1, "Comments (1)"], [37, "Comments (37)"], [MAX_COMMENT_COUNT, "Comments (" + MAX_COMMENT_COUNT + ")"]]) assert.equal(commentsText({ comment_count: v }), want);
  for (const v of [-1, 1.5, "3", null, undefined, NaN, MAX_COMMENT_COUNT + 1, true, [], {}]) { assert.equal(commentCountOf({ comment_count: v }), null, String(v)); assert.equal(commentsText({ comment_count: v }), "Comments"); }
  assert.equal(commentsHref({ posting_ref: "ab cd" }), "comments.html?ref=ab%20cd", "the reference is encoded, as the details window does");
});

test("the pills on the tile: an AI pill with the employer's words carries them, one without is plain with no tooltip; the policy pill only for a real true", () => {
  const withNote = counts(1, 0, { ai_filtering: true, ai_filtering_note: "We rank resumes by keyword.", ai_interview_other: true, ai_interview_note: "A bot asks the first questions." });
  const t = postingChips(withNote, undefined, { tile: true });
  const f = t.find((x) => x.text === "AI-assisted filtering"), i = t.find((x) => x.text === "AI used for interviewing/other");
  assert.deepEqual(f.note, { title: "AI filtering, in the employer's words", text: "We rank resumes by keyword." });
  assert.deepEqual(i.note, { title: "AI interviewing/other, in the employer's words", text: "A bot asks the first questions." });
  assert.ok(!("tooltip" in f) && !("tooltip" in i), "the old tooltip is gone from the tile");
  const bare = postingChips(counts(1, 0, { ai_filtering: true, ai_interview_other: false }), undefined, { tile: true });
  for (const x of bare.filter((y) => /AI/.test(y.text))) { assert.ok(!("note" in x) && !("tooltip" in x), x.text + " is plain"); }
  // a note under a toggle that is off is never shown (the shared rule of js/ai-notes.js)
  const off = postingChips(counts(1, 0, { ai_filtering: false, ai_filtering_note: "left over", ai_interview_other: null, ai_interview_note: "left over" }), undefined, { tile: true });
  assert.ok(off.every((x) => !("note" in x)), "notes under a toggle that is off are not carried");
  // the old form (the comments page recap) is unchanged: tooltips, no note
  const old = postingChips(withNote);
  assert.ok(old.find((x) => x.text === "AI-assisted filtering").tooltip && !("note" in old.find((x) => x.text === "AI-assisted filtering")));
  // the policy pill
  assert.ok(!postingChips(counts(1, 0), undefined, { tile: true }).some((x) => x.policy), "no flag, no pill");
  for (const v of [false, "true", 1, null, "yes", {}]) assert.equal(hasPolicyPill({ has_policy_link: v }), false, String(v));
  const p = postingChips(counts(1, 0, { has_policy_link: true }), undefined, { tile: true }).filter((x) => x.policy);
  assert.equal(p.length, 1); assert.deepEqual(p[0], { text: "AI hiring policy", leaves: true, policy: true });
  assert.equal(POLICY_PILL_TEXT, "AI hiring policy"); assert.equal(policyPillChip({ has_policy_link: true }).text, "AI hiring policy");
  assert.ok(!postingChips(counts(1, 0, { has_policy_link: true })).some((x) => x.policy), "the comments page form has no policy pill");
});

test("no pill spec or button spec ever carries an address, a token or a firm: counts and flags only", () => {
  const leak = counts(2, 1, { has_policy_link: true, comment_count: 2, url: "https://leak.example.invalid/x", go_url: "https://go.example.invalid/y", token: "tok_SECRET", firm_url: "https://f.example.invalid", label: "SECRET" });
  const all = JSON.stringify([postingChips(leak, undefined, { tile: true }), tileActions(leak, true)]);
  assert.ok(!/leak\.example|go\.example|f\.example|tok_SECRET|SECRET|https?:/i.test(all), all);
});

test("the search row check accepts the two new optional values and refuses a malformed one", () => {
  const base = { company_name: "A", title: "B", locations: [], is_remote: false, posted_at: "2026-10-01T00:00:00Z", closes_at: "2026-11-01T00:00:00Z", applicant_cap: null, status: "live", closed_reason: null, ai_filtering: false, ai_interview_other: false, ai_disclosure_shown: true, third_party_recruiter: false, masked_code: "****-****-ABCD", masked_req: null, posting_ref: "abcdefghjkmnpqrstvwx", last_edited_at: null };
  assert.equal(shapes.searchRow(base), true, "an answer without them is fine");
  assert.equal(shapes.searchRow({ ...base, comment_count: 0, has_policy_link: false }), true);
  assert.equal(shapes.searchRow({ ...base, comment_count: 12, has_policy_link: true }), true);
  for (const bad of [{ comment_count: -1 }, { comment_count: 1.5 }, { comment_count: "3" }, { comment_count: null }, { comment_count: MAX_COMMENT_COUNT + 1 }, { has_policy_link: "true" }, { has_policy_link: 1 }, { has_policy_link: null }]) assert.equal(shapes.searchRow({ ...base, ...bad }), false, JSON.stringify(bad));
});

test("words: the new modules and files hold no dash and no word starting verif", () => {
  const dash = new RegExp(String.fromCharCode(8212) + "|" + String.fromCharCode(8211));
  for (const f of ["js/about-text.js", "js/info-box.js", "js/tile-actions.js", "js/policy-pill.js"]) { const t = fs.readFileSync(path.join(ROOT, f), "utf8"); assert.ok(!dash.test(t), f + " has a dash"); assert.ok(!/verif/i.test(t), f + " says verif"); }
  for (const v of [ABOUT_TITLE, LINKS_ABOUT_TITLE, LINKS_HEADING, VIEW_LINKS, POLICY_PILL_TEXT, "Comments (3)"]) { assert.ok(!dash.test(v) && !/verif/i.test(v), v); }
});
