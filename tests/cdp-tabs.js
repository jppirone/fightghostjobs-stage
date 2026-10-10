// cdp-tabs.js - a headless Chrome or Edge over the DevTools protocol with SEVERAL TABS in one browser profile (shared localStorage, as the tabs of a real browser share it). No dependencies (Node's built-in WebSocket).
//   const b = await launchBrowser();           // one fresh profile; a missing browser THROWS (a failed check, never a skipped one; set FGJ_BROWSER to an executable)
//   const a = await b.newTab();                // a tab: { goto, eval, waitFor, viewport, shot, close }
//   await b.close();
// THE ONLY LAUNCHER: every test that needs a browser goes through launchBrowser (rule S69). It guarantees, for every browser it starts:
//   - the profile folder is named fgj-test-<test process pid>-<time>-<random> (tests/browser-clean.js): the marker, so only our own folders are ever touched;
//   - the process id is recorded the moment the browser is spawned, before anything else can fail, so a start that fails half way is still cleaned up;
//   - close() is bounded: it asks the browser to close (a few seconds), and if the browser does not go, stops only the recorded pid and its children; then it waits for the exit and removes the profile folder with retries,
//     and prints a line when the folder cannot be removed (never silent);
//   - an exit handler and Ctrl+C / terminate handlers clean up a browser that is still open when the test process ends, and a top-level after hook closes whatever a test file left open.
import { spawn } from "node:child_process";
import { after } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { markerPrefix, stopPidTree, removeFolder, removeFolderSync, markerProcesses } from "./browser-clean.js";

const candidates = () => [process.env.FGJ_BROWSER, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);

// A DevTools call that never answers (a page in the back/forward cache is frozen, the browser died) would hang a whole test run, so every call has a time limit. The limit is generous (90 s, a normal call takes well under 1 s;
// FGJ_CDP_TIMEOUT_MS changes it) so a slow machine does not trip it by itself. When it is hit the test FAILS with a message that names the call, it does not hang.
export const CALL_LIMIT_MS = Number(process.env.FGJ_CDP_TIMEOUT_MS) || 90000;
export function withCallLimit(promise, label, ms = CALL_LIMIT_MS) {
  let timer;
  const limit = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("DevTools call '" + label + "' got no answer in " + Math.round(ms / 1000) + " s (the page may be frozen in the back/forward cache, or the browser is gone)")), ms); });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

