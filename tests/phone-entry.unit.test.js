// phone-entry.unit.test.js - the phone entry without a browser (prompt IB, November 3, 2026): the 13 sentences letter for letter, the x parser (percent escapes, plus signs, line breaks, control characters, empty text, the 600 character cut at a whole
// line, x with the classic keys, unknown keys), the mapping from the reader to the boxes and the notes, the readings of tests/phone-readings.js, the hook in js/pages/search.js, the computer test and the link setting.
// Run: node --test tests/phone-entry.unit.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { SENTENCES, MORE_BEFORE, MORE_BUTTON, MORE_AFTER, EXTENSION_LINK_TEXT, choiceText } from "../js/phone-text.js";
import { parsePhoneFragment, limitText, boxesOf, cardBoxes, readingOf, readFragment, TEXT_CAP, MAX_FRAGMENT, MAX_PARTS } from "../js/phone-model.js";
import { isComputer, extensionLink, COMPUTER_QUERY } from "../js/phone-entry.js";
import { READINGS } from "./phone-readings.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const enc = encodeURIComponent;
const A = "Senior Logistics Analyst\nContoso Freight\nAustin, TX\n$85K/yr - $110K/yr\nViewed";
const B = "Route Planner\nBluebird Logistics\nDenver, CO (On-site)\nPromoted";

// John's 13 sentences (section 5 of report HX), copied here by hand: a change to a sentence in the page must be a change to this list as well
const WANT = [
  "Read from your screenshot. Check the boxes, then press Search.",
  "This looks cut off. Check it.",
  "Found in the title, not labelled. Check it.",
  "A word in the title looks broken. Type the title.",
  "Not found. Type it if the opening shows it.",
  "Not the one you meant? Pick another opening.",
  "Other openings on your screen:",
  "You picked this opening. Check the boxes.",
  "We could not find an opening in the screenshot. Type the company and the job title, the req number or the KIO ID.",
  "We could not read the text from your screenshot. Type the company and the job title, the req number or the KIO ID.",
  "Only the first part of the screenshot text was used.",
  "This page is for phones. On a computer, use the browser extension.",
  "We never receive your screenshot. Your phone reads the text and this page keeps it in the page only. Nothing is sent until you press Search. Then only the values in the boxes are sent, and the search is recorded like any other.",
];

test("the sentences are John's 13, letter for letter, and the line with the button is made of three parts", () => {
  assert.deepEqual(Object.keys(SENTENCES), WANT.map((_, i) => String(i + 1)));
  WANT.forEach((s, i) => assert.equal(SENTENCES[i + 1], s, "sentence " + (i + 1)));
  assert.equal(MORE_BEFORE + MORE_BUTTON + MORE_AFTER, WANT[5]);
  assert.equal(MORE_BUTTON, "Pick another opening", "the last three words are the button");
  assert.equal(EXTENSION_LINK_TEXT, "Get the browser extension");
  assert.equal(choiceText("Route Planner", "Bluebird Logistics"), "Route Planner at Bluebird Logistics");
});

test("no dash, no bad word, no 'posting' in any sentence or link text", () => {
  const dash = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
  const bad = /\b(ghost|fake|scam|fraud|suspicious|verified|certified|trusted|safe|compliant|guaranteed|catch|detect|flag|expose|loophole|compliance|posting|postings)\b/i;
  for (const s of [...Object.values(SENTENCES), EXTENSION_LINK_TEXT]) { assert.ok(!dash.test(s), "a dash in: " + s); assert.ok(!bad.test(s), "a bad word in: " + s); }
});

test("the x parser: percent escapes, a plus sign stays a plus sign, line breaks stay", () => {
  assert.deepEqual(parsePhoneFragment("#x=" + enc(A)), { x: true, refused: false, text: A, source: "" });   // prompt JD: the parser also returns the optional source ("" when there is none)
  assert.equal(parsePhoneFragment("#x=a+b%20c").text, "a+b c");
  assert.equal(parsePhoneFragment("#x=a%0D%0Ab%0Ac%E2%80%A8d").text, "a\r\nb\nc d");
  assert.equal(parsePhoneFragment("x=hello").text, "hello", "the leading # is optional");
  assert.equal(parsePhoneFragment("#x=" + enc("Zoë & Sons é中😀")).text, "Zoë & Sons é中😀");
});

test("the x parser: no x is not ours; the classic keys are not read here", () => {
  for (const h of ["", "#", "#top", "#c=A&t=B", "#y=1", "#xx=1", "#X=1", "#a=x=1", "#c=a%26x%3D1", "#x", "#=x"]) assert.equal(parsePhoneFragment(h).x, false, JSON.stringify(h));
  assert.equal(parsePhoneFragment(null).x, false);
  assert.equal(parsePhoneFragment(undefined).x, false);
});

