// run-all.js - everything that can be checked without a network or a secret. Run: node tests/run-all.js   (or: npm test)
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const steps = [
  ["unit + API tests", [path.join(here, "unit.test.js"), path.join(here, "api.test.js"), path.join(here, "locations.test.js"), path.join(here, "dashboard.test.js"), path.join(here, "edit.test.js"), path.join(here, "schedule.test.js"), path.join(here, "roster.test.js"), path.join(here, "ai-notes.test.js"), path.join(here, "comments.test.js")], true],
  ["static site rules", [path.join(here, "site-check.js")], false],
  ["static rules: negative controls", [path.join(here, "site-check.controls.js")], false],
];
let failed = 0;
for (const [name, files, isTest] of steps) {
  const r = spawnSync(process.execPath, isTest ? ["--test", ...files] : files, { encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  const tail = out.trim().split("\n").filter((l) => /^(ℹ (tests|pass|fail)|site-check|caught|MISSED|DIRTY|clean|FINDING)/.test(l)).slice(-60);
  console.log("== " + name + ": " + (r.status === 0 ? "PASS" : "FAIL"));
  if (r.status !== 0 || process.env.VERBOSE) console.log(tail.join("\n"));
  else console.log(tail.filter((l) => /^(ℹ (tests|pass|fail)|site-check)/.test(l)).join("\n"));
  if (r.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
