// source-capture.mutants.test.js - negative controls for the source of the Shortcut address (prompt JD, November 7, 2026): each deliberate defect below is put into a COPY of the page code (js\, search.html) and the unit test
// tests/source-capture.unit.test.js must then FAIL. A defect that leaves it passing is MISSED and this file fails. A copy with no defect must pass, and a defect planted at nothing (an anchor that is not there) is itself an error.
// Nothing here touches the real files. The browser scenarios have their own planted breakages in tests/source-field.test.js. Run: node --test tests/source-capture.mutants.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UNIT = "source-capture.unit.test.js";
// [label, file, text to find (must occur once), text instead]
const MUTANTS = [
  ["the source is put inside the text again", "js/phone-model.js", "return { x: true, refused: false, text, source };", "return { x: true, refused: false, text: text + (source ? \" \" + source : \"\"), source };"],
  ["the length limit of the source is dropped", "js/source-clean.js", "return chars.length <= SOURCE_MAX ? out : chars.slice(0, SOURCE_MAX).join(\"\").trim();", "return out;"],
  ["the limit is 200 characters", "js/source-clean.js", "export const SOURCE_MAX = 120;", "export const SOURCE_MAX = 200;"],
  ["s is a refusing key", "js/phone-model.js", "const CLASSIC_KEYS = new Set([\"c\", \"p\", \"r\", \"t\", \"k\", \"o\", \"h\"]);", "const CLASSIC_KEYS = new Set([\"c\", \"p\", \"r\", \"t\", \"k\", \"o\", \"h\", \"s\"]);"],
  ["a repeated s is accepted (the first one is taken)", "js/phone-model.js", "if (sCount === 1) { try {", "if (sCount >= 1) { try {"],
  ["a bad percent sequence in s refuses the whole address", "js/phone-model.js", "try { source = limitSource(decodeURIComponent(sValue)); } catch { source = \"\"; }", "try { source = limitSource(decodeURIComponent(sValue)); } catch { return { x: true, refused: true, text: \"\", source: \"\" }; }"],
  ["a bad percent sequence in s keeps the raw text of s", "js/phone-model.js", "try { source = limitSource(decodeURIComponent(sValue)); } catch { source = \"\"; }", "try { source = limitSource(decodeURIComponent(sValue)); } catch { source = sValue; }"],
  ["s alone starts the phone entry", "js/phone-model.js", "if (xCount === 0) return { x: false, refused: false, text: \"\", source: \"\" };", "if (xCount === 0 && sCount === 0) return { x: false, refused: false, text: \"\", source: \"\" };"],
  ["a refused address keeps its source", "js/phone-model.js", "if (old || xCount > 1 || raw.length > MAX_FRAGMENT || pieces.length > MAX_PARTS) return { x: true, refused: true, text: \"\", source: \"\" };", "if (old || xCount > 1 || raw.length > MAX_FRAGMENT || pieces.length > MAX_PARTS) return { x: true, refused: true, text: \"\", source: sValue };"],
  ["the source is not part of what readFragment returns", "js/phone-model.js", "cut: lim.cut, source: p.source, ...readingOf", "cut: lim.cut, ...readingOf"],
  ["control characters stay in the source", "js/source-clean.js", "    if (c < 32 || (c >= 127 && c <= 159)) continue;\n", ""],
  ["line breaks stay in the source", "js/source-clean.js", "if (c === 9 || c === 10 || c === 11 || c === 12 || c === 13 || c === 0x2028 || c === 0x2029 || c === 0x85) { out += \" \"; continue; }", ""],
  ["runs of white space are not collapsed", "js/source-clean.js", "out = out.replace(/\\s+/g, \" \").trim();", "out = out.trim();"],
  ["the cut can split a pair of characters", "js/source-clean.js", "const chars = Array.from(out);\n  return chars.length <= SOURCE_MAX ? out : chars.slice(0, SOURCE_MAX).join(\"\").trim();", "return out.length <= SOURCE_MAX ? out : out.slice(0, SOURCE_MAX).trim();"],
  ["the saved search does not carry the source", "js/signin-handoff.js", "...originOfSaved(p.origin, p.host), ...sourceOfSaved(p.source) }, now);", "...originOfSaved(p.origin, p.host) }, now);"],
  ["the saved search brings the source back without the limit", "js/signin-handoff.js", "...originOfSaved(v.origin, v.host), ...sourceOfSaved(v.source) } : null;", "...originOfSaved(v.origin, v.host), ...(typeof v.source === \"string\" ? { source: v.source } : {}) } : null;"],
  ["the phone entry puts the source in with innerHTML", "js/phone-entry.js", "if (sourceEl) { sourceEl.value = typeof parsed.source === \"string\" ? parsed.source : \"\"; }", "if (sourceEl) { sourceEl.parentElement.insertAdjacentHTML('beforeend', parsed.source); }"],
  ["the phone entry stores the source", "js/phone-entry.js", "if (sourceEl) { sourceEl.value = typeof parsed.source === \"string\" ? parsed.source : \"\"; }", "if (sourceEl) { sourceEl.value = parsed.source; localStorage.setItem('s', parsed.source); }"],
  ["a pinned sentence of the phone entry is reworded", "js/phone-text.js", "We never receive your screenshot.", "We never get your screenshot."],
  ["the source wording is added to the pinned phone file", "js/phone-text.js", "export const EXTENSION_LINK_TEXT", "export const SOURCE_NOTE = \"where you found the job\";\nexport const EXTENSION_LINK_TEXT"],
  ["a dash in the employer sentence", "js/source-text.js", "Employers see this exactly as you type it.", "Employers see this — exactly as you type it."],
  ["the instruction loses the email example", "js/source-text.js", " or email (ex. jobs@linkedin.com)", ""],
  ["the long instruction comes back on the page (prompt JK)", "search.html", "Site (ex. LinkedIn.com or LinkedIn) or email (ex. jobs@linkedin.com)", "Type a site name or domain, such as LinkedIn.com (LinkedIn alone is fine), or the address of the email the job came from, such as jobs@linkedin.com."],
  ["the employer sentence is put back on the form (prompt JK)", "search.html", "<div id=\"sourceHint\"", "<div class=\"field-hint\">Employers see this exactly as you type it.</div><div id=\"sourceHint\""],
  ["the word Optional comes after the label (prompt JK)", "search.html", "<span class=\"srch-opt\">Optional</span> Where you found this job", "Where you found this job <span class=\"srch-opt\">Optional</span>"],
  ["the optional block is moved after the Search button (prompt JK)", "search.html", "<div id=\"sourceBlock\" class=\"srch-source\">", "<button type=\"submit\" id=\"searchBtn\" class=\"btn btn-dark\">Search</button><div id=\"sourceBlock\" class=\"srch-source\">"],
  ["the optional input names a form owner again (prompt JK)", "search.html", "class=\"srch-input srch-source-input\" type=\"text\"", "form=\"searchForm\" class=\"srch-input srch-source-input\" type=\"text\""],
  ["the label has no for attribute", "search.html", "<label for=\"sourceq\" class=\"srch-source-label\">", "<label class=\"srch-source-label\">"],
  ["the input has no limit", "search.html", " maxlength=\"120\" autocomplete=\"off\" autocapitalize=\"none\"", " autocomplete=\"off\" autocapitalize=\"none\""],
  ["the input is a placeholder instead of a label text", "search.html", "class=\"srch-input srch-source-input\" type=\"text\"", "class=\"srch-input srch-source-input\" placeholder=\"Where you found this job\" type=\"text\""],
];