test("the x parser: refused as a whole (sentence 10)", () => {
  const REFUSED = [
    ["a bad percent escape", "#x=%E0%A4%A"], ["a lone percent", "#x=100%"], ["a nul", "#x=a%00b"], ["a tab", "#x=a%09b"], ["a bell", "#x=a%07b"], ["a delete character", "#x=a%7Fb"], ["a C1 control", "#x=a%C2%85b"], ["an escape character", "#x=%1B%5Bm"],
    ["x twice", "#x=a&x=b"], ["x with c", "#c=Acme&x=a"], ["x with p", "#x=a&p=D21M"], ["x with r", "#x=a&r=4471"], ["x with t", "#x=a&t=Analyst"], ["x with k", "#x=a&k=KIO7K3M9Q2XW4T9"], ["x with o", "#x=a&o=m"], ["x with h", "#x=a&h=jobs.example.invalid"], ["x with o and h", "#o=e&h=jobs.example.invalid&x=a"],
    ["a fragment over the limit", "#x=" + "a".repeat(MAX_FRAGMENT)], ["too many parts", "#x=a" + "&u=1".repeat(MAX_PARTS)],
  ];
  for (const [label, h] of REFUSED) { const p = parsePhoneFragment(h); assert.equal(p.x, true, label); assert.equal(p.refused, true, label); assert.equal(p.text, "", label); }
  assert.deepEqual(readFragment("#c=Acme&x=" + enc(A)), { x: true, refused: true });
});

test("the x parser: empty text, only spaces and unknown keys are not refused", () => {
  assert.deepEqual(parsePhoneFragment("#x="), { x: true, refused: false, text: "", source: "" });
  assert.equal(parsePhoneFragment("#x=%20%20").refused, false);
  assert.equal(parsePhoneFragment("#x=" + enc(A) + "&utm_source=mail&zz=1").text, A, "an unknown key is ignored, as on the classic address");
  assert.equal(parsePhoneFragment("#x=" + enc(A) + "&__proto__=1").refused, false);
  for (const h of ["#x=", "#x=%20%0A%20", "#x=" + enc("   \n  \n ")]) { const r = readFragment(h); assert.equal(r.x, true); assert.equal(r.refused, false); assert.equal(r.state, "nothing", JSON.stringify(h)); assert.equal(r.boxes, null); assert.equal(r.cut, false); }
});

test("the cap: 600 characters, cut at the last whole line, and the page says so", () => {
  assert.equal(TEXT_CAP, 600);
  const line = (n, ch) => ch.repeat(n);
  const under = line(599, "a") + "\n" + "b";   // 601 characters; the 600th is the line break
  assert.deepEqual(limitText(line(600, "a")), { text: line(600, "a"), cut: false }, "exactly 600 is not cut");
  assert.equal(limitText(under).text, line(599, "a"));
  assert.equal(limitText(under).cut, true);
  const many = Array.from({ length: 20 }, (_, i) => line(50, String.fromCharCode(97 + i))).join("\n");   // 20 lines of 50 plus 19 breaks = 1019
  const cut = limitText(many);
  assert.ok(cut.cut && cut.text.length <= 600 && many.startsWith(cut.text), "the cut text is the start of the text");
  assert.ok(cut.text.split("\n").every((l) => l.length === 50), "every line is whole (no line ends in the middle)");
  assert.equal(cut.text.split("\n").length, 11);
  assert.deepEqual(limitText(line(700, "a")).text.length, 600, "one very long line is cut at 600");
  assert.equal(limitText("a".repeat(599) + "😀").text.length, 599, "never between the two halves of one character");
  assert.equal(limitText("a\r\n" + line(700, "b")).text, "a", "a CR LF break is a break");
  const r = readFragment("#x=" + enc(A + "\n" + line(700, "x")));
  assert.equal(r.cut, true);
  assert.equal(r.state, "read", "what is found in the first part is still shown");
  assert.equal(r.boxes.fill.company, "Contoso Freight");
});

