// analytics.test.js - the Analytics page's pure display logic: the date-range menu, click-through, the two breakdown charts, and the thin-data threshold.
// The counts themselves come from the server (employer_analytics_summary, verified separately in the live DB suite); this only checks how they become percentages, bar widths and labels. Run: node --test tests/analytics.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { RANGE_OPTIONS, DEFAULT_RANGE_DAYS, rangeToDates, sharePctLabel, clickThroughPct, clickThroughLabel, barWidthPct, searchModeBreakdown, linkBreakdown, isThinData, THIN_DATA_THRESHOLD } from "../js/analytics-model.js";

const NOW = Date.parse("2026-09-28T12:00:00Z");

test("range menu: four presets, 30 days is the default", () => {
  assert.deepEqual(RANGE_OPTIONS.map((r) => r[0]), ["7", "30", "90", "365"]);
  assert.equal(DEFAULT_RANGE_DAYS, 30);
});

test("rangeToDates: [now - days, now), and an invalid days value falls back to the default rather than a garbage range", () => {
  const r30 = rangeToDates(30, NOW);
  assert.equal(r30.to, new Date(NOW).toISOString());
  assert.equal(r30.from, new Date(NOW - 30 * 86400000).toISOString());
  assert.equal(rangeToDates(7, NOW).from, new Date(NOW - 7 * 86400000).toISOString());
  assert.equal(rangeToDates(0, NOW).from, rangeToDates(DEFAULT_RANGE_DAYS, NOW).from);          // 0, negative, NaN: all fall back
  assert.equal(rangeToDates(-5, NOW).from, rangeToDates(DEFAULT_RANGE_DAYS, NOW).from);
  assert.equal(rangeToDates(NaN, NOW).from, rangeToDates(DEFAULT_RANGE_DAYS, NOW).from);
  assert.equal(rangeToDates("not a number", NOW).from, rangeToDates(DEFAULT_RANGE_DAYS, NOW).from);
});

test("share of registry: a real percentage renders as a percentage; no platform data renders as a plain sentence, never a fabricated 0% or 100%", () => {
  assert.equal(sharePctLabel(18.4), "18.4%");
  assert.equal(sharePctLabel(0), "0%");
  assert.equal(sharePctLabel(100), "100%");
  assert.equal(sharePctLabel(null), "Not enough platform data yet");
  assert.equal(sharePctLabel(undefined), "Not enough platform data yet");
});

test("click-through: link clicks over detail views, and no detail views is '—' (unknown), never a divide-by-zero 0%", () => {
  assert.equal(clickThroughPct(100, 37), 37);
  assert.equal(clickThroughPct(3, 1), 33);           // rounds
  assert.equal(clickThroughPct(0, 0), null);
  assert.equal(clickThroughPct(0, 5), null);          // clicks with no recorded views is a data oddity, not a real 0/0
  assert.equal(clickThroughLabel(0, 0), "—");
  assert.equal(clickThroughLabel(40, 10), "25%");
  assert.equal(clickThroughPct(10, -3), 0);           // a negative count (should never happen) never produces a negative percentage
});

test("bar width: relative to the group's max, a tiny real value still shows a visible sliver, nothing shows a bar when there is nothing to show", () => {
  assert.equal(barWidthPct(50, 100), 50);
  assert.equal(barWidthPct(100, 100), 100);
  assert.equal(barWidthPct(0, 100), 0);
  assert.equal(barWidthPct(1, 1000), 2);              // sliver floor, not an invisible 0.1%
  assert.equal(barWidthPct(5, 0), 0);                 // no max: nothing to be relative to
  assert.equal(barWidthPct(150, 100), 100);            // never over 100%
});

test("search-mode breakdown: percentages of the three modes together, sorted by count desc, zero-count modes dropped, and it never mentions unmatched searches", () => {
  const rows = searchModeBreakdown({ phrase: 61, code: 24, req: 15 });
  assert.deepEqual(rows.map((r) => r.key), ["phrase", "code", "req"]);
  assert.deepEqual(rows.map((r) => r.pct), [61, 24, 15]);
  assert.equal(searchModeBreakdown({ phrase: 0, code: 0, req: 0 }).length, 0);
  assert.equal(searchModeBreakdown({}).length, 0);
  assert.equal(searchModeBreakdown(undefined).length, 0);
  const tie = searchModeBreakdown({ req: 5, phrase: 5, code: 0 });                              // a tie keeps phrase before req (VIA_ORDER), not insertion order
  assert.deepEqual(tie.map((r) => r.key), ["phrase", "req"]);
  for (const r of rows) assert.equal(typeof r.label, "string");
  assert.ok(!JSON.stringify(rows).match(/unmatched/i));
});

test("link breakdown: sorted by clicks desc even if the server answer were not, each row's bar relative to the top link", () => {
  const rows = linkBreakdown([{ link_id: "a", clicks: 16 }, { link_id: "b", clicks: 88 }, { link_id: "c", clicks: 47 }]);
  assert.deepEqual(rows.map((r) => r.link_id), ["b", "c", "a"]);
  assert.equal(rows[0].widthPct, 100);
  assert.equal(rows[1].widthPct, Math.round((100 * 47) / 88));
  assert.equal(linkBreakdown([]).length, 0);
  assert.equal(linkBreakdown(undefined).length, 0);
});

test("thin data: below the threshold (or a missing/non-integer total) is thin; at or above it is not", () => {
  assert.equal(THIN_DATA_THRESHOLD, 20);
  assert.equal(isThinData(0), true);
  assert.equal(isThinData(19), true);
  assert.equal(isThinData(20), false);
  assert.equal(isThinData(500), false);
  assert.equal(isThinData(null), true);
  assert.equal(isThinData(undefined), true);
  assert.equal(isThinData("30"), true);
});
