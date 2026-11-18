// phone-entry-ox.unit.test.js (prompt OX, November 18, 2026) - the LinkedIn test opening with a KIO ID in its title and its variants through the REAL fragment path of the search page (the address the Shortcut opens, readFragment, the reading, the boxes), reader-v6 (replaces reader-v5). No browser.
// Rows: tests/phone-readings-ox.js (one row is the REAL Apple text of John's Shortcut, the others say so) and the real address. The controls of prompt OV (the real Burtch Works and OpenAI rows OT13 and OT20 and the Slalom row OT30) run here too. Run: node --test tests/phone-entry-ox.unit.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFragment, parsePhoneFragment, limitText, TEXT_CAP } from "../js/phone-model.js";
import { choiceText } from "../js/phone-text.js";
import { READINGS_OX, KIND_REAL, KIND_REBUILT } from "./phone-readings-ox.js";
import { READINGS_OT } from "./phone-readings-ot.js";

const enc = encodeURIComponent;   // the Shortcut's URL Encode action

test("the rows: every id once, the real Apple text is kind real, every other row says so", () => {
  assert.equal(READINGS_OX.length, 12);
  assert.equal(new Set(READINGS_OX.map((r) => r.id)).size, READINGS_OX.length);
  assert.deepEqual(READINGS_OX.filter((r) => r.kind === KIND_REAL).map((r) => r.id), ["OX01"]);
  assert.ok(READINGS_OX.filter((r) => r.kind !== KIND_REAL).every((r) => r.kind === KIND_REBUILT));
});

const check = (r, hash) => {
  const got = readFragment(hash);
  assert.equal(got.refused, false);
  assert.equal(got.state, r.expect.state, "state");
  assert.equal(got.cut, r.expect.cut, "cut");
  assert.deepEqual(got.boxes.fill, { company: r.expect.company, query: r.expect.query, req: r.expect.req }, "the three boxes (no other field, so no title is held)");
  assert.deepEqual(got.boxes.notes, r.expect.notes, "sentence numbers under the boxes");
  assert.equal(got.boxes.orderAssumed, r.expect.orderAssumed, "the page's check line (orderAssumed)");
  assert.deepEqual(got.cards.slice(1).map((c) => choiceText(c.title, c.company)), r.expect.others, "other openings");
  assert.ok(got.cards.length === 0 || got.cards.length >= 2);
};

// the REAL address exactly as John's Shortcut opened it on the stage page (November 18, 2026, 1:26 AM), source LinkedIn
const REAL_URL = "https://stage.fightghostjobs.com/search.html#x=Chief%20Human%20Resources%0AOfficer%20(TEST%20ONLY)%20KIO-Q9GQ-QMXJ-EP8Y%0AFightGhostJobs%0ASebastian,%20FL%20(On-site)&s=LinkedIn";
test("the real KIO address as a complete string: the text is the real text character for character, the source is LinkedIn, the boxes are the ones in OX01", () => {
  const hash = new URL(REAL_URL).hash;
  const want = READINGS_OX.find((r) => r.id === "OX01");
  const p = parsePhoneFragment(hash);
  assert.equal(p.refused, false);
  assert.equal(p.text, want.text, "the address gives the real text back");
  assert.equal(p.source, "LinkedIn");
  check(want, hash);
});

for (const r of [...READINGS_OX, ...READINGS_OT.filter((x) => ["OT13", "OT20", "OT30"].includes(x.id))]) {
  test(r.id + " " + r.name, () => {
    const hash = "#x=" + enc(r.text);
    assert.equal(parsePhoneFragment(hash).text, r.text, "the text survives the address");
    assert.ok(limitText(r.text).text.length <= TEXT_CAP && limitText(r.text).cut === false);
    if (r.id.startsWith("OT")) {
      const got = readFragment(hash);
      assert.equal(got.state, r.expect.state);
      assert.equal(got.boxes.fill.company, r.expect.company, "company box");
      assert.equal(got.boxes.fill.query, r.expect.query, "title box");
      assert.equal(got.boxes.orderAssumed, r.expect.orderAssumed, "the page's check line");
    } else check(r, hash);
  });
}
