// phone-entry-ox.mutants.test.js (prompt OX, November 18, 2026) - planted breakages for the reader-v6 rows of tests/phone-entry-ox.unit.test.js. Each breakage is made on a COPY of js/ in the temp folder, the unit test file is run there and must FAIL; the unbroken copy must PASS (so a failure is the breakage's, not the copy's).
// Nothing in the repository is changed. No browser. Run: node --test tests/phone-entry-ox.mutants.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PM = "js/phone-model.js", RD = "js/mobile/mobile-reader/reader.js";
const OLD_READER_COMMIT = "e246cf5";   // prompt OV commit (pushed to stage main): its reader copy is reader-v5 (1927111); prompt OX replaced it with reader-v6 (6d4df0a)
const oldReader = () => {
  const r = spawnSync("git", ["-C", ROOT, "show", OLD_READER_COMMIT + ":" + RD], { encoding: "utf8", maxBuffer: 20e6 });
  return r.status === 0 ? r.stdout : null;
};

const run = (edits) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-ox-mut-"));
  try {
    fs.cpSync(path.join(ROOT, "js"), path.join(dir, "js"), { recursive: true });
    fs.mkdirSync(path.join(dir, "tests"));
    for (const f of ["tests/phone-entry-ox.unit.test.js", "tests/phone-readings-ox.js", "tests/phone-readings-ot.js"]) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
    fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}');
    for (const [file, from, to] of edits) {
      const p = path.join(dir, file), s = fs.readFileSync(p, "utf8");
      if (from !== null && !s.includes(from)) throw new Error("the anchor of the breakage is not in " + file + ": " + String(from).slice(0, 80));
      fs.writeFileSync(p, from === null ? to : s.replace(from, to));
    }
    const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;   // a nested node --test run inside a test reports success to its parent unless this is removed
    const r = spawnSync(process.execPath, ["--test", "tests/phone-entry-ox.unit.test.js"], { cwd: dir, encoding: "utf8", maxBuffer: 20e6, env });
    return { status: r.status, out: String(r.stdout) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
const has = (out, re) => re.test(out);

test("the unbroken copy passes (so a failure below is the breakage's)", () => {
  const r = run([]);
  assert.equal(r.status, 0, r.out.slice(-600));
});

test("breakage 1: the reader-v5 copy put back: the real KIO card, its variants and its address fail; the controls and OX05 do not", () => {
  const old = oldReader();
  assert.ok(old, "git show " + OLD_READER_COMMIT + ":" + RD + " must work in the repository (that commit must stay in the history)");
  const r = run([[RD, null, old]]);
  assert.notEqual(r.status, 0, "the reader-v5 copy must be caught");
  assert.ok(has(r.out, /^✖ OX01 /m) && has(r.out, /^✖ the real KIO address/m), "the real KIO row and address fail");
  assert.ok(!has(r.out, /^✖ OX3\d /m) && !has(r.out, /^✖ OT13 /m) && !has(r.out, /^✖ OT20 /m) && !has(r.out, /^✖ OT30/m), "the controls still pass");
});

test("breakage 2: the page does not fill the company box when an ID is present: the KIO rows fail", () => {
  const r = run([[PM, 'fill: { company, query: kio, req: "" }', 'fill: { company: "", query: kio, req: "" }']]);
  assert.notEqual(r.status, 0);
  assert.ok(has(r.out, /^✖ OX01 /m) && has(r.out, /^✖ the real KIO address/m) && !has(r.out, /^✖ OX30 /m), "the KIO rows fail, the Kiosk control does not");
});

test("breakage 3: the ID is left inside the company box too: the KIO rows fail", () => {
  const r = run([[PM, 'fill: { company, query: kio, req: "" }', 'fill: { company: company + " " + kio, query: kio, req: "" }']]);
  assert.notEqual(r.status, 0);
  assert.ok(has(r.out, /^✖ OX01 /m) && has(r.out, /^✖ the real KIO address/m) && !has(r.out, /^✖ OX30 /m), "the KIO rows fail, the Kiosk control does not");
});

test("breakage 4: the title is wrongly held when an ID is present (a title field in the boxes): the KIO rows fail", () => {
  const r = run([[PM, 'fill: { company, query: kio, req: "" }', 'fill: { company, query: kio, req: "", title }']]);
  assert.notEqual(r.status, 0);
  assert.ok(has(r.out, /^✖ OX01 /m) && !has(r.out, /^✖ OX30 /m), "the KIO rows fail, the Kiosk control does not");
});
