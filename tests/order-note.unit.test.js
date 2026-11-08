// order-note.unit.test.js (prompt JE, November 8, 2026) - reader-v3 in the stage site and the flag orderAssumed on its way to the page. No browser. Run: node --test tests/order-note.unit.test.js
//   1. the reader files in js/mobile match the manifest of tests/copy-reader.js (reader-v3) and FROM-EXTENSION.txt names the same tag and commit
//   2. through the page's own readFragment, with the fragment built as the Shortcut builds it (encodeURIComponent): the lines named in the prompt give the boxes and the flag the reader gives; the flag is a boolean everywhere,
//      never set for a reading the reader did not flag, never set for a reading with a KIO ID
//   3. the words of the note (js/phone-text.js ORDER_NOTE) and the 13 sentences untouched
//   4. planted breakages, each made on a COPY of js/ in a temporary folder, each must change the file and be caught
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MANIFEST, sha256, EXTENSION_REPO } from "./copy-reader.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const enc = encodeURIComponent;
const NOTE = "Check that the company and the job title are correct, then click Search.";   // John's sentence of November 8, 2026 (prompt JN)
const A = "Senior Logistics Analyst\nContoso Freight\nAustin, TX\n$85K/yr - $110K/yr\nViewed";
const B = "Route Planner\nBluebird Logistics\nDenver, CO (On-site)\nPromoted";
const LI = "S\nOperational Improvement\nConsultant\nSlalom • Boston, MA";
// [name, text, state, company, title, flag]: what the reader gives for each (invented text and the lines named in the prompt only)
const CASES = [
  ["the Indeed pair, a title word in the first line only (position agrees with the word, so the order is not a guess)", "Chief Project Technician\nAxiom", "read", "Axiom", "Chief Project Technician", false],
  ["the same two lines turned round (the title word is in the second line)", "Axiom\nChief Project Technician", "read", "Axiom", "Chief Project Technician", false],
  ["a bracket title over a company (no title word, position alone)", "Customer Success (Remote)\nAxiom", "read", "Axiom", "Customer Success (Remote)", true],
  ["a title and a company with an ampersand", "Quality System Manager\nPratt & Whitney", "read", "Pratt & Whitney", "Quality System Manager", false],
  ["the LinkedIn four lines", LI, "read", "Slalom", "Operational Improvement Consultant", false],
  ["the LinkedIn five lines with the alumni badge", LI + "\n16 school alumni", "read", "Slalom", "Operational Improvement Consultant", false],
  ["two lines with no title word in either (invented)", "Brand Strategy\nOrion Labs", "read", "Orion Labs", "Brand Strategy", true],
  ["two unrelated plain lines (invented)", "Share this job\nReport this job", "read", "Report this job", "Share this job", true],
  ["a normal card with a place line", A, "read", "Contoso Freight", "Senior Logistics Analyst", false],
  ["the header pair stays empty", "Jobs for you\nSee more jobs", "nothing", null, null, null],
];