// How long close() waits: the browser is asked to close (ASK_MS for the request) and has EXIT_MS to exit; after that only the recorded pid and its children are stopped and have STOP_MS to exit.
export const ASK_MS = 4000;
export const EXIT_MS = 3000;
export const STOP_MS = 5000;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("DevTools socket failed")); });
  let seq = 0; const pending = new Map(); const loads = []; const errs = [];
  ws.onmessage = (m) => { const j = JSON.parse(m.data); if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); return; } if (j.method === "Page.loadEventFired") for (const r of loads.splice(0)) r(); if (j.method === "Runtime.exceptionThrown") errs.push(String(j.params.exceptionDetails.exception && j.params.exceptionDetails.exception.description || j.params.exceptionDetails.text).slice(0, 200)); };
  const send = (method, params) => { let id; const p = new Promise((res, rej) => { id = ++seq; pending.set(id, (j) => (j.error ? rej(new Error(method + ": " + j.error.message)) : res(j.result))); ws.send(JSON.stringify({ id, method, params: params || {} })); }); return withCallLimit(p, method + (method === "Runtime.evaluate" && params && params.expression ? " " + String(params.expression).replace(/\s+/g, " ").slice(0, 70) : "")).catch((e) => { pending.delete(id); throw e; }); };
  await send("Page.enable"); await send("Runtime.enable");
  const evalOn = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("page expression failed: " + String(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text).slice(0, 300));
    return r.result ? r.result.value : undefined;
  };
  return {
    id: target.id, send, eval: evalOn, errors: () => errs.slice(), clearErrors: () => { errs.length = 0; },
    // run a script in every document this tab loads from now on, before the page's own scripts
    async onNewDocument(source) { await send("Page.addScriptToEvaluateOnNewDocument", { source }); },
    // make the page count as focused (a headless page is not): :focus and :focus-visible apply to a field that gets focus
    async focusEmulation(on) { await send("Emulation.setFocusEmulationEnabled", { enabled: !!on }); },
    // a real key press (Tab, Escape, Enter; shift for Shift+Tab) delivered to whatever has the focus, the way a keyboard does
    async key(name, { shift = false } = {}) {
      const vk = { Tab: 9, Escape: 27, Enter: 13, " ": 32 }[name], m = shift ? 8 : 0;
      const down = name === "Tab" ? { type: "rawKeyDown" } : { type: "keyDown", text: name === "Enter" ? "\r" : name === " " ? " " : undefined };
      await send("Input.dispatchKeyEvent", { ...down, key: name, code: name === " " ? "Space" : name, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: m });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: name, code: name === " " ? "Space" : name, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: m });
      await new Promise((r) => setTimeout(r, 60));
    },
    // a touch swipe (dy < 0 scrolls the page down) or a mouse wheel, at a point of the window
    async swipe(x, y, dy) { const pt = (type, yy) => send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y: yy }] }); const dir = dy < 0 ? -1 : 1; await pt("touchStart", y); for (let d = 0; d <= Math.abs(dy); d += 20) { await pt("touchMove", y + dir * d); await new Promise((r) => setTimeout(r, 16)); } await pt("touchEnd", y + dy); await new Promise((r) => setTimeout(r, 500)); },
    async wheel(x, y, dy) { await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: dy }); await new Promise((r) => setTimeout(r, 350)); },
    async goto(url, timeoutMs) { const loaded = new Promise((r) => loads.push(r)); await send("Page.navigate", { url }); await Promise.race([loaded, new Promise((r) => setTimeout(r, timeoutMs || 15000))]); },
    async waitFor(expr, ms) { const until = Date.now() + (ms || 8000); while (Date.now() < until) { let v = false; try { v = await evalOn(expr); } catch { v = false; } if (v) return v; await new Promise((r) => setTimeout(r, 120)); } return false; },
    // phone: touch, mobile viewport, device pixel ratio 2 (what the browser's device toolbar sets); otherwise an ordinary window
    async viewport(width, phone, height) {
      await send("Emulation.setDeviceMetricsOverride", phone ? { width, height: height || 667, deviceScaleFactor: 2, mobile: true, screenWidth: width, screenHeight: height || 667 } : { width, height: height || 800, deviceScaleFactor: 1, mobile: false });
      await send("Emulation.setTouchEmulationEnabled", { enabled: !!phone });
    },
    // the whole page (full: true) or a clip
    async shotFull(file, maxHeight) { const m = await send("Page.getLayoutMetrics"); const w = Math.ceil(m.cssContentSize.width), h = Math.min(Math.ceil(m.cssContentSize.height), maxHeight || 4000); const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } }); fs.writeFileSync(file, Buffer.from(r.data, "base64")); },
    async shot(file, clip) { const r = await send("Page.captureScreenshot", Object.assign({ format: "png" }, clip ? { clip: Object.assign({ scale: 1 }, clip) } : {})); fs.writeFileSync(file, Buffer.from(r.data, "base64")); },
    // pretend this tab is in the background (hidden, no focus) or in front, and tell the page, as a browser does when the person switches tabs
    async setFront(front) {
      await evalOn("(() => { const f = " + JSON.stringify(!!front) + "; Object.defineProperty(document, 'visibilityState', { get: () => (f ? 'visible' : 'hidden'), configurable: true }); document.hasFocus = () => f; document.dispatchEvent(new Event('visibilitychange')); if (f) window.dispatchEvent(new Event('focus')); })()");
    },
    // closes this tab; the request is bounded so a frozen browser cannot hang the test
    async close() { try { ws.close(); } catch { /* ignore */ } try { await fetch("http://127.0.0.1:" + target.port + "/json/close/" + target.id, { signal: AbortSignal.timeout(3000) }); } catch { /* the browser is going away or the tab is already closed */ } },
    // only drops the socket (used when the whole browser is closed)
    dropSocket() { try { ws.close(); } catch { /* ignore */ } },
  };
}

// ---- every browser this process started and has not finished closing ---------------------------------------------------------------------------------------------------------------------------
const live = new Set();   // { pid, dir, port, exited, exitedP, closing }
let handlersOn = false;

// synchronous clean up for the moments no waiting is possible (the process is ending): stop the recorded pid and its children, remove the folder, print what could not be removed
function cleanAllSync() {
  for (const r of [...live]) {
    if (r.pid && !r.exited) stopPidTree(r.pid);
    const err = removeFolderSync(r.dir, { ms: 3000, step: 150 });
    if (err) console.error("browser cleanup: could not remove " + r.dir + " (" + err + ")");
    live.delete(r);
  }
}
function installHandlers() {
  if (handlersOn) return; handlersOn = true;
  process.on("exit", cleanAllSync);
  for (const sig of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]) { try { process.on(sig, () => { cleanAllSync(); process.exit(130); }); } catch { /* this signal does not exist here */ } }
}

