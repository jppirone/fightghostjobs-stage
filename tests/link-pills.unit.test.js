// link-pills.unit.test.js - the link count pills of the opening tile (prompt LK, October 23, 2026): js/link-pills.js, their place in js/chips.js and the two new keys js/api.js reads. No browser, no network.
// The words are John's: the tile says how many links the employer gave and whether the employer calls them official. COUNTS ONLY: never an address, a firm address or a token.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applicationLinksChip, recruiterChip, linkCounts, countsFromDetail, TOOLTIP_OFFICIAL, TOOLTIP_EMPLOYER, MAX_APPLY_LINKS, MAX_RECRUITER_FIRMS } from "../js/link-pills.js";
import { postingChips } from "../js/chips.js";
import { shapes } from "../js/api.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const row = (apply, firms, exclusive, recruiter = false, extra = {}) => Object.assign({ company_name: "Meridian", title: "Analyst", locations: ["Remote"], is_remote: true, posted_at: "2026-09-02T12:00:00Z", closes_at: "2026-10-17T12:00:00Z", applicant_cap: null,
  status: "live", closed_reason: null, ai_filtering: false, ai_interview_other: false, ai_disclosure_shown: false, third_party_recruiter: recruiter, masked_code: "****-****-QBF1", masked_req: "R****0", posting_ref: "a".repeat(20), last_edited_at: null,
  apply_link_count: apply, recruiter_firm_count: firms, destination_links_exclusive: exclusive }, extra);

test("the tooltips are exactly John's words, the maxima are the ones the details answer is checked against", () => {
  assert.equal(TOOLTIP_OFFICIAL, "The employer says these are the only places to apply for this opening. FightGhostJobs does not check that.");
  assert.equal(TOOLTIP_EMPLOYER, "Links the employer provided to apply for this opening. The employer has not said these are the only places to apply.");
  assert.equal(MAX_APPLY_LINKS, 10); assert.equal(MAX_RECRUITER_FIRMS, 3);
});

test("the application links pill: 0, 1, 2, 3 and the maximum; official or employer links; singular and plural", () => {
  assert.deepEqual(applicationLinksChip(row(0, 0, false)), { text: "No employer links" });
  assert.deepEqual(applicationLinksChip(row(0, 0, true)), { text: "No employer links" }, "the statement without a link says nothing about links");
  assert.deepEqual(applicationLinksChip(row(1, 0, true)), { text: "1 official link", tooltip: TOOLTIP_OFFICIAL });
  assert.deepEqual(applicationLinksChip(row(1, 0, false)), { text: "1 employer link", tooltip: TOOLTIP_EMPLOYER });
  for (const n of [2, 3, 7, 10]) {
    assert.deepEqual(applicationLinksChip(row(n, 0, true)), { text: n + " official links", tooltip: TOOLTIP_OFFICIAL }, "official " + n);
    assert.deepEqual(applicationLinksChip(row(n, 0, false)), { text: n + " employer links", tooltip: TOOLTIP_EMPLOYER }, "employer " + n);
  }
  assert.equal(applicationLinksChip(row(0, 0, false)).tooltip, undefined, "no icon when there are no links");
});

test("the recruiter pill: switch off, on with 1, 2, 3 firms, on with none named", () => {
  assert.deepEqual(recruiterChip(row(0, 0, false, false)), { text: "No recruiter" });
  assert.deepEqual(recruiterChip(row(0, 2, false, false)), { text: "No recruiter" }, "firms kept while the switch is off are not shown (the details page does not list them)");
  assert.deepEqual(recruiterChip(row(0, 1, false, true)), { text: "1 recruiter link" });
  assert.deepEqual(recruiterChip(row(0, 2, false, true)), { text: "2 recruiter links" });
  assert.deepEqual(recruiterChip(row(0, 3, false, true)), { text: "3 recruiter links" });
  assert.deepEqual(recruiterChip(row(0, 0, false, true)), { text: "Recruiter involved" });
  for (const n of [0, 1, 2, 3]) assert.equal(recruiterChip(row(0, n, false, true)).tooltip, undefined, "the recruiter pill has no icon today and gets none");
});

