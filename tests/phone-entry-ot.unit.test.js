// phone-entry-ot.unit.test.js (prompt OT, November 18, 2026) - the three LinkedIn job cards and their variants through the REAL fragment path of the search page (the address the Shortcut opens, readFragment, the reading, the boxes), reader-v5 (prompt OV, which replaced reader-v4). No browser.
// Rows: tests/phone-readings-ot.js (two rows are the REAL Apple texts of John's Shortcut, the others say Apple's real text was not seen) and the two real addresses. Run: node --test tests/phone-entry-ot.unit.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFragment, parsePhoneFragment, limitText, TEXT_CAP } from "../js/phone-model.js";
import { choiceText } from "../js/phone-text.js";
import { READINGS_OT, KIND_REAL, KIND_REBUILT } from "./phone-readings-ot.js";

const enc = encodeURIComponent;   // the Shortcut's URL Encode action: every character outside the unreserved ones is percent encoded as UTF-8

test("the rows: every id once, the two real Apple texts are kind real, every other row says Apple's real text was not seen", () => {
  assert.equal(READINGS_OT.length, 41);
  assert.equal(new Set(READINGS_OT.map((r) => r.id)).size, READINGS_OT.length);
  assert.deepEqual(READINGS_OT.filter((r) => r.kind === KIND_REAL).map((r) => r.id), ["OT13", "OT20"]);
  assert.ok(READINGS_OT.filter((r) => r.kind !== KIND_REAL).every((r) => r.kind === KIND_REBUILT));
});

// prompt OV (November 18, 2026): the two REAL addresses exactly as John's Shortcut opened them on the stage page. The page reads the part after the # sign. A plus sign is left as typed, the middle dot is %E2%80%A2, the empty s key follows.
const REAL_ADDRESSES = [
  ["Burtch Works", "https://stage.fightghostjobs.com/search.html#x=BW%0ADirector%20of%20Al%20Strategy%20+%20Adoption%0ABurtch%20Works%20%E2%80%A2%20United%20States%20(Remote)%0A$175K-$190K%20/%20year&s=", "OT13"],
  ["OpenAI", "https://stage.fightghostjobs.com/search.html#x=Applied%20Al%20Delivery%20Lead%20-%20Remote%0Ain%20AMER%0AOpenAl%20%E2%80%A2%20United%20States%20(Remote)%0A$234K-$335K%20/%20year&s=", "OT20"],
];
for (const [name, url, id] of REAL_ADDRESSES) {
  test("the real " + name + " address as a complete string: the text is the real Apple text character for character, no source, the boxes are the ones in " + id, () => {
    const hash = new URL(url).hash;
    const want = READINGS_OT.find((r) => r.id === id);
    const p = parsePhoneFragment(hash);
    assert.equal(p.refused, false);
    assert.equal(p.text, want.text, "the address gives the real text back");
    assert.equal(p.source, "", "the empty s key gives no source");
    const got = readFragment(hash);
    assert.equal(got.state, "read");
    assert.equal(got.boxes.fill.company, want.expect.company, "company box");
    assert.equal(got.boxes.fill.query, want.expect.query, "title box");
    assert.equal(got.boxes.orderAssumed, want.expect.orderAssumed, "the check line");
    assert.deepEqual(got.boxes.notes, want.expect.notes);
  });
}

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