// everything the tests check, on a root that holds js/ (the real repo or a copy with one defect); returns the problems
async function check(root, tag) {
  const bad = [];
  const mod = await import(pathToFileURL(path.join(root, "js", "phone-model.js")).href + "?t=" + tag);
  const text = await import(pathToFileURL(path.join(root, "js", "phone-text.js")).href + "?t=" + tag);
  for (const [name, t, state, company, title, flag] of CASES) {
    const r = mod.readFragment("#x=" + enc(t));
    if (r.state !== state) { bad.push(name + ": state " + r.state + ", expected " + state); continue; }
    if (state === "nothing") continue;
    if (r.boxes.fill.company !== company || r.boxes.fill.query !== title) bad.push(name + ": boxes " + JSON.stringify(r.boxes.fill));
    if (typeof r.boxes.orderAssumed !== "boolean") bad.push(name + ": the flag is not a boolean");
    if (r.boxes.orderAssumed !== flag) bad.push(name + ": the flag is " + r.boxes.orderAssumed + ", the reader gives " + flag);
  }
  // a list of cards: each card carries its own boolean flag, and the flag of the card that fills the boxes reaches the boxes
  const two = mod.readingOf(A + "\n" + B);
  if (two.cards.length !== 2 || two.cards.some((c) => c.orderAssumed !== false)) bad.push("the list of two cards does not carry a false flag on each card");
  if (two.boxes.orderAssumed !== false) bad.push("the first card of a list gave a flag");
  if (mod.ofCard({ company: "C", title: "T", orderAssumed: true }).orderAssumed !== true) bad.push("a card flagged by the reader loses the flag on the way to the list");
  if (mod.ofCard({ company: "C", title: "T", orderAssumed: "true" }).orderAssumed !== false || mod.ofCard({ company: "C", title: "T" }).orderAssumed !== false) bad.push("a card the reader did not flag is flagged");
  if (mod.cardBoxes(mod.ofCard({ company: "C", title: "T", orderAssumed: true })).orderAssumed !== true) bad.push("the flag of a picked card does not reach its boxes");
  // the boxes: only the reader's true, never with a KIO ID
  const P = { company: "C", title: "T", req: "", reqUnlabelled: false, cutCompany: false, cutTitle: false, titleShortened: false, titleBroken: false };
  if (mod.boxesOf({ ...P, orderAssumed: true }, null).orderAssumed !== true) bad.push("boxesOf drops the flag");
  if (mod.boxesOf({ ...P, orderAssumed: true }, "KIO-A5R8-C2H9-M4V4").orderAssumed !== false) bad.push("a reading with a KIO ID carries the flag");
  for (const v of [false, undefined, null, "true", 1, "yes"]) if (mod.boxesOf({ ...P, orderAssumed: v }, null).orderAssumed !== false) bad.push("boxesOf sets the flag for " + JSON.stringify(v));
  // the words
  if (text.ORDER_NOTE !== NOTE) bad.push("ORDER_NOTE is not the approved starting sentence");
  if (Object.keys(text.SENTENCES).length !== 13) bad.push("the 13 pinned sentences are not 13");
  if (/[–—]|--/.test(text.ORDER_NOTE) || /\b(today|tonight|tomorrow|yesterday)\b/i.test(text.ORDER_NOTE)) bad.push("the note holds a dash or a relative day word");
  // the reader copy equals the manifest
  for (const f of MANIFEST.files) {
    const p = path.join(root, f.to);
    if (!fs.existsSync(p)) { bad.push(f.to + " is missing"); continue; }
    if (sha256(fs.readFileSync(p, "utf8")) !== f.sha256) bad.push(f.to + " is not the file of " + MANIFEST.tag);
  }
  const note = fs.readFileSync(path.join(root, "js", "mobile", "FROM-EXTENSION.txt"), "utf8");
  if (!note.includes("tag: reader-v3\n") || !note.includes("commit: de03a113a57bf7a3de3b02454f1a308f211332ae\n")) bad.push("FROM-EXTENSION.txt does not name reader-v3");
  if (MANIFEST.tag !== "reader-v3" || MANIFEST.commit !== "de03a113a57bf7a3de3b02454f1a308f211332ae" || MANIFEST.files[0].sha256 !== "f33a3fb3f9419ca4863a4b5366b2fc07bda6c88777dc34c90ffbaf83329be0c6") bad.push("the manifest of tests/copy-reader.js is not the manifest of reader-v3");
  return bad;
}

test("reader-v3 and the flag through the page's own readFragment; the note words; the 13 sentences", async () => {
  assert.deepEqual(await check(ROOT, "real"), []);
});

