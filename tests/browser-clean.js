// browser-clean.js - finds, stops and removes the browsers and profile folders the tests start. No dependencies.
// Every browser the tests start has a MARKER in its profile folder name: fgj-test-<pid of the test process>-<start time in ms>-<random>, in the temp directory.
// Only what carries the marker is ever touched, and never by program name:
//   - a process is stopped only by a pid this code recorded when it started it (and its children), or by the pid of a process whose command line names a marker folder whose test process no longer exists;
//   - a folder is removed only when its name carries the marker.
// A folder that cannot be removed is printed, never swallowed.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const MARKER = "fgj-test-";
export const DAY_MS = 24 * 60 * 60 * 1000;
const NAME_RE = /^fgj-test-(\d+)-(\d+)-[A-Za-z0-9]+$/;
const IN_CMD_RE = /fgj-test-\d+-\d+-[A-Za-z0-9]+/;
const WIN = process.platform === "win32";

// the start of every profile folder name this code creates
export const markerPrefix = () => MARKER + process.pid + "-" + Date.now() + "-";
export function parseMarker(name) { const m = NAME_RE.exec(String(name)); return m ? { pid: Number(m[1]), stamp: Number(m[2]) } : null; }
export function listMarkerFolders(tmp = os.tmpdir()) { try { return fs.readdirSync(tmp).filter((n) => NAME_RE.test(n)); } catch { return []; } }
export function pidAlive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return !!(e && e.code === "EPERM"); } }
export function sleepSync(ms) { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* cannot wait: the next try is immediate */ } }

// every chrome or msedge process with its command line: [{ pid, ppid, name, cmd }]. Never throws; [] when the list cannot be read.
export function browserProcesses() {
  try {
    if (WIN) {
      const script = "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe' or Name='msedge.exe'\" | ForEach-Object { '{0}|{1}|{2}|{3}' -f $_.ProcessId, $_.ParentProcessId, $_.Name, $_.CommandLine }";
      const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30000, windowsHide: true });
      return String(r.stdout || "").split(/\r?\n/).filter(Boolean).map((l) => { const p = l.split("|"); return { pid: Number(p[0]), ppid: Number(p[1]), name: p[2], cmd: p.slice(3).join("|") }; }).filter((p) => Number.isInteger(p.pid));
    }
    const r = spawnSync("ps", ["-eo", "pid=,ppid=,comm=,args="], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30000 });
    return String(r.stdout || "").split("\n").map((l) => /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(l)).filter(Boolean).map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), name: m[3], cmd: m[4] })).filter((p) => /chrome|chromium|msedge|edge/i.test(p.name));
  } catch { return []; }
}
// the browser processes that carry a test marker: [{ pid, ppid, name, folder }]
export function markerProcesses(list = browserProcesses()) {
  const out = [];
  for (const p of list) { const m = IN_CMD_RE.exec(p.cmd || ""); if (m) out.push({ pid: p.pid, ppid: p.ppid, name: p.name, folder: m[0] }); }
  return out;
}

// stops ONE pid and the processes below it. Never by program name.
export function stopPidTree(pid) {
  if (!Number.isInteger(pid) || pid <= 4) return false;
  try {
    if (WIN) return spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { encoding: "utf8", timeout: 15000, windowsHide: true }).status === 0;
    process.kill(pid, "SIGKILL"); return true;
  } catch { return false; }
}

// removes a profile folder, trying again for up to `ms` (the browser lets go of its files a moment after it exits). Returns null when it is gone, or the reason it is not.
function attempt(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); return fs.existsSync(dir) ? "still there" : null; } catch (e) { return String((e && e.code) || e); } }
export function removeFolderSync(dir, { ms = 8000, step = 250 } = {}) {
  const until = Date.now() + ms; let err;
  for (;;) { err = attempt(dir); if (!err) return null; if (Date.now() >= until) return err; sleepSync(step); }
}
export async function removeFolder(dir, { ms = 8000, step = 250 } = {}) {
  const until = Date.now() + ms; let err;
  for (;;) { err = attempt(dir); if (!err) return null; if (Date.now() >= until) return err; await new Promise((r) => setTimeout(r, step)); }
}