test("a row without counts (an answer from before the database change): no application pill, the recruiter pill says only what the switch says", () => {
  const { apply_link_count, recruiter_firm_count, destination_links_exclusive, ...old } = row(2, 1, true, true);
  assert.equal(applicationLinksChip(old), null);
  assert.deepEqual(recruiterChip(old), { text: "Recruiter involved" });
  assert.deepEqual(recruiterChip(Object.assign({}, old, { third_party_recruiter: false })), { text: "No recruiter" });
  const t = postingChips(old, "UTC").map((c) => c.text);
  assert.ok(!t.some((x) => /link/.test(x)), "no word about links is invented: " + t.join(" | "));
});

test("malformed counts are not believed: no application pill", () => {
  for (const bad of [[-1, 0, false], [11, 0, false], [1.5, 0, false], ["2", 0, false], [null, 0, false], [NaN, 0, false], [2, -1, false], [2, 4, false], [2, "1", false], [2, 1, "yes"], [2, 1, 1], [2, 1, null], [2, 1, undefined]]) {
    assert.equal(linkCounts(row(...bad)), null, JSON.stringify(bad));
    assert.equal(applicationLinksChip(row(...bad)), null, JSON.stringify(bad));
  }
  assert.equal(linkCounts(null), null); assert.equal(linkCounts("x"), null); assert.equal(applicationLinksChip(undefined), null);
  assert.deepEqual(linkCounts(row(10, 3, true)), { apply: 10, firms: 3, exclusive: true });
});

test("the place of the pills in the row: the recruiter pill, the application links pill right after it, then the cap, then Edited", () => {
  const t = postingChips(row(3, 2, true, true, { last_edited_at: "2026-09-20T09:00:00Z" }), "UTC").map((c) => c.text);
  assert.deepEqual(t, ["Added Sep 2 (UTC)", "Closes Oct 17, 12:00 PM UTC", "No AI filtering", "No AI interview/other", "2 recruiter links", "3 official links", "No applicant cap set", "Edited Sep 20 (UTC)"]);
  const none = postingChips(row(0, 0, false, false), "UTC").map((c) => c.text);
  assert.deepEqual(none.slice(4, 7), ["No recruiter", "No employer links", "No applicant cap set"]);
  assert.equal(postingChips(row(3, 0, true), "UTC")[5].tooltip, TOOLTIP_OFFICIAL);
  assert.equal(postingChips(row(3, 0, false), "UTC")[5].tooltip, TOOLTIP_EMPLOYER);
});

test("the rule does not depend on the status of the opening", () => {
  for (const status of ["live", "paused", "expired", "closed"]) {
    const t = postingChips(row(2, 1, true, true, { status, closed_reason: status === "closed" ? "filled" : status === "expired" ? "expired_no_action" : null }), "UTC").map((c) => c.text);
    assert.ok(t.includes("1 recruiter link") && t.includes("2 official links"), status + ": " + t.join(" | "));
  }
});

test("a lapsed plan, as the database counts it (no links listed, the statement not shown): the pills agree with an empty details list", () => {
  const lapsed = row(0, 0, false, true);   // the database sends 0, 0, false while the plan is lapsed, because the details answer lists nothing then
  assert.deepEqual([recruiterChip(lapsed).text, applicationLinksChip(lapsed).text], ["Recruiter involved", "No employer links"]);
});

