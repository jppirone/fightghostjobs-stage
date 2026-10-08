// fragment-prefill.unit.test.js - the pure parser of the search page's URL fragment (js/fragment-prefill.js): what is accepted, what is refused, and that every refusal fills nothing. No browser.
// The page behavior (boxes, address bar, no automatic search, signed out and signed in) is proven in a real browser by tests/fragment-prefill.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSearchFragment, applyFragmentPrefill, FRAGMENT_MAX } from "../js/fragment-prefill.js";

const enc = encodeURIComponent;
const ok = (hash) => parseSearchFragment(hash).result;

test("the three accepted shapes: company plus ONE of Opening ID, req number or title", () => {
  assert.deepEqual(ok("#c=Northwind%20Analytics&p=D21M-48YB-ZQBF"), { company: "Northwind Analytics", kind: "postid", value: "D21M-48YB-ZQBF" });
  assert.deepEqual(ok("#c=Northwind%20Analytics&r=R-2026-0451"), { company: "Northwind Analytics", kind: "req", value: "R-2026-0451" });
  assert.deepEqual(ok("#c=Northwind%20Analytics&t=Senior%20Data%20Analyst"), { company: "Northwind Analytics", kind: "title", value: "Senior Data Analyst" });
  assert.deepEqual(ok("t=Senior%20Data%20Analyst&c=Northwind%20Analytics"), { company: "Northwind Analytics", kind: "title", value: "Senior Data Analyst" }, "order does not matter and the # is optional");
  assert.deepEqual(ok("#c=" + enc("Cedar & Pine #2 = 100%") + "&t=" + enc("C++ / R&D (senior)")), { company: "Cedar & Pine #2 = 100%", kind: "title", value: "C++ / R&D (senior)" });
  assert.deepEqual(ok("#c=%20%20Northwind%20&r=%204471%20"), { company: "Northwind", kind: "req", value: "4471" }, "surrounding spaces are dropped");
});

test("unknown keys are ignored; a fragment with none of the known keys is not ours and is left alone", () => {
  assert.deepEqual(ok("#c=Northwind&t=Analyst&zz=1&utm_source=x&__proto__=y&constructor=z"), { company: "Northwind", kind: "title", value: "Analyst" });
  for (const hash of ["", "#", "#top", "#access_token=abc&refresh_token=def&type=magiclink", "#error=access_denied&error_code=otp_expired", "#zz=1&yy=2", "#c", "#=c", "#cc=Northwind&tt=Analyst", "#C=Northwind&T=Analyst"]) assert.deepEqual(parseSearchFragment(hash), { ours: false, result: null }, hash);
});

test("refused (the whole fragment, nothing is cut or guessed): too long, repeated key, two second values, no company, no second value, empty values", () => {
  const L = FRAGMENT_MAX;
  const refused = [
    "#c=" + "N".repeat(L.company + 1) + "&t=Analyst", "#c=Northwind&t=" + "t".repeat(L.title + 1), "#c=Northwind&r=" + "4".repeat(L.req + 1), "#c=Northwind&p=" + "D".repeat(L.postid + 1),
    "#c=A&c=B&t=Analyst", "#c=Northwind&t=Analyst&t=Planner", "#c=Northwind&r=1&r=2",
    "#c=Northwind&r=4471&t=Analyst", "#c=Northwind&p=D21M-48YB-ZQBF&t=Analyst", "#c=Northwind&r=4471&p=D21M-48YB-ZQBF", "#c=Northwind&r=1&p=2&t=3",
    "#t=Analyst", "#r=4471", "#p=D21M-48YB-ZQBF", "#c=Northwind", "#c=&t=Analyst", "#c=Northwind&t=", "#c=%20&t=Analyst", "#c=Northwind&t=%20%20",
  ];
  for (const hash of refused) { const p = parseSearchFragment(hash); assert.equal(p.ours, true, hash); assert.equal(p.result, null, hash); }
  assert.notEqual(ok("#c=" + "N".repeat(L.company) + "&t=" + "t".repeat(L.title)), null, "exactly the limits are fine");
  assert.notEqual(ok("#c=Northwind&p=" + "D".repeat(L.postid)), null);
});

test("control characters, bad percent escapes, too many parts and an oversized whole are refused", () => {
  for (const hash of ["#c=North%00wind&t=Analyst", "#c=Northwind&t=Ana%0Alyst", "#c=Northwind&t=Ana%0Dlyst", "#c=Northwind&t=Ana%09lyst", "#c=Northwind&t=Ana%7Flyst", "#c=Northwind&t=Ana%E2%80%A8lyst", "#c=Northwind&t=%E0%A4%A", "#c=%ZZ&t=Analyst",
    "#c=Northwind&t=Analyst" + "&x=1".repeat(12), "#c=Northwind&t=Analyst&x=" + "y".repeat(700)]) assert.equal(parseSearchFragment(hash).result, null, hash);
});

test("hostile text is just text: it comes back unchanged for .value and nothing is interpreted or truncated", () => {
  const evil = ["<img src=x onerror=alert(1)>", "<script>alert(1)</script>", "\"><svg/onload=alert(1)>", "javascript:alert(1)", "{{constructor.constructor('alert(1)')()}}", "'; drop table postings; --", "%3Cb%3E", "../../etc/passwd", "&#60;b&#62;"];
  for (const e of evil) assert.deepEqual(ok("#c=" + enc(e) + "&t=" + enc(e)), { company: e.trim(), kind: "title", value: e.trim() }, e);
});

test("applyFragmentPrefill: fills .value only, never touches the unused box, removes the fragment at once (even when it refuses), leaves a foreign fragment alone", () => {
  const mk = (hash) => {
    const calls = [], boxes = { c: { value: "" }, q: { value: "" }, r: { value: "" } };
    const win = { location: { hash, pathname: "/search.html", search: "?x=1" }, history: { state: { keep: 1 }, replaceState: (s, t, url) => calls.push([s, t, url]) } };
    return { calls, boxes, run: () => applyFragmentPrefill({ win, companyEl: boxes.c, queryEl: boxes.q, reqEl: boxes.r }) };
  };
  let m = mk("#c=Northwind&r=4471");
  assert.equal(m.run(), true); assert.deepEqual([m.boxes.c.value, m.boxes.q.value, m.boxes.r.value], ["Northwind", "", "4471"]);
  assert.deepEqual(m.calls, [[{ keep: 1 }, "", "/search.html?x=1"]], "the address is rewritten WITHOUT the fragment, the query string kept");
  m = mk("#c=Northwind&t=Analyst"); m.run(); assert.deepEqual([m.boxes.c.value, m.boxes.q.value, m.boxes.r.value], ["Northwind", "Analyst", ""]);
  m = mk("#c=Northwind&p=D21M-48YB-ZQBF"); m.run(); assert.deepEqual([m.boxes.q.value, m.boxes.r.value], ["D21M-48YB-ZQBF", ""]);
  m = mk("#c=Northwind&r=1&t=2");
  assert.equal(m.run(), false); assert.deepEqual([m.boxes.c.value, m.boxes.q.value, m.boxes.r.value], ["", "", ""], "a refused fragment fills nothing"); assert.equal(m.calls.length, 1, "but it is still removed from the address bar");
  m = mk("#access_token=abc&type=magiclink");
  assert.equal(m.run(), false); assert.equal(m.calls.length, 0, "a fragment that is not ours (the sign-in link's) is left exactly as it is");
  m = mk("");
  assert.equal(m.run(), false); assert.equal(m.calls.length, 0);
});
