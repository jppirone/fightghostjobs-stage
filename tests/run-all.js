// run-all.js - everything that can be checked without a network or a secret. Run: node tests/run-all.js   (or: npm test)
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const steps = [
  ["unit + API tests", [path.join(here, "unit.test.js"), path.join(here, "api.test.js"), path.join(here, "locations.test.js"), path.join(here, "dashboard.test.js"), path.join(here, "edit.test.js"), path.join(here, "schedule.test.js"), path.join(here, "roster.test.js"), path.join(here, "ai-notes.test.js"), path.join(here, "comments.test.js"), path.join(here, "analytics.test.js"), path.join(here, "contest.test.js"), path.join(here, "linkpanel.test.js"), path.join(here, "unsaved.test.js"), path.join(here, "account-menu.test.js"), path.join(here, "signin-handoff.test.js"), path.join(here, "scroll-lock.test.js")], true],
  ["header layout in a real browser (phone widths; needs Chrome or Edge)", [path.join(here, "header-layout.test.js")], true],
  ["phone layout of every page in a real browser (needs Chrome or Edge)", [path.join(here, "phone-layout.test.js")], true],
  ["sign-in link in a new tab, two real tabs (needs Chrome or Edge)", [path.join(here, "signin-tabs.test.js")], true],
  ["comments page: Report a wrong link only for a posting with links (real browser)", [path.join(here, "comments-report.test.js")], true],
  ["search page: the field lines, the focus ring and the scroll lock of the details window (real browser)", [path.join(here, "search-ui.test.js")], true],
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