// What is left: marker processes and marker folders whose test process is gone (its pid is not alive; all of them when deadOwners, else only those made since `since` ms), plus
// those made since `since` by a test process that is still alive and is listed in includeOwners. With since = Infinity (the default) only what a dead test process left is reported.
export function findLeaks({ since = Infinity, list, deadOwners = true, includeOwners = [] } = {}) {
  const inScope = (name) => {
    const m = parseMarker(name); if (!m) return false;
    const gone = !pidAlive(m.pid);
    if (gone && (deadOwners || m.stamp >= since)) return true;   // its test process is gone: nothing can close it any more
    return m.stamp >= since && includeOwners.includes(m.pid);       // a test process that is still alive is only ever included on request (never another session's browser)
  };
  const processes = markerProcesses(list).filter((p) => inScope(p.folder));
  const folders = listMarkerFolders().filter(inScope);
  return { processes, folders };
}
export function leakCount(l) { return l.processes.length + l.folders.length; }
export function formatLeak(l) {
  return "LEAK: " + leakCount(l) + " (" + l.processes.length + " browser process(es): " + (l.processes.map((p) => p.pid + " " + p.name + " in " + p.folder).join("; ") || "none") + "; " + l.folders.length + " folder(s): " + (l.folders.join(", ") || "none") + ")";
}
// stops those processes and removes those folders (only ever items that carry the marker). Returns { stopped, removed, notRemoved }.
export function cleanLeaks(l) {
  const stopped = [], removed = [], notRemoved = [];
  for (const p of l.processes) if (stopPidTree(p.pid)) stopped.push(p.pid);
  const tmp = os.tmpdir();
  for (const f of l.folders) { if (!NAME_RE.test(f)) continue; const err = removeFolderSync(path.join(tmp, f), { ms: 6000 }); if (err) { notRemoved.push(f + " (" + err + ")"); console.error("browser cleanup: could not remove " + path.join(tmp, f) + " (" + err + ")"); } else removed.push(f); }
  return { stopped, removed, notRemoved };
}

// A step or a test process ended in a way that left no time to clean (stopped by the time limit, crashed): stops the browsers and removes the folders of test processes that are gone and started at or after `since`.
export function reapOrphans({ since = 0 } = {}) {
  const l = findLeaks({ since: Infinity });   // only dead owners
  const scoped = { processes: l.processes.filter((p) => parseMarker(p.folder).stamp >= since), folders: l.folders.filter((f) => parseMarker(f).stamp >= since) };
  const r = cleanLeaks(scoped);
  return { found: leakCount(scoped), ...r };
}

// Start of a suite: stops browsers of test processes that no longer exist, and removes marker folders that no running process uses and that are older than a day.
export function sweepStale({ olderThanMs = DAY_MS, now = Date.now() } = {}) {
  const procs = markerProcesses();
  const stopped = [], removed = [], kept = [], notRemoved = [];
  for (const p of procs) { const m = parseMarker(p.folder); if (m && !pidAlive(m.pid) && stopPidTree(p.pid)) stopped.push(p.pid); }
  const usedBy = new Set(procs.filter((p) => !stopped.includes(p.pid)).map((p) => p.folder));
  const tmp = os.tmpdir();
  for (const f of listMarkerFolders()) {
    const m = parseMarker(f);
    if (usedBy.has(f) || now - m.stamp <= olderThanMs) { kept.push(f); continue; }
    const err = removeFolderSync(path.join(tmp, f), { ms: 4000 });
    if (err) { notRemoved.push(f + " (" + err + ")"); console.error("browser cleanup: could not remove " + path.join(tmp, f) + " (" + err + ")"); } else removed.push(f);
  }
  return { stopped, removed, kept, notRemoved };
}
