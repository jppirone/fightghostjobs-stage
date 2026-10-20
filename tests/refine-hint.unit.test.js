// refine-hint.unit.test.js - the two gentle refine lines above the results of a title search (October 20, 2026): js/refine-hint.js and the three lists of js/config.js. No browser, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { refineHints, titleWords, isGenericTitle } from "../js/refine-hint.js";
import { REFINE_HINT_MAX_RESULTS, GENERIC_TITLE_WORDS, TITLE_FILLER_WORDS } from "../js/config.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COUNT = (n) => "We found " + n + " openings. To narrow it, add a more specific word from the title, such as a team or function.";
const GENERIC = "That word is common in many titles. Adding another word from the title will narrow the results.";

test("the three settings are what John asked for, each in one place", () => {
  assert.equal(REFINE_HINT_MAX_RESULTS, 3);
  assert.deepEqual(GENERIC_TITLE_WORDS, ["manager", "senior", "junior", "associate", "specialist", "director", "analyst", "assistant", "coordinator", "lead", "supervisor", "engineer", "representative", "administrator"]);
  assert.deepEqual(TITLE_FILLER_WORDS, ["of", "the", "and", "a", "an", "for", "in", "at", "to", "with"]);
});

test("more than 3 openings says how many, exactly 3 or fewer says nothing about the count", () => {
  for (const n of [4, 5, 12, 25]) assert.deepEqual(refineHints({ mode: "phrase", query: "support analyst", count: n, truncated: false }), [COUNT(n)], "count " + n);
  for (const n of [1, 2, 3]) assert.deepEqual(refineHints({ mode: "phrase", query: "support analyst", count: n, truncated: false }), [], "count " + n);
  assert.deepEqual(refineHints({ mode: "phrase", query: "support analyst", count: 25, truncated: true }), ["We found more than 25 openings. To narrow it, add a more specific word from the title, such as a team or function."], "the database stopped at its limit: more than 25");
});

test("a title that is only one generic word shows the second line, with or without filler, in any case, and still not for two words", () => {
  for (const w of GENERIC_TITLE_WORDS) assert.deepEqual(refineHints({ mode: "phrase", query: w, count: 2, truncated: false }), [GENERIC], w);
  assert.deepEqual(refineHints({ mode: "phrase", query: "  MANAGER  ", count: 1, truncated: false }), [GENERIC]);
  assert.deepEqual(refineHints({ mode: "phrase", query: "the Manager of", count: 1, truncated: false }), [GENERIC], "filler words are left out first");
  assert.deepEqual(refineHints({ mode: "phrase", query: "manager,", count: 1, truncated: false }), [GENERIC], "punctuation is left out");
  assert.deepEqual(refineHints({ mode: "phrase", query: "senior manager", count: 2, truncated: false }), [], "two words are not one generic word");
  assert.deepEqual(refineHints({ mode: "phrase", query: "nurse", count: 2, truncated: false }), [], "a word that is not on the list");
  assert.deepEqual(refineHints({ mode: "phrase", query: "managers", count: 2, truncated: false }), [], "the plural is another word (whole words only)");
});

test("both lines can show at once, the count first; neither shows for no results or for a search that is not a title search", () => {
  assert.deepEqual(refineHints({ mode: "phrase", query: "manager", count: 7, truncated: false }), [COUNT(7), GENERIC]);
  assert.deepEqual(refineHints({ mode: "phrase", query: "manager", count: 0, truncated: false }), [], "nothing found: no hint");
  for (const mode of ["req", "code", "kio", undefined, null, "", "Phrase"]) assert.deepEqual(refineHints({ mode, query: "manager", count: 9, truncated: false }), [], "mode " + mode);
  for (const count of [undefined, null, NaN, "5", 2.5, -1]) assert.deepEqual(refineHints({ mode: "phrase", query: "manager", count, truncated: false }), [], "count " + count);
});

test("the typed words: letters and digits only, filler left out, nothing else", () => {
  assert.deepEqual(titleWords("Director of Operations"), ["director", "operations"]);
  assert.deepEqual(titleWords("  Client-Services / Supervisor "), ["client", "services", "supervisor"]);
  assert.deepEqual(titleWords("of the and a an for in at to with"), []);
  assert.deepEqual(titleWords(null), []);
  assert.deepEqual(titleWords("Ingénieur Sénior"), ["ingénieur", "sénior"]);
  assert.equal(isGenericTitle("of the"), false, "filler only is not a generic word");
  assert.equal(isGenericTitle(""), false);
});

test("the words of the lines: plain, no fear, never \"verified\", no em dash", () => {
  const text = [COUNT(5), GENERIC].join(" ") + fs.readFileSync(path.join(ROOT, "js", "refine-hint.js"), "utf8").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(text, /verif|warn|danger|beware|scam|fraud|—|–/i);
  assert.ok(refineHints({ mode: "phrase", query: "x", count: 4, truncated: false })[0].startsWith("We found 4 openings."));
});