test("the counts of a details answer: apply links and firms as listed, the policy link never counted, the statement from the posting", () => {
  const links = [{ position: 1, kind: "apply", label: "Careers site" }, { position: 2, label: "Old answer without a kind" }, { position: 1, kind: "recruiter", firm: "Firm A", label: null }, { position: 1, kind: "policy", firm: null, label: "Employer's own site" }];
  assert.deepEqual(countsFromDetail({ posting: { destination_links_exclusive: true }, links }), { apply_link_count: 2, recruiter_firm_count: 1, destination_links_exclusive: true });
  assert.deepEqual(countsFromDetail({ posting: {}, links: [] }), { apply_link_count: 0, recruiter_firm_count: 0, destination_links_exclusive: false });
  assert.deepEqual(countsFromDetail({ posting: { destination_links_exclusive: "true" }, links: [{ kind: "apply" }] }).destination_links_exclusive, false, "only a real true counts");
  assert.deepEqual(countsFromDetail(null), {}); assert.deepEqual(countsFromDetail({ posting: {} }), {});
});

test("COUNTS ONLY: whatever else a row carries (an address, a firm address, a token) never reaches a pill", () => {
  const leaky = row(2, 1, true, true, { url: "https://leak.example.invalid/apply?t=SECRET", go_url: "https://go.example.invalid/f/SECRET", firm_url: "https://firm.example.invalid/SECRET", token: "tok_SECRET", links: [{ label: "https://leak.example.invalid/SECRET" }], label: "SECRET", firm: "SECRET Firm" });
  const text = JSON.stringify(postingChips(leaky, "UTC"));
  assert.doesNotMatch(text, /SECRET|leak\.example|go\.example|firm\.example|https?:/i);
  const src = fs.readFileSync(path.join(ROOT, "js", "link-pills.js"), "utf8").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /\.(url|go_url|href|token|label|firm|firm_url)\b/, "the module reads no address-like key");
  assert.deepEqual([...new Set(Array.from(src.matchAll(/row\.([a-z_]+)/g), (m) => m[1]))].sort(), ["apply_link_count", "destination_links_exclusive", "recruiter_firm_count", "third_party_recruiter"]);
});

test("the search answer check: the counts are accepted when well formed and the whole row is refused when they are not", () => {
  assert.equal(shapes.searchRow(row(0, 0, false)), true); assert.equal(shapes.searchRow(row(10, 3, true)), true);
  const { apply_link_count, recruiter_firm_count, destination_links_exclusive, ...old } = row(1, 1, true);
  assert.equal(shapes.searchRow(old), true, "an answer from before the database change");
  assert.equal(shapes.searchRow(Object.assign({}, old, { destination_links_exclusive: false })), true, "the details answer's posting carries only the statement");
  for (const bad of [{ apply_link_count: 11 }, { apply_link_count: -1 }, { apply_link_count: "2" }, { apply_link_count: 1.5 }, { recruiter_firm_count: 4 }, { recruiter_firm_count: null }, { destination_links_exclusive: "yes" }, { destination_links_exclusive: 1 }]) {
    assert.equal(shapes.searchRow(Object.assign({}, row(1, 1, true), bad)), false, JSON.stringify(bad));
  }
  assert.equal(shapes.searchRow(Object.assign({}, old, { apply_link_count: 2 })), false, "one of the two counts alone is a broken answer");
});

test("the words: nothing new says \"verified\", the texts hold no dash, the tile claims no check", () => {
  const src = fs.readFileSync(path.join(ROOT, "js", "link-pills.js"), "utf8");
  const code = src.replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(code, /verif/i);
  assert.doesNotMatch(src, new RegExp(String.fromCharCode(8212) + "|" + String.fromCharCode(8211)));
  const texts = [];
  for (const [a, f, e, r] of [[0, 0, false, false], [1, 1, true, true], [2, 2, false, true], [3, 0, true, true], [10, 3, false, true]]) for (const c of [applicationLinksChip(row(a, f, e, r)), recruiterChip(row(a, f, e, r))]) texts.push(c.text, c.tooltip || "");
  texts.push(TOOLTIP_OFFICIAL, TOOLTIP_EMPLOYER);
  assert.doesNotMatch(texts.join("\n"), new RegExp("verif|" + String.fromCharCode(8212) + "|" + String.fromCharCode(8211) + "|guarantee|confirmed|checked by us", "i"));
  assert.match(TOOLTIP_OFFICIAL, /does not check that/);
});
