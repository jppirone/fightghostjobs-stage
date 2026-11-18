// phone-entry-ot.unit.test.js (prompt OT, November 18, 2026) - the three LinkedIn job cards and their variants through the REAL fragment path of the search page (the address the Shortcut opens, readFragment, the reading, the boxes), reader-v4. No browser.
// Rows: tests/phone-readings-ot.js (kind rebuilt: Apple's real text was not seen). Run: node --test tests/phone-entry-ot.unit.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFragment, parsePhoneFragment, limitText, TEXT_CAP } from "../js/phone-model.js";
import { choiceText } from "../js/phone-text.js";
import { READINGS_OT } from "./phone-readings-ot.js";

const enc = encodeURIComponent;   // the Shortcut's URL Encode action: every character outside the unreserved ones is percent encoded as UTF-8

test("the rows are the ones the prompt names, none is kind apple, every id is once", () => {
  assert.equal(READINGS_OT.length, 22);
  assert.equal(new Set(READINGS_OT.map((r) => r.id)).size, READINGS_OT.length);
  assert.ok(READINGS_OT.every((r) => r.kind === "rebuilt"), "rebuilt from a screenshot, not apple");
});

for (const r of READINGS_OT) {
  test(r.id + " " + r.name, () => {
    const hash = "#x=" + enc(r.text);
    // the text goes through the address and the parser character for character
    assert.equal(parsePhoneFragment(hash).text, r.text, "the text survives the address");
    assert.ok(limitText(r.text).text.length <= TEXT_CAP && limitText(r.text).cut === false);
    const got = readFragment(hash);
    assert.equal(got.refused, false);
    assert.equal(got.state, r.expect.state, "state");
    assert.equal(got.cut, r.expect.cut, "cut");
    assert.equal(got.boxes.fill.company, r.expect.company, "company box");
    assert.equal(got.boxes.fill.query, r.expect.query, "title box");
    assert.equal(got.boxes.fill.req, r.expect.req, "req box");
    assert.deepEqual(got.boxes.notes, r.expect.notes, "sentence numbers under the boxes");
    assert.equal(got.boxes.orderAssumed, r.expect.orderAssumed, "the page's check line (orderAssumed)");
    assert.deepEqual(got.cards.slice(1).map((c) => choiceText(c.title, c.company)), r.expect.others, "other openings");
    assert.ok(got.cards.length === 0 || got.cards.length >= 2);
  });
}