// asks the browser to close itself over the DevTools protocol; every step is bounded
async function askToClose(r) {
  const v = await (await fetch("http://127.0.0.1:" + r.port + "/json/version", { signal: AbortSignal.timeout(2000) })).json();
  await new Promise((res) => {
    let ws; const done = () => { clearTimeout(t); try { ws && ws.close(); } catch { /* ignore */ } res(); };
    const t = setTimeout(done, 2000);
    try { ws = new WebSocket(v.webSocketDebuggerUrl); ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Browser.close" })); ws.onmessage = done; ws.onclose = done; ws.onerror = done; } catch { done(); }
  });
}

// Closes one browser. Safe to call twice and on a browser that never finished starting.
function shutdown(r) {
  if (r.closing) return r.closing;
  r.closing = (async () => {
    if (!r.exited && r.port) await Promise.race([askToClose(r).catch(() => { /* it did not answer: it is stopped below */ }), delay(ASK_MS)]);
    if (!r.exited) await Promise.race([r.exitedP, delay(EXIT_MS)]);
    if (!r.exited) { stopPidTree(r.pid); await Promise.race([r.exitedP, delay(STOP_MS)]); }   // only the recorded pid and its children
    let err = await removeFolder(r.dir, { ms: 8000 });
    if (err) {   // a process that still carries this folder name is ours (the marker is in its command line): stop it by pid, then try again
      const name = path.basename(r.dir);
      for (const p of markerProcesses().filter((x) => x.folder === name)) stopPidTree(p.pid);
      err = await removeFolder(r.dir, { ms: 5000 });
    }
    if (err) console.error("browser cleanup: could not remove " + r.dir + " (" + err + ")");
    live.delete(r);
    return err;
  })();
  return r.closing;
}
export async function closeAllBrowsers() { await Promise.all([...live].map((r) => shutdown(r))); }
export const openBrowserCount = () => live.size;

// a test file that left a browser open still ends clean: node --test sets NODE_TEST_CONTEXT in the process it starts for a file
if (process.env.NODE_TEST_CONTEXT) { try { after(async () => { await closeAllBrowsers(); }); } catch { /* not inside the test runner */ } }

export async function launchBrowser() {
  installHandlers();
  const exe = candidates().find((p) => fs.existsSync(p));
  if (!exe) throw new Error("no Chrome or Edge found (set FGJ_BROWSER to the browser executable): a missing browser is a failed check, never a skipped one");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), markerPrefix()));
  const r = { pid: null, dir, port: null, exited: false, exitedP: null, closing: null };
  live.add(r);
  const tabs = [];
  let first;
  try {
    const proc = spawn(exe, ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + dir, "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--disable-extensions", "--window-size=1200,900", "about:blank"], { stdio: "ignore", windowsHide: true });
    r.pid = proc.pid;   // recorded the moment the process exists, before anything else can fail
    r.exitedP = new Promise((res) => { proc.once("exit", () => { r.exited = true; res(); }); proc.once("error", () => { r.exited = true; res(); }); });
    const portFile = path.join(dir, "DevToolsActivePort");
    let port = null;
    for (let i = 0; i < 150 && !port && !r.exited; i++) { await delay(100); try { if (fs.existsSync(portFile)) port = fs.readFileSync(portFile, "utf8").split(/\r?\n/)[0] || null; } catch { /* still being written */ } }
    if (!port) throw new Error(r.exited ? "the browser exited right after it was started" : "the browser did not start");
    r.port = port;
    first = (await (await fetch("http://127.0.0.1:" + port + "/json", { signal: AbortSignal.timeout(10000) })).json()).find((t) => t.type === "page");
    if (!first) throw new Error("the browser has no page to drive");
  } catch (e) { await shutdown(r); throw e; }
  let firstUsed = false;
  const port = r.port;
  return {
    pid: r.pid, dir,
    async newTab() {
      let target;
      if (!firstUsed) { firstUsed = true; target = first; }
      else target = await (await fetch("http://127.0.0.1:" + port + "/json/new?about:blank", { method: "PUT", signal: AbortSignal.timeout(15000) })).json();
      target.port = port;
      const tab = await connect(target); tabs.push(tab); return tab;
    },
    async close() { for (const t of tabs) t.dropSocket(); return shutdown(r); },
  };
}
