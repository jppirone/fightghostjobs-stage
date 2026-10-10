// step-runner.js - runs ONE step of the suite (a node process) with a time limit. Used by tests/run-all.js and by tests/leak-check.test.js.
// When the limit is hit the step is stopped by the pid recorded here, together with the processes below it (its test files and their browsers); then any browser that carries a test marker and whose test process is gone
// is stopped and its profile folder removed. The step is reported as stopped by the time limit, never as passed.
import { spawn } from "node:child_process";
import { stopPidTree, reapOrphans } from "./browser-clean.js";

// args: the arguments for node. Resolves { status, timedOut, out, ms, reaped } (status is null when the limit stopped it). Never rejects.
export function runStep(args, { limitMs = 0, env = {}, cwd = process.cwd() } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let out = "", timedOut = false, timer = null, settled = false;
    const finish = (status, why) => {
      if (settled) return; settled = true; clearTimeout(timer);
      // a step that failed or was stopped may have left a browser behind whose test process is gone
      const reaped = status === 0 && !timedOut ? null : reapOrphans({ since: t0 - 1000 });
      resolve({ status, timedOut, out: out + (why || ""), ms: Date.now() - t0, reaped });
    };
    let child;
    try { child = spawn(process.execPath, args, { env: { ...process.env, ...env }, cwd, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }); } catch (e) { finish(1, "could not start the step: " + e.message); return; }
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d) => { out += d; }); child.stderr.on("data", (d) => { out += d; });
    if (limitMs > 0) timer = setTimeout(() => { timedOut = true; stopPidTree(child.pid); }, limitMs);
    child.on("error", (e) => finish(1, "step process error: " + e.message));
    child.on("close", (code) => finish(timedOut ? null : code));
  });
}
