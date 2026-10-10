// leak-probe.js - used only by tests/leak-check.test.js. Starts one browser through the helper, writes {pid, dir, owner} to the file in argv[3], then:
//   mode "crash": ends its own process the hard way (no exit handler runs), as a crash or a killed test process would
//   mode "hang":  never ends (the time limit of tests/step-runner.js has to stop it)
//   mode "close": closes the browser and ends normally
import fs from "node:fs";
import { launchBrowser } from "./cdp-tabs.js";

const [mode, infoFile] = process.argv.slice(2);
const b = await launchBrowser();
await b.newTab();
fs.writeFileSync(infoFile, JSON.stringify({ pid: b.pid, dir: b.dir, owner: process.pid }));
if (mode === "close") { await b.close(); process.exit(0); }
if (mode === "hang") await new Promise(() => {});
process.kill(process.pid, "SIGKILL");
