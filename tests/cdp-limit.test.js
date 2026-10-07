// cdp-limit.test.js - the browser helper's time limit for one DevTools call (tests/cdp-tabs.js withCallLimit). No browser. A call that never answers must FAIL with a message that names the call; a call that answers is untouched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withCallLimit, CALL_LIMIT_MS } from "./cdp-tabs.js";

test("a call that never answers fails at the limit and the message names the call", async () => {
  const t0 = Date.now();
  await assert.rejects(withCallLimit(new Promise(() => {}), "Runtime.evaluate history.back()", 80), (e) => /Runtime\.evaluate history\.back\(\)/.test(e.message) && /no answer/.test(e.message));
  assert.ok(Date.now() - t0 < 2000, "it failed at the limit, it did not wait");
});

test("a call that answers, or fails by itself, is passed through unchanged", async () => {
  assert.equal(await withCallLimit(new Promise((r) => setTimeout(() => r(7), 10)), "x", 500), 7);
  await assert.rejects(withCallLimit(Promise.reject(new Error("Page.navigate: bad")), "x", 500), /Page\.navigate: bad/);
});

test("the limit is generous: at least 60 s unless an environment variable lowers it", () => {
  if (!process.env.FGJ_CDP_TIMEOUT_MS) assert.ok(CALL_LIMIT_MS >= 60000);
});

// the fake site's close() must not wait for a socket the browser keeps open (a spare connection that never sent a request): server.close alone waited minutes for it and made the browser tests that start a site per defect hours long
test("the fake site closes at once even when a client keeps a connection open", async () => {
  const { startFakeSite } = await import("./fake-site.js");
  const net = await import("node:net");
  const site = await startFakeSite(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  const port = Number(new URL(site.url).port);
  const sock = net.connect(port, "127.0.0.1"); await new Promise((r) => sock.once("connect", r));
  sock.on("error", () => {});
  const t0 = Date.now();
  await Promise.race([site.close(), new Promise((_, rej) => setTimeout(() => rej(new Error("close() waited for an open connection")), 5000))]);
  assert.ok(Date.now() - t0 < 2000);
  sock.destroy();
});
