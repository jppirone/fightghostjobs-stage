// phone-entry-ot.mutants.test.js (prompt OT, November 18, 2026) - planted breakages for the reader-v5 rows (prompt OV) of tests/phone-entry-ot.unit.test.js. Each breakage is made on a COPY of js/ in the temp folder, the unit test file is run there and must FAIL; the unbroken copy must PASS (so a failure is the breakage's, not the copy's).
// Nothing in the repository is changed. No browser. Run: node --test tests/phone-entry-ot.mutants.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PM = "js/phone-model.js", RD = "js/mobile/mobile-reader/reader.js";
const OLD_READER_COMMIT = "14ece24";   // prompt OT commit: its reader copy is reader-v4 (95f6a1c); prompt OV replaced it with reader-v5 (1927111)
const oldReader = () => {
  const r = spawnSync("git", ["-C", ROOT, "show", OLD_READER_COMMIT + ":" + RD], { encoding: "utf8", maxBuffer: 20e6 });
  return r.status === 0 ? r.stdout : null;
};

const run = (edits) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-ot-mut-"));
  try {
    fs.cpSync(path.join(ROOT, "js"), path.join(dir, "js"), { recursive: true });
    fs.mkdirSync(path.join(dir, "tests"));
    for (const f of ["tests/phone-entry-ot.unit.test.js", "tests/phone-readings-ot.js"]) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
    fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}');
    for (const [file, from, to] of edits) {
      const p = path.join(dir, file), s = fs.readFileSync(p, "utf8");
      if (from !== null && !s.includes(from)) throw new Error("the anchor of the breakage is not in " + file + ": " + String(from).slice(0, 80));
      fs.writeFileSync(p, from === null ? to : s.replace(from, to));
    }
    const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;   // a nested node --test run inside a test reports success to its parent unless this is removed
    const r = spawnSync(process.execPath, ["--test", "tests/phone-entry-ot.unit.test.js"], { cwd: dir, encoding: "utf8", maxBuffer: 20e6, env });
    return { status: r.status, out: String(r.stdout) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
const failed = (out) => (out.match(/^✖ OT\d\d/gm) || []).length;

test("the unbroken copy passes (so a failure below is the breakage's)", () => {
  const r = run([]);
  assert.equal(r.status, 0, r.out.slice(-600));
});

test("breakage 1: the reader-v4 copy put back: the real OpenAI row, its variants and its address fail; the real Burtch Works row and address and Slalom do not", () => {
  const old = oldReader();
  assert.ok(old, "git show " + OLD_READER_COMMIT + ":" + RD + " must work in the repository");
  const r = run([[RD, null, old]]);
  assert.notEqual(r.status, 0, "the reader-v4 copy must be caught");
  assert.ok(failed(r.out) >= 15, "at least the real OpenAI row and its 14 variants fail, got " + failed(r.out));
  assert.ok(/^✖ OT20 /m.test(r.out) && /^✖ the real OpenAI address/m.test(r.out), "the real OpenAI row and address fail");
  assert.ok(!/^✖ OT13 /m.test(r.out) && !/^✖ the real Burtch Works address/m.test(r.out) && !/^✖ OT30/m.test(r.out), "the real Burtch Works row and address and Slalom still pass");
});

test("breakage 2: the page drops the reader's flag: the OpenAI rows lose the check line and fail", () => {
  const r = run([[PM, "orderAssumed: p.orderAssumed === true };\n}", "orderAssumed: false };\n}"]]);
  assert.notEqual(r.status, 0);
  assert.ok(/^✖ OT20/m.test(r.out) && !/^✖ OT01 /m.test(r.out), "OT20 fails, the Burtch Works card (no flag) does not");
});

test("breakage 3: the page swaps the company and the title boxes: the Burtch Works rows fail", () => {
  const r = run([[PM, "return { fill: { company, query: title, req }, notes, orderAssumed", "return { fill: { company: title, query: company, req }, notes, orderAssumed"]]);
  assert.notEqual(r.status, 0);
  assert.ok(/^✖ OT01 /m.test(r.out) && /^✖ OT13 /m.test(r.out) && /^✖ OT30/m.test(r.out), "OT01, the real Burtch Works row OT13 and the Slalom row fail");
});

test("breakage 4: the reader no longer corrects Al to AI in a company: the real OpenAI row (company OpenAl) fails, the Burtch Works rows do not", () => {
  const r = run([[RD, "{ company = company.replace(/(?<=", "{ company = company.replace(/(?<=ZZZZZZ"]]);
  assert.notEqual(r.status, 0);
  assert.ok(/^✖ OT20 /m.test(r.out) && /^✖ the real OpenAI address/m.test(r.out), "the real OpenAI row and address fail");
  assert.ok(!/^✖ OT13 /m.test(r.out) && !/^✖ OT30/m.test(r.out), "the real Burtch Works row (no Al in its company) and Slalom still pass");
});