const childEnv = () => { const e = { ...process.env }; delete e.NODE_TEST_CONTEXT; return e; };
function copy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-jdsrc-mut-"));
  fs.cpSync(path.join(ROOT, "js"), path.join(dir, "js"), { recursive: true });
  fs.mkdirSync(path.join(dir, "tests"));
  for (const f of [UNIT, "copy-reader.js", "phone-readings.js"]) if (fs.existsSync(path.join(ROOT, "tests", f))) fs.copyFileSync(path.join(ROOT, "tests", f), path.join(dir, "tests", f));
  fs.copyFileSync(path.join(ROOT, "search.html"), path.join(dir, "search.html"));
  fs.copyFileSync(path.join(ROOT, "package.json"), path.join(dir, "package.json"));
  return dir;
}
const run = (dir) => spawnSync(process.execPath, ["--test", path.join(dir, "tests", UNIT)], { encoding: "utf8", env: childEnv() });

test("the unmodified copy passes the unit test (so a failure below is the defect)", () => {
  const dir = copy();
  try { const r = run(dir); assert.equal(r.status, 0, r.stdout.slice(-1500)); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a defect planted at nothing is an error: the anchor must be in the file exactly once", () => {
  const dir = copy();
  try {
    const p = path.join(dir, "js", "phone-model.js"), src = fs.readFileSync(p, "utf8");
    assert.equal(src.split("this text is nowhere in the file").length - 1, 0);
    assert.equal(run(dir).status, 0, "an untouched copy stays clean");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

for (const [label, file, from, to] of MUTANTS) {
  test("control: " + label, () => {
    const dir = copy();
    try {
      const p = path.join(dir, ...file.split("/"));
      const src = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
      const n = src.split(from).length - 1;
      assert.equal(n, 1, "the text to damage must be in " + file + " exactly once (found " + n + "): " + from.slice(0, 70));
      const after = src.replace(from, () => to);
      assert.notEqual(after, src, "the defect changes the file");
      fs.writeFileSync(p, after, "utf8");
      const r = run(dir);
      assert.notEqual(r.status, 0, "MISSED: the unit test still passes with this defect");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}