test("the mapping: the notes by the flags of the reader", () => {
  const P = { company: "Acme", title: "Analyst", req: "", reqUnlabelled: false, cutCompany: false, cutTitle: false, titleShortened: false, titleBroken: false };
  const notes = (o, kio = null) => boxesOf({ ...P, ...o }, kio).notes;
  assert.deepEqual(notes({}), { company: null, query: null, req: null });
  assert.equal(notes({ titleShortened: true }).query, 2, "a shortened title: this looks cut off");
  assert.equal(notes({ cutTitle: true }).query, 2);
  assert.equal(notes({ cutCompany: true }).company, 2);
  assert.equal(notes({ cutCompany: true }).query, null);
  assert.equal(notes({ req: "R12345", reqUnlabelled: true }).req, 3);
  assert.equal(notes({ req: "48213", reqUnlabelled: false }).req, null, "a labelled req number has no note");
  assert.equal(notes({ title: null, titleBroken: true }).query, 4, "a broken word: sentence 4, the box empty");
  assert.equal(boxesOf({ ...P, title: null, titleBroken: true }, null).fill.query, "");
  assert.equal(notes({ title: null }).query, 5, "no title but a company: not found");
  assert.equal(notes({ company: null }).company, 5, "no company but a title: not found");
  assert.equal(notes({ company: null, title: null, req: "4471" }).company, 5);
  assert.deepEqual(notes({ title: null, titleShortened: true, titleBroken: true }), { company: null, query: 4, req: null });
  // a KIO ID takes the KIO or title box, the company stays, no req number goes with it, no 'not found' under the title
  const k = boxesOf({ ...P, req: "4471", title: "Analyst" }, "KIO-A5R8-C2H9-M4V4");
  assert.deepEqual(k.fill, { company: "Acme", query: "KIO-A5R8-C2H9-M4V4", req: "" });
  assert.deepEqual(boxesOf({ ...P, company: null, title: null }, "KIO-A5R8-C2H9-M4V4").notes, { company: null, query: null, req: null }, "the company is optional with a KIO ID");
  assert.deepEqual(cardBoxes({ ...P, req: "R12345", reqUnlabelled: true }).fill, { company: "Acme", query: "Analyst", req: "R12345" });
});

test("the mapping: one card, several cards, nothing", () => {
  const one = readingOf(A);
  assert.equal(one.state, "read"); assert.deepEqual(one.cards, []); assert.equal(one.boxes.fill.company, "Contoso Freight");
  const two = readingOf(A + "\n" + B);
  assert.equal(two.state, "read"); assert.equal(two.cards.length, 2);
  assert.equal(two.boxes.fill.company, two.cards[0].company, "the first complete card fills the boxes");
  assert.equal(two.boxes.fill.query, two.cards[0].title);
  const cutThird = readingOf(A + "\n" + B + "\nWarehouse Supervisor\nHarbor Light Foods");
  assert.equal(cutThird.cards.length, 2, "a card cut by the bottom edge is never listed");
  assert.ok(!cutThird.cards.some((c) => /Warehouse/.test(c.title)));
  const cutEdge = readingOf(A + "\n" + B + "\nWarehouse Supervisor\nHarbor Light Foods\nDallas");   // the third card is cut by the bottom edge: the reader counts it and does not read it
  assert.equal(cutEdge.cards.length, 2); assert.ok(!cutEdge.cards.some((c) => /Warehouse|Harbor/.test(c.title + c.company)));
  assert.equal(readingOf("We are hiring a Senior Analyst at Contoso. Apply now.").state, "nothing");
  assert.equal(readingOf("").state, "nothing");
});

test("the readings of tests/phone-readings.js: boxes, notes and the other openings, as written", () => {
  assert.ok(READINGS.filter((r) => r.kind === "invented").length >= 6 && READINGS.filter((r) => r.kind === "apple").length >= 4);
  for (const r of READINGS) {
    const got = readFragment("#x=" + enc(r.text));
    assert.equal(got.refused, false, r.id);
    assert.equal(got.state, r.expect.state, r.id + " state");
    assert.equal(got.cut, r.expect.cut, r.id + " cut");
    assert.equal(got.boxes ? got.boxes.fill.company : "", r.expect.company, r.id + " company");
    assert.equal(got.boxes ? got.boxes.fill.query : "", r.expect.query, r.id + " query");
    assert.equal(got.boxes ? got.boxes.fill.req : "", r.expect.req, r.id + " req");
    assert.deepEqual(got.boxes ? got.boxes.notes : { company: null, query: null, req: null }, r.expect.notes, r.id + " notes");
    assert.deepEqual(got.cards.slice(1).map((c) => choiceText(c.title, c.company)), r.expect.others, r.id + " others");
    assert.ok(got.cards.length === 0 || got.cards.length >= 2);
  }
});

