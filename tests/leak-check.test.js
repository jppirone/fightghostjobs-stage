// leak-check.test.js - the browser helper (tests/cdp-tabs.js) and the leak check (tests/leak-check.js), in a real browser. Prompt BB2, October 10, 2026.
//
// Why: the suite started a browser per test file and left profile folders (and, when a step hung or a process was killed, browsers) behind. The helper now closes its browser on a bound, removes its folder, and a leak check at the
// end of the suite counts what carries the test marker. This file proves the pieces:
//   main tests: a closed browser leaves no process and no folder; a start that fails half way leaves nothing; a close that hangs is stopped on its bound.
//   negative controls: a browser that is NOT closed makes the leak check fire (and the check is clean again after it is stopped); a test process that ended hard leaves its profile folder, which the check finds and the reap removes;
//   a step that never ends is stopped by the time limit and takes its browser with it.
// Everything this file starts is started by it and identified by its marker folder; nothing is stopped by program name.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { findLeaks, formatLeak, leakCount, markerProcesses, parseMarker, pidAlive, listMarkerFolders, reapOrphans } from "./browser-clean.js";
import { runStep } from "./step-runner.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PROBE = path.join(here, "leak-probe.js");
const CHECK = path.join(here, "leak-check.js");
const withoutCtx = () => { const e = { ...process.env }; delete e.NODE_TEST_CONTEXT; return e; };
const usedBy = (dirName) => markerProcesses().filter((p) => p.folder === dirName);
const infoFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fgj-leakinfo-")), "info.json");
const readInfo = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const dropInfo = (f) => { try { fs.rmSync(path.dirname(f), { recursive: true, force: true }); } catch { /* best effort, outside the marker */ } };
function runProbe(mode) {
  const f = infoFile();
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [PROBE, mode, f], { env: withoutCtx(), stdio: "ignore", windowsHide: true });
    c.on("close", (code) => resolve({ code, file: f }));
  });
}
async function withPatchedFetch(patch, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = patch(real);
  try { return await fn(); } finally { globalThis.fetch = real; }
}

test("a browser that is closed leaves no process and no profile folder, and its folder carries the marker", { timeout: 120000 }, async () => {
  const since = Date.now() - 1;
  const b = await launchBrowser();
  const name = path.basename(b.dir);
  const m = parseMarker(name);
  assert.ok(m && m.pid === process.pid && m.stamp >= since, "the folder name is fgj-test-<this pid>-<time>-<random>: " + name);
  assert.ok(fs.existsSync(b.dir), "the profile folder exists while the browser is open");
  assert.ok(usedBy(name).length > 0, "while it is open, the browser's command line carries the folder name");
  const tab = await b.newTab();
  await tab.goto("about:blank");
  await b.close();
  assert.ok(!fs.existsSync(b.dir), "the profile folder is removed by close()");
  assert.deepEqual(usedBy(name), [], "no process carries the folder name after close()");
  assert.equal(leakCount(findLeaks({ since, deadOwners: false, includeOwners: [process.pid] })), 0, "the leak check finds nothing");
  await b.close();   // closing twice is harmless
});

test("a start that fails half way leaves no process and no folder (nothing starts; the browser starts but its page list cannot be read)", { timeout: 180000 }, async () => {
  const since = Date.now() - 1;
  const before = new Set(listMarkerFolders());
  // 1) the program starts and ends at once (it is not a browser): no DevTools port ever appears
  const saved = process.env.FGJ_BROWSER;
  process.env.FGJ_BROWSER = process.execPath;
  try { await assert.rejects(launchBrowser(), /browser/); } finally { if (saved === undefined) delete process.env.FGJ_BROWSER; else process.env.FGJ_BROWSER = saved; }
  // 2) a real browser starts, then reading its page list fails
  await withPatchedFetch((real) => (url, opts) => (String(url).endsWith("/json") ? Promise.reject(new Error("forced: the page list cannot be read")) : real(url, opts)), async () => {
    await assert.rejects(launchBrowser(), /forced/);
  });
  const left = listMarkerFolders().filter((n) => !before.has(n));
  assert.deepEqual(left, [], "no marker folder is left by a failed start");
  assert.equal(leakCount(findLeaks({ since, deadOwners: false, includeOwners: [process.pid] })), 0, "no marker process is left by a failed start");
});

