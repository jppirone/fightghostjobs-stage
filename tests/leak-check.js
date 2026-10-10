// leak-check.js - the last step of the suite: counts the browser processes that carry the test marker and the marker folders left, after every step has closed what it opened.
//   node tests/leak-check.js                        what any test process that no longer exists left behind
//   FGJ_SUITE_START=<ms> node tests/leak-check.js   only what test processes that no longer exist left behind since that time (tests/run-all.js sets it; older leftovers belong to the sweep at the start of a suite)
//   FGJ_LEAK_OWNER_PIDS=<pid,...>                   also what those test processes, still alive, made since that time (used by tests/leak-check.test.js)
// Clean: prints one line and exits 0. Not clean: prints  LEAK: <count> (...)  with the process ids and folder names, stops those processes and removes those folders (only ever marker items), and exits 1.
import { findLeaks, formatLeak, leakCount, cleanLeaks } from "./browser-clean.js";

const since = process.env.FGJ_SUITE_START ? Number(process.env.FGJ_SUITE_START) : Infinity;
const owners = String(process.env.FGJ_LEAK_OWNER_PIDS || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
const leaks = findLeaks({ since, deadOwners: !process.env.FGJ_SUITE_START, includeOwners: owners });
if (leakCount(leaks) === 0) {
  console.log("browser leak check: clean (no browser process and no profile folder carries the test marker)");
  process.exit(0);
}
console.log(formatLeak(leaks));
const r = cleanLeaks(leaks);
console.log("browser leak check: stopped " + r.stopped.length + " process(es), removed " + r.removed.length + " folder(s)" + (r.notRemoved.length ? "; could not remove: " + r.notRemoved.join(", ") : ""));
process.exit(1);
