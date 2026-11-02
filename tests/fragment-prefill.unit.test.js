// fragment-prefill.unit.test.js - the pure parser of the search page's URL fragment (js/fragment-prefill.js): what is accepted, what is refused, and that every refusal fills nothing. No browser.
// The page behavior (boxes, address bar, no automatic search, signed out and signed in) is proven in a real browser by tests/fragment-prefill.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSearchFragment, applyFragmentPrefill, FRAGMENT_MAX, originOf, requestOrigin } from "../js/fragment-prefill.js";

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

// ---- prompt IA (November 1, 2026): the key o. o=e is the extension (with the host h), o=m is the phone entry (mobile, never a host); anything else is ignored and the search counts as the site
test("o=m gives the origin mobile with no host, and an h that comes with it is ignored", () => {
  const base = { company: "Northwind", kind: "title", value: "Analyst" };
  assert.deepEqual(ok("#c=Northwind&t=Analyst&o=m"), { ...base, origin: { origin: "mobile", host: null } });
  assert.deepEqual(ok("#o=m&c=Northwind&t=Analyst"), { ...base, origin: { origin: "mobile", host: null } }, "order does not matter");
  assert.deepEqual(ok("#c=Northwind&t=Analyst&o=m&h=jobs.example.invalid"), { ...base, origin: { origin: "mobile", host: null } }, "h is ignored for mobile");
  assert.deepEqual(ok("#h=jobs.example.invalid&c=Northwind&r=4471&o=m"), { company: "Northwind", kind: "req", value: "4471", origin: { origin: "mobile", host: null } });
  assert.deepEqual(ok("#c=Northwind&p=D21M-48YB-ZQBF&o=m"), { company: "Northwind", kind: "postid", value: "D21M-48YB-ZQBF", origin: { origin: "mobile", host: null } });
});
test("o=e is unchanged: the extension with the cleaned host of the job page", () => {
  const base = { company: "Northwind", kind: "title", value: "Analyst" };
  assert.deepEqual(ok("#c=Northwind&t=Analyst&o=e&h=" + enc("https://www.Jobs.Example.invalid:8080/x?y#z")), { ...base, origin: { origin: "extension", host: "jobs.example.invalid" } });
  assert.deepEqual(ok("#c=Northwind&t=Analyst&o=e"), { ...base, origin: { origin: "extension", host: null } });
  assert.deepEqual(ok("#c=Northwind&t=Analyst&o=e&h=" + enc("not a host!")), { ...base, origin: { origin: "extension", host: null } }, "a host that is not a plain host is dropped");
});
test("any other o, an empty o, a capital letter, or a second o: ignored or the first wins (as before), never a reason to refuse", () => {
  const plain = { company: "Northwind", kind: "title", value: "Analyst" };
  for (const o of ["x", "", "M", "E", "mm", "mobile", "extension", "site", "1", "%20"]) assert.deepEqual(ok("#c=Northwind&t=Analyst&o=" + o), plain, "o=" + o);
  assert.deepEqual(ok("#c=Northwind&t=Analyst&o=m&o=e&h=jobs.example.invalid"), { ...plain, origin: { origin: "mobile", host: null } }, "a second o is ignored: the first one wins");
  assert.deepEqual(ok("#c=Northwind&t=Analyst&o=e&o=m&h=jobs.example.invalid"), { ...plain, origin: { origin: "extension", host: "jobs.example.invalid" } }, "a second o is ignored: the first one wins");
  assert.deepEqual(ok("#c=Northwind&t=Analyst&o=x&o=m"), plain, "a first o that is not ours is the one that counts");
  assert.deepEqual(ok("#c=Northwind&t=Analyst&o=%E0%A4%A"), plain, "a bad escape in o is ignored, not a reason to refuse");
});
test("o=m does not loosen anything: a refused fragment is refused with it, and o alone is not ours", () => {
  const L = FRAGMENT_MAX;
  for (const hash of ["#c=Northwind&r=4471&t=Analyst&o=m", "#c=Northwind&r=1&p=2&o=m", "#t=Analyst&o=m", "#c=&t=Analyst&o=m", "#c=Northwind&o=m", "#c=Northwind&t=" + "t".repeat(L.title + 1) + "&o=m", "#c=" + "N".repeat(L.company + 1) + "&t=Analyst&o=m",
    "#c=Northwind&t=Ana%0Alyst&o=m", "#c=Northwind&t=%E0%A4%A&o=m", "#c=A&c=B&t=Analyst&o=m", "#c=Northwind&t=Analyst&o=m" + "&x=1".repeat(12), "#c=Northwind&t=Analyst&o=m&zz=" + "y".repeat(700)]) {
    const p = parseSearchFragment(hash); assert.equal(p.ours, true, hash); assert.equal(p.result, null, hash);
  }
  for (const hash of ["#o=m", "#o=m&h=jobs.example.invalid", "o=m", "#o=e&h=jobs.example.invalid"]) assert.deepEqual(parseSearchFragment(hash), { ours: false, result: null }, hash);
  assert.notEqual(ok("#c=" + "N".repeat(L.company) + "&t=" + "t".repeat(L.title) + "&o=m"), null, "exactly the limits are fine with o=m too");
});
test("a bad KIO ID keeps its company and title with o=m as before; a k with r or p is refused", () => {
  assert.equal(parseSearchFragment("#k=KIO7K3M9Q2XW4T9&r=4471&o=m").result, null);
  const bad = parseSearchFragment("#k=KIO-NOT-AN-ID&c=Northwind&t=Analyst&o=m").result;
  assert.equal(bad.bad, true); assert.deepEqual(bad.origin, { origin: "mobile", host: null });
  assert.equal(parseSearchFragment("#k=KIO-NOT-AN-ID&c=Northwind&o=m").result, null, "a bad ID without a title is refused as before");
});
test("originOf and requestOrigin: the request fields for each origin", () => {
  assert.deepEqual(originOf("e", "WWW.Jobs.Example.invalid"), { origin: "extension", host: "jobs.example.invalid" });
  assert.deepEqual(originOf("m", "jobs.example.invalid"), { origin: "mobile", host: null });
  assert.deepEqual(originOf("x", "jobs.example.invalid"), { origin: "site", host: null });
  assert.deepEqual(requestOrigin({ origin: "mobile", host: "jobs.example.invalid" }), { origin: "mobile" }, "mobile never carries a host");
  assert.deepEqual(requestOrigin({ origin: "extension", host: "jobs.example.invalid" }), { origin: "extension", origin_host: "jobs.example.invalid" });
  assert.deepEqual(requestOrigin({ origin: "extension", host: null }), { origin: "extension" });
  assert.deepEqual(requestOrigin({ origin: "extension", host: "not a host!" }), { origin: "extension" });
  assert.deepEqual(requestOrigin({ origin: "site", host: "jobs.example.invalid" }), { origin: "site" }, "a site search never carries a host");
  for (const x of [null, undefined, 5, "mobile", {}, { origin: "phone" }, { origin: "Mobile" }, { origin: 5 }]) assert.deepEqual(requestOrigin(x), { origin: "site" }, JSON.stringify(x));
});
test("applyFragmentPrefill hands the read origin to onOrigin: mobile, extension, and nothing for a plain address", () => {
  const mk = (hash) => {
    const got = [], boxes = { c: { value: "" }, q: { value: "" }, r: { value: "" } };
    const win = { location: { hash, pathname: "/search.html", search: "" }, history: { state: null, replaceState: () => {} } };
    return { got, run: () => applyFragmentPrefill({ win, companyEl: boxes.c, queryEl: boxes.q, reqEl: boxes.r, onOrigin: (o) => got.push(o) }) };
  };
  let m = mk("#c=Northwind&t=Analyst&o=m"); m.run(); assert.deepEqual(m.got, [{ origin: "mobile", host: null }]);
  m = mk("#c=Northwind&t=Analyst&o=e&h=jobs.example.invalid"); m.run(); assert.deepEqual(m.got, [{ origin: "extension", host: "jobs.example.invalid" }]);
  m = mk("#c=Northwind&t=Analyst"); m.run(); assert.deepEqual(m.got, [undefined]);
  m = mk("#c=Northwind&r=1&t=2&o=m"); assert.equal(m.run(), false); assert.deepEqual(m.got, [], "a refused fragment hands over nothing");
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