test("a close that cannot reach the browser is stopped on its bound: only the recorded pid and its children are stopped, the folder is removed", { timeout: 180000 }, async () => {
  const since = Date.now() - 1;
  const b = await launchBrowser();
  const name = path.basename(b.dir);
  await b.newTab();
  const t0 = Date.now();
  await withPatchedFetch((real) => (url, opts) => (/\/json\/(version|close)/.test(String(url)) ? new Promise(() => {}) : real(url, opts)), async () => { await b.close(); });
  const took = Date.now() - t0;
  assert.ok(took < 25000, "close() finished within its bound (" + took + " ms)");
  assert.ok(!fs.existsSync(b.dir), "the profile folder is removed");
  assert.deepEqual(usedBy(name), [], "no process carries the folder name");
  assert.equal(leakCount(findLeaks({ since, deadOwners: false, includeOwners: [process.pid] })), 0);
});

test("negative controls: a browser the test does not close makes the leak check fire, and the check is clean once it is stopped", { timeout: 180000 }, async () => {
  const since = Date.now() - 1;
  const b = await launchBrowser();                      // started through the helper and NOT closed
  const name = path.basename(b.dir);
  await b.newTab();
  const l = findLeaks({ since, deadOwners: false, includeOwners: [process.pid] });
  assert.ok(l.processes.length >= 1, "the check sees the open browser's processes");
  assert.deepEqual(l.folders, [name], "the check sees its profile folder");
  assert.match(formatLeak(l), /^LEAK: \d+ \(.*\b[0-9]+ .*fgj-test-/, "the LEAK line names the process ids and the folder");
  // the same check as the last step of the suite, as the suite runs it
  const r = spawnSync(process.execPath, [CHECK], { env: { ...withoutCtx(), FGJ_SUITE_START: String(since), FGJ_LEAK_OWNER_PIDS: String(process.pid) }, encoding: "utf8" });
  assert.equal(r.status, 1, "the leak check step FAILS when a browser is left open");
  assert.match(r.stdout, /^LEAK: \d+/m, "and prints the LEAK line");
  // it stopped what it found and removed the folder: a second run is clean
  assert.ok(!fs.existsSync(b.dir), "the leak check removed the folder it reported");
  assert.deepEqual(usedBy(name), [], "and stopped the processes it reported");
  const again = spawnSync(process.execPath, [CHECK], { env: { ...withoutCtx(), FGJ_SUITE_START: String(since), FGJ_LEAK_OWNER_PIDS: String(process.pid) }, encoding: "utf8" });
  assert.equal(again.status, 0, "the leak check is clean now");
  assert.match(again.stdout, /clean/);
  await b.close();
});

test("negative controls: a test process that ended hard leaves its profile folder; the check finds it and the reap removes it", { timeout: 180000 }, async () => {
  const t0 = Date.now() - 1000;
  const run = await runProbe("crash");
  const info = readInfo(run.file);
  try {
    const name = path.basename(info.dir);
    assert.ok(!pidAlive(info.owner), "the probe process is gone");
    assert.ok(fs.existsSync(info.dir), "its profile folder was left (no exit handler can run after a hard end)");
    const l = findLeaks({});
    assert.ok(l.folders.includes(name), "the check finds the folder of a test process that is gone");
    assert.match(formatLeak(l), /^LEAK: \d+/, "and it is reported as a LEAK line");
    const r = reapOrphans({ since: t0 });
    // the browser of a test process that ended hard goes with it within seconds (the child is in the process job); the folder is what stays, and the reap removes it and stops anything still carrying it
    assert.ok(r.removed.includes(name), "the reap removed the folder: " + JSON.stringify(r));
    assert.deepEqual(usedBy(name), []);
    assert.ok(!fs.existsSync(info.dir));
  } finally { reapOrphans({ since: t0 }); dropInfo(run.file); }
});

test("negative controls: a step that never ends is stopped by the time limit, and the browser it started goes with it", { timeout: 180000 }, async () => {
  const f = infoFile();
  const r = await runStep([PROBE, "hang", f], { limitMs: 15000, env: withoutCtx() });
  try {
    assert.equal(r.timedOut, true, "the step was stopped by the limit");
    assert.equal(r.status, null);
    assert.ok(r.ms < 60000, "and it took about the limit (" + r.ms + " ms)");
    const info = readInfo(f);
    const name = path.basename(info.dir);
    assert.ok(!pidAlive(info.owner), "the step's process is gone");
    assert.deepEqual(usedBy(name), [], "its browser is gone");
    assert.ok(!fs.existsSync(info.dir), "and its profile folder is removed");
  } finally { dropInfo(f); }
});
