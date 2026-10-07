// run-all.js - everything that can be checked without a network or a secret. Run: node tests/run-all.js   (or: npm test)
// FULL RUN (the default, no arguments): every step below, exactly as always. After each step it prints how long the step took; at the end the total and the ten slowest tests (the node test runner reports a time per TEST, not per file;
// the step name says which file).
// QUICK MODE, for building only (never evidence for a push): node tests/run-all.js --quick              the unit and API tests plus the static site rules
//                                                            node tests/run-all.js --quick <name> ...    and also the named test file(s), main tests only (its negative controls are skipped), e.g. --quick search-recap
// A quick run does NOT run the negative controls (static or browser) and does NOT run the browser tests unless one is named. Its first and last line say so.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const steps = [
  ["unit + API tests", [path.join(here, "unit.test.js"), path.join(here, "cdp-limit.test.js"), path.join(here, "api.test.js"), path.join(here, "locations.test.js"), path.join(here, "dashboard.test.js"), path.join(here, "edit.test.js"), path.join(here, "schedule.test.js"), path.join(here, "roster.test.js"), path.join(here, "ai-notes.test.js"), path.join(here, "comments.test.js"), path.join(here, "analytics.test.js"), path.join(here, "contest.test.js"), path.join(here, "linkpanel.test.js"), path.join(here, "unsaved.test.js"), path.join(here, "account-menu.test.js"), path.join(here, "signin-handoff.test.js"), path.join(here, "scroll-lock.test.js"), path.join(here, "code-entry-unit.test.js"), path.join(here, "fragment-prefill.unit.test.js")], true],
  ["header layout in a real browser (phone widths; needs Chrome or Edge)", [path.join(here, "header-layout.test.js")], true],
  ["phone layout of every page in a real browser (needs Chrome or Edge)", [path.join(here, "phone-layout.test.js")], true],
  ["sign-in link in a new tab, two real tabs (needs Chrome or Edge)", [path.join(here, "signin-tabs.test.js")], true],
  ["comments page: Report a wrong link only for a posting with links (real browser)", [path.join(here, "comments-report.test.js")], true],
  ["search page: the field lines, the focus ring and the scroll lock of the details window (real browser)", [path.join(here, "search-ui.test.js")], true],
  ["top bar: Tab order equals the drawn order, every width and page (real browser)", [path.join(here, "header-tab-order.test.js")], true],
  ["search page for keyboard and screen readers: one status message, the details window focus handling (real browser)", [path.join(here, "search-a11y.test.js")], true],
  ["edit page: the unsaved bar is announced once each way (real browser)", [path.join(here, "edit-a11y.test.js")], true],
  ["every link and control is at least 24 x 24 CSS pixels (real browser)", [path.join(here, "target-size.test.js")], true],
  ["search recap: boxes emptied, recap between form and results, never the req number or postID, Edit this search (real browser)", [path.join(here, "search-recap.test.js")], true],
  ["landing note: clears on the first real action (real browser)", [path.join(here, "landing-clear.test.js")], true],
  ["search page: the recap scrolls to the top after a successful search (real browser)", [path.join(here, "search-scroll.test.js")], true],
  ["comments switch: shipped on, every comment surface shown; switched off, every comment surface hidden and the report kept (real browser)", [path.join(here, "comments-switch.test.js")], true],
  ["emailed code next to the link: typed in the same tab on the search page and the employer sign-in page (real browser)", [path.join(here, "code-entry.test.js")], true],
  ["search page opened with the company and one other value in the URL fragment (the extension's hand-off): filled, no automatic search, hostile input refused (real browser)", [path.join(here, "fragment-prefill.test.js")], true],
  ["back from Comments or Report a wrong link: the search page comes back as it was, signed out meanwhile clears it, nothing new is stored (real browser)", [path.join(here, "back-restore.test.js")], true],
  ["search engines: every page and robots.txt keep them out on stage, and the tool that switches production on (no browser)", [path.join(here, "indexing.test.js")], true],
  ["static site rules", [path.join(here, "site-check.js")], false],
  ["static rules: negative controls", [path.join(here, "site-check.controls.js")], false],
];
const QUICK_BANNER = "QUICK RUN, NOT A FULL RUN, NOT EVIDENCE FOR A PUSH";
const args = process.argv.slice(2), quick = args[0] === "--quick";
let list = steps;
if (quick) {
  console.log(QUICK_BANNER);
  list = [steps[0], steps.find((x) => x[0] === "static site rules")];
  for (const a of args.slice(1)) {
    const base = a.replace(/\.js$/, "").replace(/\.test$/, "");
    const file = path.join(here, base + ".test.js");
    if (!fs.existsSync(file)) { console.log("quick mode: no test file tests/" + base + ".test.js"); console.log(QUICK_BANNER); process.exit(2); }
    list.push(["quick: " + base + " (main tests only; its negative controls skipped)", [file], true, true]);
  }
}
const fmt = (ms) => { const s = ms / 1000; return s < 120 ? s.toFixed(1) + " s" : Math.floor(s / 60) + " min " + String(Math.round(s % 60)).padStart(2, "0") + " s"; };
const t00 = Date.now(), slow = [];
console.log("started " + new Date(t00).toLocaleTimeString());
let failed = 0;
for (const [name, files, isTest, skipControls] of list) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, isTest ? ["--test", ...(skipControls ? ["--test-skip-pattern=negative controls"] : []), ...files] : files, { encoding: "utf8" });
  const took = Date.now() - t0;
  const out = (r.stdout || "") + (r.stderr || "");
  for (const m of out.matchAll(/^[\u2714\u2716] (.+?) \((\d+(?:\.\d+)?)ms\)$/gm)) slow.push([Number(m[2]), name, m[1]]);
  const tail = out.trim().split("\n").filter((l) => /^(\u2139 (tests|pass|fail|cancelled)|site-check|caught|MISSED|DIRTY|clean|FINDING)/.test(l)).slice(-60);
  console.log("== " + name + ": " + (r.status === 0 ? "PASS" : "FAIL") + " (" + fmt(took) + ")");
  if (r.status !== 0 || process.env.VERBOSE) console.log(tail.join("\n"));
  else console.log(tail.filter((l) => /^(\u2139 (tests|pass|fail|cancelled)|site-check)/.test(l)).join("\n"));
  // a failed step also prints what failed (the failing test names and the first assertion or error lines), so the exact message is in the log
  if (r.status !== 0) console.log(out.split("\n").filter((l) => /^\s*(\u2716 |AssertionError|Error|TypeError|ReferenceError|SyntaxError)/.test(l)).slice(0, 30).join("\n"));
  if (r.status !== 0) failed++;
}
const total = Date.now() - t00;
slow.sort((a, b) => b[0] - a[0]);
console.log("TOTAL " + fmt(total) + " (" + (failed ? failed + " step(s) FAILED" : "every step passed") + "); finished " + new Date().toLocaleTimeString());
console.log("TEN SLOWEST TESTS (a time per test; the step name shows the file):");
for (const [ms, step, test] of slow.slice(0, 10)) console.log("  " + fmt(ms).padStart(10) + "  " + test.slice(0, 90) + "  [" + step.slice(0, 50) + "]");
if (quick) console.log(QUICK_BANNER);
process.exit(failed ? 1 : 0);