test("the hook in js/pages/search.js sees an x exactly when the model does", () => {
  const src = fs.readFileSync(path.join(ROOT, "js", "pages", "search.js"), "utf8");
  const m = src.match(/const PHONE_X = (\/.+\/);/);
  assert.ok(m, "search.js has the PHONE_X pattern");
  const re = new RegExp(m[1].slice(1, -1));
  const HASHES = ["", "#", "#x=", "#x=a", "#c=A&x=a", "#c=A&t=B", "#top", "#xx=1", "#x", "#a=1&x=2", "#a=x=1", "#X=1", "#y=1&x", "#y=1&x=", "#c=a%26x%3D1", "#o=m&x=a", "#x=a&x=b", "#=x", "#&x=1", "#c=A#x=1", "x=1"];
  for (const h of HASHES) if (h.startsWith("#") || h === "") assert.equal(re.test(h), parsePhoneFragment(h).x, "hook and model disagree on " + JSON.stringify(h));
  // the hook is only a few lines, loads the module by a dynamic import and keeps the classic prefill for every other address
  assert.ok(/import\("\.\.\/phone-entry\.js/.test(src) && !/^import .*phone-/m.test(src), "the module is loaded by a dynamic import only");
  assert.ok(/else if \(applyFragmentPrefill\(/.test(src), "the classic prefill still runs when there is no x");
});

test("the computer test and the link setting", () => {
  assert.equal(COMPUTER_QUERY, "(hover: hover) and (pointer: fine) and (min-width: 900px)");
  assert.equal(isComputer({ matchMedia: (q) => ({ matches: q === COMPUTER_QUERY }) }), true);
  assert.equal(isComputer({ matchMedia: () => ({ matches: false }) }), false);
  assert.equal(isComputer({}), false, "no matchMedia: the tool is shown");
  assert.equal(isComputer({ matchMedia: () => { throw new Error("x"); } }), false);
  const win = { location: { href: "https://stage.fightghostjobs.com/search.html", origin: "https://stage.fightghostjobs.com" } };
  assert.equal(extensionLink(win, ""), null, "it ships empty: no link");
  assert.equal(extensionLink(win, "   "), null);
  assert.equal(extensionLink(win), null, "the shipped setting gives no link");
  assert.equal(extensionLink(win, "extension.html"), "https://stage.fightghostjobs.com/extension.html");
  assert.equal(extensionLink(win, "https://stage.fightghostjobs.com/extension.html"), "https://stage.fightghostjobs.com/extension.html");
  for (const bad of ["https://www.fightghostjobs.com/extension.html", "https://evil.example.invalid/x", "//evil.example.invalid/x", "javascript:alert(1)", "data:text/html,x", "http://stage.fightghostjobs.com.evil.invalid/x", 5, null]) assert.equal(extensionLink(win, bad), null, "an address that is not on this site: " + bad);
});

// the sample readings of the extension at its tag (when the extension repository is present): nothing may throw, and every sample with a plain company and title is mapped into the boxes
test("the extension's own sample readings read through the page's model (when the extension repository is present)", async () => {
  const EXT = process.env.FGJ_EXTENSION_REPO || path.resolve(ROOT, "..", "fightghostjobs", "extension");
  if (!fs.existsSync(EXT)) { console.log("EXTENSION SAMPLES NOT RUN: the extension repository is not at " + EXT); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-ib-ext-"));
  try {
    fs.mkdirSync(path.join(dir, "tests"), { recursive: true }); fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}');
    for (const f of ["tests/mobile-reader-samples.js", "tests/mobile-reader-apple-samples.js", "tests/mobile-reader-apple2-samples.js", "kio.js"]) {
      const r = spawnSync("git", ["-C", EXT, "show", "reader-v1:" + f], { encoding: "utf8", maxBuffer: 20e6 });
      assert.equal(r.status, 0, "git show " + f); fs.writeFileSync(path.join(dir, f), r.stdout);
    }
    const [a, b, c] = await Promise.all(["mobile-reader-samples", "mobile-reader-apple-samples", "mobile-reader-apple2-samples"].map((n) => import(pathToFileURL(path.join(dir, "tests", n + ".js")).href)));
    const all = [...a.SAMPLES, ...b.APPLE, ...c.APPLE2]; let checked = 0, mapped = 0;
    for (const s of all) {
      const r = readFragment("#x=" + enc(s.text));
      assert.equal(r.refused, false, s.name);
      checked++;
      const w = s.want;
      // a box the reader leaves empty is never wrong (the person types it, and the page says so); a box with a value must hold exactly the company and the title a person reads
      if (w && w.company && w.title && !w.kio && !s.cards && r.state === "read" && !r.cut) {
        if (r.boxes.fill.company !== "") assert.equal(r.boxes.fill.company, w.company, s.name);
        if (r.boxes.fill.query !== "") { assert.equal(r.boxes.fill.query, w.title, s.name); mapped++; }
      }
    }
    console.log("EXTENSION SAMPLES RAN: " + checked + " readings through the page model, " + mapped + " with an exact company and title compared");
    assert.ok(checked >= 100 && mapped >= 60);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
