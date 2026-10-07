// cdp-tabs.js - a headless Chrome or Edge over the DevTools protocol with SEVERAL TABS in one browser profile (shared localStorage, as the tabs of a real browser share it). No dependencies (Node's built-in WebSocket).
//   const b = await launchBrowser();           // one fresh profile; a missing browser THROWS (a failed check, never a skipped one; set FGJ_BROWSER to an executable)
//   const a = await b.newTab();                // a tab: { goto, eval, waitFor, viewport, shot, close }
//   await b.close();
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CANDIDATES = [process.env.FGJ_BROWSER, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);

// A DevTools call that never answers (a page in the back/forward cache is frozen, the browser died) would hang a whole test run, so every call has a time limit. The limit is generous (90 s, a normal call takes well under 1 s;
// FGJ_CDP_TIMEOUT_MS changes it) so a slow machine does not trip it by itself. When it is hit the test FAILS with a message that names the call, it does not hang.
export const CALL_LIMIT_MS = Number(process.env.FGJ_CDP_TIMEOUT_MS) || 90000;
export function withCallLimit(promise, label, ms = CALL_LIMIT_MS) {
  let timer;
  const limit = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("DevTools call '" + label + "' got no answer in " + Math.round(ms / 1000) + " s (the page may be frozen in the back/forward cache, or the browser is gone)")), ms); });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

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
    async close() { try { ws.close(); } catch { /* ignore */ } try { await fetch("http://127.0.0.1:" + target.port + "/json/close/" + target.id); } catch { /* ignore */ } },
  };
}

export async function launchBrowser() {
  const exe = CANDIDATES.find((p) => fs.existsSync(p));
  if (!exe) throw new Error("no Chrome or Edge found (set FGJ_BROWSER to the browser executable): a missing browser is a failed check, never a skipped one");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-tabs-"));
  const proc = spawn(exe, ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + dir, "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--disable-extensions", "--window-size=1200,900", "about:blank"], { stdio: "ignore" });
  const portFile = path.join(dir, "DevToolsActivePort");
  let port = null;
  for (let i = 0; i < 150 && !port; i++) { await new Promise((r) => setTimeout(r, 100)); try { if (fs.existsSync(portFile)) port = fs.readFileSync(portFile, "utf8").split(/\r?\n/)[0] || null; } catch { /* still being written */ } }
  if (!port) { proc.kill(); throw new Error("the browser did not start"); }
  const tabs = [];
  const first = (await (await fetch("http://127.0.0.1:" + port + "/json")).json()).find((t) => t.type === "page");
  let firstUsed = false;
  return {
    async newTab() {
      let target;
      if (!firstUsed) { firstUsed = true; target = first; }
      else target = await (await fetch("http://127.0.0.1:" + port + "/json/new?about:blank", { method: "PUT" })).json();
      target.port = port;
      const tab = await connect(target); tabs.push(tab); return tab;
    },
    async close() { for (const t of tabs) { try { await t.close(); } catch { /* ignore */ } } try { proc.kill(); } catch { /* ignore */ } await new Promise((r) => setTimeout(r, 400)); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } },
  };
}