test("the stage copies are the files of the extension at reader-v3 (when the extension repository is present)", () => {
  if (!fs.existsSync(EXTENSION_REPO)) { console.log("EXTENSION REPO NOT PRESENT: the tag was not compared with the extension"); return; }
  for (const f of MANIFEST.files) {
    const r = spawnSync("git", ["-C", EXTENSION_REPO, "show", MANIFEST.tag + ":" + f.from], { encoding: "utf8", maxBuffer: 20e6 });
    assert.equal(r.status, 0, "git show " + f.from);
    assert.equal(r.stdout.replace(/\r/g, ""), fs.readFileSync(path.join(ROOT, f.to), "utf8").replace(/\?v=[0-9a-f]{8}(?=["'`])/g, "").replace(/\r/g, ""), f.to + " differs from the extension at " + MANIFEST.tag);
  }
});

// ---- planted breakages: [label, [file, from, to]...]; each must change the file (the anchor is in it exactly once) and make check() report a problem
const PM = "js/phone-model.js";
const PLANTS = [
  ["the flag is dropped from the boxes", [[PM, "orderAssumed: p.orderAssumed === true };", "orderAssumed: false };"]]],
  ["the flag is always set", [[PM, "orderAssumed: p.orderAssumed === true };", "orderAssumed: true };"]]],
  ["a value that is not true counts as true", [[PM, "orderAssumed: p.orderAssumed === true };", "orderAssumed: !!p.orderAssumed };"]]],
  ["the flag is lost for a single reading", [[PM, "titleBroken: r.titleBroken === true, orderAssumed: r.orderAssumed === true };\n  } else if", "titleBroken: r.titleBroken === true };\n  } else if"]]],
  ["the flag is lost for a listed card", [[PM, "titleBroken: false, orderAssumed: c.orderAssumed === true });", "titleBroken: false });"]]],
  ["a reading with a KIO ID carries the flag", [[PM, "req: null }, orderAssumed: false };", "req: null }, orderAssumed: p.orderAssumed === true };"]]],
  ["the page sets the flag false when the reader said true (single reading)", [[PM, "orderAssumed: r.orderAssumed === true };\n  } else if", "orderAssumed: false };\n  } else if"]]],
  ["the note words are changed", [["js/phone-text.js", "are correct, then click Search.", "are correct."]]],
  ["a pinned sentence is added to the 13", [["js/phone-text.js", "13: \"We never receive", "14: \"x\",\n  13: \"We never receive"]]],
  ["the reader copy is edited by hand", [["js/mobile/mobile-reader/reader.js", "export function readText", "export function readTextX"]]],
  ["the reader copy is the old reader-v1", "OLD_READER"],
];
test("planted breakages: each deliberate defect in the flag, the note words or the reader copy is caught", async () => {
  const missed = [];
  let n = 0;
  for (const [label, edits] of PLANTS) {
    n++;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-je-unit-"));
    try {
      fs.cpSync(path.join(ROOT, "js"), path.join(dir, "js"), { recursive: true });
      fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}');
      if (edits === "OLD_READER") {
        if (!fs.existsSync(EXTENSION_REPO)) { console.log("skipped (no extension repository): " + label); continue; }
        const old = spawnSync("git", ["-C", EXTENSION_REPO, "show", "reader-v1:mobile-reader/reader.js"], { encoding: "utf8", maxBuffer: 20e6 });
        assert.equal(old.status, 0, "git show of the old reader");
        const p = path.join(dir, "js/mobile/mobile-reader/reader.js");
        assert.notEqual(old.stdout, fs.readFileSync(p, "utf8"), "the old reader equals the new one");
        fs.writeFileSync(p, old.stdout.replace(/(\bfrom\s*["'])\.\.\/(extractor|kio)\.js/g, "$1../$2.js"));
      } else {
        for (const [rel, from, to] of edits) {
          const p = path.join(dir, rel), before = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
          const marker = (m) => m;
          const clean = before.replace(/\?v=[0-9a-f]{8}(?=["'`])/g, "");
          assert.equal(clean.split(from).length, 2, "the anchor of '" + label + "' is not in " + rel + " exactly once: " + from.slice(0, 50));
          fs.writeFileSync(p, clean.replace(from, () => to));
        }
      }
      let bad;
      try { bad = await check(dir, "p" + n); } catch (e) { bad = ["threw: " + e.message]; }
      if (!bad.length) missed.push(label); else console.log("caught  " + label + "  (" + bad[0].slice(0, 110) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  console.log("planted breakages run: " + n + ", missed: " + missed.length);
  assert.deepEqual(missed, [], "defects the check missed: " + missed.join("; "));
});
