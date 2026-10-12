// place.unit.test.js - what the place of an opening reads (js/place.js, October 9, 2026, prompt AZ3): the catalog places win; the employer board's text is shown ONLY while there are none, always with the small note,
// cleaned and at most 200 characters. No network, no database. Prompt BN (October 11, 2026): placeParts also says whether anything is set (stated), and placeNodes leaves the place out when the caller asks (hideNone)
// and nothing is set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { placeParts, placeNodes, sourcePlaceText, PLACE_NOTE, MAX_PLACE_CHARS } from "../js/place.js";

test("the note is exactly the agreed words and the limit is 200", () => {
  assert.equal(PLACE_NOTE, "as provided by the employer");
  assert.equal(MAX_PLACE_CHARS, 200);
});

test("an opening with catalog places shows them and never the source text", () => {
  const row = { locations: ["Clearwater, FL"], is_remote: false, source_location_text: "Tokyo, Japan" };
  assert.deepEqual(placeParts(row), { text: "Clearwater, FL", note: null, stated: true });
  assert.deepEqual(placeParts({ locations: ["Boston, MA", "Providence, RI"], is_remote: true, source_location_text: "Berlin, Germany" }), { text: "Remote · Boston, MA · Providence, RI", note: null, stated: true });
});

test("an opening with no catalog place shows the source text with the note", () => {
  assert.deepEqual(placeParts({ locations: [], is_remote: false, source_location_text: "São Paulo, Brazil" }), { text: "São Paulo, Brazil", note: PLACE_NOTE, stated: true });
  assert.deepEqual(placeParts({ locations: [" ", ""], is_remote: false, source_location_text: "Tokyo, Japan" }), { text: "Tokyo, Japan", note: PLACE_NOTE, stated: true }, "blank places are no places");
  assert.deepEqual(placeParts({ locations: null, is_remote: null, source_location_text: "Tokyo, Japan" }), { text: "Tokyo, Japan", note: PLACE_NOTE, stated: true });
});

test("remote: Remote first, unless the board's text is itself Remote", () => {
  assert.equal(placeParts({ locations: [], is_remote: true, source_location_text: "São Paulo, Brazil" }).text, "Remote · São Paulo, Brazil");
  assert.equal(placeParts({ locations: [], is_remote: true, source_location_text: "Remote" }).text, "Remote");
  assert.equal(placeParts({ locations: [], is_remote: false, source_location_text: "Remote" }).text, "Remote");
});

test("no source text, or one that is not text, falls back to the plain line (Location not stated) with no note", () => {
  for (const v of [null, undefined, "", "   ", 5, {}, [], true, "\u0007\u0007"]) assert.deepEqual(placeParts({ locations: [], is_remote: false, source_location_text: v }), { text: "Location not stated", note: null, stated: false }, JSON.stringify(v));
  assert.deepEqual(placeParts({ locations: [], is_remote: false }), { text: "Location not stated", note: null, stated: false });
  assert.deepEqual(placeParts(null), { text: "Location not stated", note: null, stated: false });
});

test("remote with no place is a stated place: it reads Remote", () => {
  assert.deepEqual(placeParts({ locations: [], is_remote: true, source_location_text: null }), { text: "Remote", note: null, stated: true });
});

test("the text is cleaned: control characters out, trimmed, at most 200 characters; markup is left as characters (the page shows it with textContent)", () => {
  assert.equal(sourcePlaceText({ source_location_text: "  Tokyo,\u0007 Japan\n " }), "Tokyo, Japan");
  assert.equal(sourcePlaceText({ source_location_text: "x".repeat(300) }).length, 200);
  assert.equal(sourcePlaceText({ source_location_text: "a".repeat(199) + " " + "b".repeat(10) }).length, 199, "a space at the cut is trimmed");
  assert.equal(sourcePlaceText({ source_location_text: "<script>alert(1)</script> Tokyo" }), "<script>alert(1)</script> Tokyo");
  assert.equal(placeParts({ locations: [], source_location_text: "<b>Tokyo</b>" }).text, "<b>Tokyo</b>", "no markup is made or removed here");
});

// prompt BN: the employer's two screens show NOTHING when nothing is set; every other screen keeps "Location not stated"
test("hideNone: nothing at all comes back only for an opening with nothing set, and only when the caller asks", () => {
  const h = (tag, attrs, ...kids) => ({ tag, attrs, kids });
  const none = { locations: [], is_remote: false, source_location_text: null };
  assert.deepEqual(placeNodes(h, none, { note: false, hideNone: true }), [], "nothing set, asked to hide: nothing");
  assert.deepEqual(placeNodes(h, none), ["Location not stated"], "a candidate screen keeps the words");
  assert.deepEqual(placeNodes(h, none, { note: false }), ["Location not stated"], "leaving the note off does not hide the words");
  assert.deepEqual(placeNodes(h, { ...none, is_remote: true }, { note: false, hideNone: true }), ["Remote"], "Remote with no place still reads Remote");
  assert.deepEqual(placeNodes(h, { ...none, locations: ["Austin, TX"] }, { note: false, hideNone: true }), ["Austin, TX"]);
  assert.deepEqual(placeNodes(h, { ...none, source_location_text: "Paris, France" }, { note: false, hideNone: true }), ["Paris, France"]);
  assert.deepEqual(placeNodes(h, null, { hideNone: true }), [], "no row at all is nothing set");
});
