// source-capture.unit.test.js - the optional "where you found this job" piece without a browser (prompt JD, November 7, 2026): the key s of the Shortcut address (john's examples, empty, missing, repeated, a bad escape, 300 characters,
// an encoded & and #, s before x, s alone, a classic key), the limit (js/source-clean.js), the saved search of the sign in hand-off, the words (js/source-text.js: facts only, no dash, no forbidden word), the markup of the field
// in search.html, and that no pinned sentence of js/phone-text.js was touched. Run: node --test tests/source-capture.unit.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePhoneFragment, readFragment, TEXT_CAP } from "../js/phone-model.js";
import { limitSource, SOURCE_MAX } from "../js/source-clean.js";
import { savePending, takePending } from "../js/signin-handoff.js";
import { SOURCE_LABEL, SOURCE_OPTIONAL, SOURCE_INSTRUCTION, SOURCE_EMPLOYERS_SEE, SOURCE_PHONE_SENTENCE } from "../js/source-text.js";
import { SENTENCES } from "../js/phone-text.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
const enc = encodeURIComponent;
const A = "Acme Robotics\nSenior Data Analyst\nRemote";

test("the fragment: the text and the source, joined by a plain &s= (the three examples John produced on his phone)", () => {
  for (const [s, want] of [["Jobsite.com", "Jobsite.com"], ["Jobs@linkedin.com", "Jobs@linkedin.com"], ["Jobs at LinkedIn", "Jobs at LinkedIn"]]) {
    const p = parsePhoneFragment("#x=" + enc(A) + "&s=" + enc(s));
    assert.deepEqual(p, { x: true, refused: false, text: A, source: want });
  }
  assert.deepEqual(parsePhoneFragment("#x=" + enc("16 school alumni") + "&s=Jobs%20at%20LinkedIn"), { x: true, refused: false, text: "16 school alumni", source: "Jobs at LinkedIn" });
});
test("the fragment: an empty s, no s, a repeated s and a bad percent sequence give no source and keep the text", () => {
  assert.deepEqual(parsePhoneFragment("#x=" + enc(A) + "&s="), { x: true, refused: false, text: A, source: "" });
  assert.deepEqual(parsePhoneFragment("#x=" + enc(A)), { x: true, refused: false, text: A, source: "" });
  assert.deepEqual(parsePhoneFragment("#x=" + enc(A) + "&s=a&s=b"), { x: true, refused: false, text: A, source: "" });
  assert.deepEqual(parsePhoneFragment("#x=" + enc(A) + "&s=%E0%A4%A"), { x: true, refused: false, text: A, source: "" });
  assert.deepEqual(parsePhoneFragment("#x=" + enc(A) + "&s=%"), { x: true, refused: false, text: A, source: "" });
});
test("the fragment: 300 characters are cut at 120, an encoded & and # stay inside the source, s before x works", () => {
  assert.equal(parsePhoneFragment("#x=" + enc(A) + "&s=" + "z".repeat(300)).source, "z".repeat(SOURCE_MAX));
  assert.equal(SOURCE_MAX, 120);
  const p = parsePhoneFragment("#x=" + enc(A) + "&s=" + enc("a&b#c"));
  assert.equal(p.source, "a&b#c"); assert.equal(p.text, A);
  const q = parsePhoneFragment("#s=" + enc("Dice.com") + "&x=" + enc(A));
  assert.deepEqual(q, { x: true, refused: false, text: A, source: "Dice.com" });
});
test("the fragment: the text alone is unchanged, s alone is no phone entry, a classic key still refuses (the source goes with it)", () => {
  assert.deepEqual(parsePhoneFragment("#x=" + enc(A)), { x: true, refused: false, text: A, source: "" });
  assert.deepEqual(parsePhoneFragment("#s=Jobsite.com"), { x: false, refused: false, text: "", source: "" });
  assert.deepEqual(parsePhoneFragment("#x=" + enc(A) + "&c=Acme&s=Jobsite.com"), { x: true, refused: true, text: "", source: "" });
  assert.deepEqual(parsePhoneFragment("#x=" + enc(A) + "&x=b&s=Jobsite.com"), { x: true, refused: true, text: "", source: "" });
  assert.deepEqual(readFragment("#s=Jobsite.com"), { x: false });
  assert.deepEqual(readFragment("#x=" + enc(A) + "&c=Acme&s=Jobsite.com"), { x: true, refused: true });
});
test("the source is a separate piece: never inside the text, never read by the reader, not cut by the 600 character cap", () => {
  const long = "Acme Robotics\n" + "line of the screenshot\n".repeat(60);
  const p = parsePhoneFragment("#x=" + enc(long) + "&s=" + enc("Jobs at LinkedIn"));
  assert.ok(!p.text.includes("LinkedIn"), "the source is not in the text");
  const r = readFragment("#x=" + enc(A) + "&s=" + enc("Zorbo Staffing"));
  assert.equal(r.source, "Zorbo Staffing");
  assert.ok(!JSON.stringify(r.boxes || {}).includes("Zorbo"), "the reader never saw the source: it is in no box");
  assert.equal(TEXT_CAP, 600, "the cap of the text is unchanged");
  // %26s%3D inside the text is text, not a source
  const t = parsePhoneFragment("#x=" + enc("a&s=b") + "&s=" + enc("real"));
  assert.equal(t.text, "a&s=b"); assert.equal(t.source, "real");
});
test("limitSource: tabs and line breaks are spaces, other control characters go, runs of spaces become one, trimmed, cut at 120 whole characters", () => {
  assert.equal(limitSource("  Jobs   at\tLinkedIn\n"), "Jobs at LinkedIn");
  assert.equal(limitSource("a\u0001b\u007fc\u0085d"), "abc d");
  assert.equal(limitSource("a\u0001b"), "ab");
  assert.equal(limitSource("x".repeat(500)).length, 120);
  assert.equal(limitSource("😀".repeat(130)), "😀".repeat(120), "whole characters, never half of a pair");
  assert.equal(limitSource("a".repeat(119) + " b"), "a".repeat(119), "no trailing space after the cut");
  for (const bad of [null, undefined, 5, {}, [], true]) assert.equal(limitSource(bad), "");
  assert.equal(limitSource("   "), "");
  assert.equal(limitSource("Jobs@LinkedIn.com"), "Jobs@LinkedIn.com", "case and address kept as typed");
});
test("the saved search of the sign in hand-off carries the source, limited, and brings it back; an old saved search has none", () => {
  const store = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })();
  assert.ok(savePending(store, { company: "Acme", q: "Analyst", r: "", source: "Jobs@linkedin.com", origin: "mobile", host: null }));
  assert.deepEqual(takePending(store), { company: "Acme", q: "Analyst", r: "", origin: "mobile", host: null, source: "Jobs@linkedin.com" });
  assert.ok(savePending(store, { company: "Acme", q: "Analyst", r: "", source: "y".repeat(400), origin: "site" }));
  assert.equal((takePending(store).source ?? "").length, 120);
  assert.ok(savePending(store, { company: "Acme", q: "Analyst", r: "" }));
  assert.equal((takePending(store).source ?? ""), "");
  // a damaged or hand made saved search: a number is no source, a long text is cut again when it is read back
  store.setItem("fgj-pending-search", JSON.stringify({ exp: Date.now() + 100000, v: { company: "Acme", q: "A", r: "", source: 5 } }));
  assert.equal((takePending(store).source ?? ""), "");
  store.setItem("fgj-pending-search", JSON.stringify({ exp: Date.now() + 100000, v: { company: "Acme", q: "A", r: "", source: "w".repeat(250) } }));
  assert.equal((takePending(store).source ?? "").length, 120);
});
test("the words: facts only, no dash, no relative day word, the example and the optional tag are in them, and they are the words of the page", () => {
  const all = [SOURCE_LABEL, SOURCE_OPTIONAL, SOURCE_INSTRUCTION, SOURCE_EMPLOYERS_SEE, SOURCE_PHONE_SENTENCE];
  for (const s of all) {
    assert.ok(!/[–—]|--/.test(s), "a dash in: " + s);
    assert.ok(!/\b(today|tonight|tomorrow|yesterday)\b/i.test(s), "a relative day word in: " + s);
    assert.ok(!/verif|trust|free\b|guarantee|ghost|fake|scam|real\b/i.test(s), "a forbidden word in: " + s);
  }
  assert.equal(SOURCE_OPTIONAL, "Optional");
  // prompt JK (John, November 7, 2026): the one short line replaces the long instruction of prompt JH
  assert.equal(SOURCE_INSTRUCTION, "Site (ex. LinkedIn.com or LinkedIn) or email (ex. jobs@linkedin.com)");
  assert.ok(!/Type a site name|LinkedIn alone is fine|the address of the email the job came from/.test(R("search.html") + R("js/source-text.js")), "the old long instruction is nowhere");
  assert.ok(/exactly as you type it/.test(SOURCE_EMPLOYERS_SEE) && /optional/.test(SOURCE_PHONE_SENTENCE) && /do not check it/.test(SOURCE_PHONE_SENTENCE) && /own email address/.test(SOURCE_PHONE_SENTENCE));
  const html = R("search.html");
  assert.ok(html.includes(SOURCE_INSTRUCTION) && html.includes(SOURCE_EMPLOYERS_SEE) && html.includes('<span class="srch-opt">' + SOURCE_OPTIONAL + "</span> " + SOURCE_LABEL), "search.html says it in the same words (Optional comes first, prompt JK)");
  // the employer sentence is not on the form any more: it is in the hidden sentences that the info box copies
  const src = (html.match(/<div id="infoSource" hidden>([\s\S]*?)\n<\/div>/) || [])[1] || "";
  assert.ok(src.includes('<div id="sourceNote" class="field-hint">' + SOURCE_EMPLOYERS_SEE + "</div>") && !html.replace(src, "").includes(SOURCE_EMPLOYERS_SEE), "the employer sentence is only in the hidden sentences");
});
test("the markup of the field: a label for the input, an input of the search form with a limit of 120, no placeholder standing in for the label", () => {
  const html = R("search.html");
  assert.match(html, /<label for="sourceq"/);
  const m = /<input id="sourceq"[^>]*>/.exec(html);
  assert.ok(m, "the input is there");
  assert.ok(!/\bform=/.test(m[0]), "the input is a child of the form, it names no owner (prompt JK)");
  for (const need of ['type="text"', 'maxlength="120"', 'autocomplete="off"', 'aria-describedby="sourceHint sourceNote"']) assert.ok(m[0].includes(need), "the input has " + need);
  assert.ok(!/placeholder=/.test(m[0]), "no placeholder");
  assert.ok(html.indexOf('id="searchForm"') < html.indexOf('id="sourceBlock"') && html.indexOf('id="sourceBlock"') < html.indexOf('id="searchBtn"') && html.indexOf('id="searchBtn"') < html.indexOf("</form>") && html.indexOf("</form>") < html.indexOf('id="formError"'), "the block sits inside the search box, above the Search button, which is the last thing in the box (prompt JK)");
  assert.ok(html.includes('id="phoneSource"'), "the panel has its sentence element");
});
test("the 13 pinned sentences of the phone entry are not touched, and the new words live in their own file", () => {
  assert.equal(Object.keys(SENTENCES).length, 13);
  assert.equal(SENTENCES[13], "We never receive your screenshot. Your phone reads the text and this page keeps it in the page only. Nothing is sent until you press Search. Then only the values in the boxes are sent, and the search is recorded like any other.");
  assert.equal(SENTENCES[12], "This page is for phones. On a computer, use the browser extension.");
  assert.ok(!R("js/phone-text.js").includes("found the job"), "js/phone-text.js holds no source wording");
});
test("the source is only ever put in the field with .value, kept in memory, and never in storage, a log or a request by the phone files", () => {
  const entry = R("js/phone-entry.js"), model = R("js/phone-model.js");
  assert.ok(/sourceEl\.value = /.test(entry) && !/innerHTML|insertAdjacentHTML/.test(entry));
  const code = (entry + model).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");   // comments are not code
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie|console\.|fetch\(|XMLHttpRequest|sendBeacon/.test(code));
  assert.ok(!/\bs\b.*refus/.test(model.split("CLASSIC_KEYS =")[1].split("\n")[0]), "s is not a classic key");
  assert.ok(!/"s"/.test(model.split("CLASSIC_KEYS =")[1].split("\n")[0]));
});
