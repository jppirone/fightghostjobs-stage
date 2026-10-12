// kio.unit.test.js - the KIO ID on this site, in Node with no browser (prompt BQ, October 12, 2026): the check algorithm on the six vectors of the spec and on thousands of random IDs, every way an ID may be typed or
// pasted, the shown form, the lines for a job ad (with the short link off and on), the receiving page's path reading, the search page's classification of a typed text, and the extension's fragment (k, c, t).
// Run: node --test tests/kio.unit.test.js
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { KIO_ALPHABET, KIO_PREFIX, kioCheckChar, kioValid, readKio, kioDisplay, displayId, adLines, shortLinkOf, kioFromPath, looksLikeKio, POST_ID_RE, isKioShown } from "../js/kio.js";
import { classifyQuery, noMatchMessage, KIO_INVALID_MESSAGE, KIO_NOT_REGISTERED_MESSAGE, KIO_GONE_MESSAGE, kioMismatchMessage } from "../js/search-input.js";
import { parseSearchFragment } from "../js/fragment-prefill.js";
import { recapSentence } from "../js/search-recap.js";
import { groupCode } from "../js/format.js";

const VECTORS = [["7K3M9Q2XW4T", "9"], ["00000000000", "0"], ["ZZZZZZZZZZZ", "B"], ["ABCDEFGHJKM", "Y"], ["0123456789A", "B"], ["8YP1X8HGTKQ", "Q"]];
const randomBody = () => { const b = crypto.randomBytes(11); return [...b].map((x) => KIO_ALPHABET[x % 32]).join(""); };

test("the six check vectors of the spec", () => {
  for (const [body, check] of VECTORS) {
    assert.equal(kioCheckChar(body), check, body);
    assert.equal(kioValid(body + check), true, body + check);
    for (const c of KIO_ALPHABET) if (c !== check) assert.equal(kioValid(body + c), false, body + c + " must not pass");
  }
});

test("2000 random IDs: made and checked the same way, and any other check character fails", () => {
  for (let i = 0; i < 2000; i++) {
    const body = randomBody(), check = kioCheckChar(body);
    assert.equal(KIO_ALPHABET.includes(check), true);
    assert.equal(kioValid(body + check), true);
    const other = KIO_ALPHABET[(KIO_ALPHABET.indexOf(check) + 1 + (i % 31)) % 32];
    assert.equal(kioValid(body + other), false);
  }
  assert.equal(kioCheckChar("TOO"), null);
  assert.equal(kioCheckChar("0000000000U"), null, "U is not in the alphabet");
});

test("the prefix is the one setting and the shown form is PREFIX-XXXX-XXXX-XXXX", () => {
  assert.equal(KIO_PREFIX, "KIO");
  assert.equal(kioDisplay("7K3M9Q2XW4T9"), "KIO-7K3M-9Q2X-W4T9");
  assert.equal(displayId("KIO7K3M9Q2XW4T9"), "KIO-7K3M-9Q2X-W4T9");
  assert.equal(displayId("D21M48YBZQBF"), "D21M-48YB-ZQBF", "an opening that still holds an old code is shown as it always was");
  assert.equal(groupCode("KIO7K3M9Q2XW4T9"), "KIO-7K3M-9Q2X-W4T9", "the employer's pages show the same form");
  assert.equal(displayId("not a code"), "not a code");
  assert.equal(isKioShown("KIO-7K3M-9Q2X-W4T9"), true);
  assert.equal(isKioShown("KIO7K3M9Q2XW4T9"), false);
  assert.equal(POST_ID_RE.test("KIO7K3M9Q2XW4T9"), true);
  assert.equal(POST_ID_RE.test("D21M48YBZQBF"), true);
  assert.equal(POST_ID_RE.test("KIO7K3M9Q2XW4T"), false);
});

test("every way a KIO ID is typed or pasted reads as the same ID", () => {
  const want = "KIO7K3M9Q2XW4T9";
  for (const t of ["KIO7K3M9Q2XW4T9", "KIO-7K3M-9Q2X-W4T9", "kio-7k3m-9q2x-w4t9", " kio 7k3m 9q2x w4t9 ", "KIO 7K3M9Q2XW4T9", "7K3M9Q2XW4T9", "7K3M-9Q2X-W4T9", "7k3m 9q2x w4t9", "K1O-7K3M-9Q2X-W4T9", "KlO7K3M9Q2XW4T9", "KI0-7K3M-9Q2X-W4T9"]) {
    const r = readKio(t);
    assert.equal(r.kind, "kio", JSON.stringify(t));
    assert.equal(r.stored, want, JSON.stringify(t));
    assert.equal(r.display, "KIO-7K3M-9Q2X-W4T9");
  }
  // I and L read as 1, O reads as 0, inside the code too: 00000000000 + 0 spelled with O
  assert.equal(readKio("KIO-OOOO-OOOO-OOOO").stored, "KIO000000000000");
  assert.equal(readKio("kio-oooo-oooo-oooo").stored, "KIO000000000000");
  // the dashes of text and the no-break space are ignored as well
  assert.equal(readKio("KIO–7K3M–9Q2X–W4T9").stored, want);
  assert.equal(readKio("KIO 7K3M 9Q2X W4T9").stored, want);
});

test("nothing is guessed: a wrong check character, a wrong length, a stranger's characters are not IDs", () => {
  assert.deepEqual(readKio("KIO-7K3M-9Q2X-W4TX"), { kind: "none", reason: "check" });
  assert.equal(readKio("KIO-7K3M-9Q2X-W4U9").kind, "none");           // U is not in the alphabet
  assert.equal(readKio("ABC-7K3M-9Q2X-W4T9").reason, "no-prefix");
  assert.equal(readKio("KIO-7K3M-9Q2X").reason, "length");
  assert.equal(readKio("").reason, "characters");
  assert.equal(readKio("KIO-7K3M-9Q2X-W4T9!").reason, "characters");
  // twelve characters that do not pass the check are an OLD code and are never corrected
  assert.deepEqual(readKio("D21M-48YB-ZQBF"), { kind: "old", display: "D21M-48YB-ZQBF" });
  assert.equal(readKio("D21M48YBZQBO").kind, "none", "an O stays an O in an old code and is refused");
});

test("the lines for a job ad: the ID line always, the Check this opening line only while the short link is live", () => {
  const shown = "KIO-7K3M-9Q2X-W4T9";
  assert.deepEqual(adLines(shown, false), ["KIO ID: KIO-7K3M-9Q2X-W4T9"]);
  assert.deepEqual(adLines(shown, true), ["KIO ID: KIO-7K3M-9Q2X-W4T9", "Check this opening: knowitsopen.com/KIO-7K3M-9Q2X-W4T9"]);
  assert.deepEqual(adLines(shown), ["KIO ID: KIO-7K3M-9Q2X-W4T9"], "it ships with the short link off");
  assert.equal(shortLinkOf(shown), "knowitsopen.com/KIO-7K3M-9Q2X-W4T9");
});

test("the receiving page reads a path only when it is a whole KIO ID that passes the check", () => {
  assert.equal(kioFromPath("/KIO-7K3M-9Q2X-W4T9"), "KIO7K3M9Q2XW4T9");
  assert.equal(kioFromPath("/kio7k3m9q2xw4t9/"), "KIO7K3M9Q2XW4T9");
  assert.equal(kioFromPath("/KIO-7K3M-9Q2X-W4T9"), kioFromPath("/KIO%2D7K3M%2D9Q2X%2DW4T9"));
  assert.equal(kioFromPath("/7K3M9Q2XW4T9"), null, "no prefix: not forwarded");
  assert.equal(kioFromPath("/KIO-7K3M-9Q2X-W4TX"), null, "a wrong check character: not forwarded");
  assert.equal(kioFromPath("/index.html"), null);
  assert.equal(kioFromPath("/a/KIO-7K3M-9Q2X-W4T9"), null);
  assert.equal(kioFromPath("/"), null);
  assert.equal(kioFromPath("/%E0%A4%A"), null, "a bad percent escape");
});

test("an attempt at an ID is told apart from a title", () => {
  assert.equal(looksLikeKio("KIO-7K3M-9Q2X-W4TX"), true);
  assert.equal(looksLikeKio("kio 7k3m 9q2x w4tx"), true);
  assert.equal(looksLikeKio("KIO7K3M9Q2XW4TX"), true);
  assert.equal(looksLikeKio("Kiosk Operator II"), false);
  assert.equal(looksLikeKio("Store Manager"), false);
  assert.equal(looksLikeKio("D21M-48YB-ZQBF"), false);
});

test("the search box: an ID that passes is a KIO lookup, one that fails is refused at once, titles and old codes go as they always did", () => {
  assert.deepEqual(classifyQuery("KIO-7K3M-9Q2X-W4T9"), { ok: true, kind: "kio", value: "KIO7K3M9Q2XW4T9", shown: "KIO-7K3M-9Q2X-W4T9" });
  assert.equal(classifyQuery("7k3m 9q2x w4t9").kind, "kio");
  const bad = classifyQuery("KIO-7K3M-9Q2X-W4TX");
  assert.equal(bad.ok, false);
  assert.equal(bad.message, KIO_INVALID_MESSAGE);
  // twelve plain letters that pass the check are a title first, an ID only if the title finds nothing
  let word = null;
  for (const w of ["Receptionist", "Storemanager", "Accountantss", "Pharmacistss", "Electricians", "Technicianss", "Salesmanager", "Planningstaf"]) { if (readKio(w).kind === "kio") { word = w; break; } }
  if (word !== null) { const c = classifyQuery(word); assert.equal(c.kind, "phrase"); assert.equal(c.alsoTryCode, true); assert.ok(c.alsoTryKio.startsWith("KIO")); }
  assert.deepEqual(classifyQuery("Data Analyst"), { ok: true, kind: "phrase", value: "Data Analyst" });
  assert.equal(classifyQuery("Kiosk Operator II").kind, "phrase");
  assert.equal(classifyQuery("D21M-48YB-ZQBF").kind === "kio" || classifyQuery("D21M-48YB-ZQBF").kind === "code", true);
  assert.equal(classifyQuery("D21M-48YB-ZQBO").kind, "code", "an old code with a letter O is an old code, never corrected into an ID");
});

test("the words of the answers are John's", () => {
  assert.equal(KIO_INVALID_MESSAGE, "That ID is not valid. Check it and try again.");
  assert.equal(KIO_NOT_REGISTERED_MESSAGE, "No opening is registered under that ID.");
  assert.equal(KIO_GONE_MESSAGE, "This opening is no longer on FightGhostJobs.");
  // prompt BS (October 12, 2026): the notice names what was entered and tells the person to check the copy (the company case is John's own wording)
  const TAIL = " It belongs to the opening shown below. Check that you copied the ID correctly from the job ad.";
  assert.equal(kioMismatchMessage("Zzyzx Staffing", ""), "This ID is not registered to the company you entered (Zzyzx Staffing)." + TAIL);
  assert.equal(kioMismatchMessage("", "Welder Apprentice"), "This ID is not registered to the job title you entered (Welder Apprentice)." + TAIL);
  assert.equal(kioMismatchMessage("Zzyzx Staffing", "Welder Apprentice"), "This ID is not registered to the company or job title you entered (Zzyzx Staffing, Welder Apprentice)." + TAIL);
  assert.equal(kioMismatchMessage("  <b>Acme</b> & Co  ", ""), "This ID is not registered to the company you entered (<b>Acme</b> & Co)." + TAIL, "exactly as typed (trimmed): the page puts it on the screen as text");
  assert.equal(noMatchMessage("", "KIO7K3M9Q2XW4T9", "kio"), KIO_NOT_REGISTERED_MESSAGE);
});

test("the recap of an ID search shows the ID in its shown form, however it was typed; a req number, an old code and twelve plain letters are still never printed", () => {
  const shown = classifyQuery("kio7k3m9q2xw4t9");
  assert.equal(shown.shown, "KIO-7K3M-9Q2X-W4T9");
  assert.equal(recapSentence("Meridian", shown), "You searched for: company Meridian, Opening ID KIO-7K3M-9Q2X-W4T9. Your results are below.");
  assert.equal(recapSentence("", shown), "You searched for: Opening ID KIO-7K3M-9Q2X-W4T9. Your results are below.");
  assert.equal(recapSentence("Meridian", { kind: "kio", value: "KIO7K3M9Q2XW4T9" }), "You searched for: company Meridian, an Opening ID was entered. Your results are below.", "no shown form given: the old words");
  assert.equal(recapSentence("Meridian", { kind: "req", value: "R-2026-0451" }), "You searched for: company Meridian, a req number was entered. Your results are below.");
  assert.equal(recapSentence("Meridian", { kind: "code", value: "D21M-48YB-ZQBF" }), "You searched for: company Meridian, an Opening ID was entered. Your results are below.");
  assert.equal(recapSentence("Meridian", { kind: "phrase", value: "Receptionist", alsoTryCode: true, alsoTryKio: "KIO7K3M9Q2XW4T9" }), "You searched for: company Meridian, an Opening ID was entered. Your results are below.");
  assert.equal(recapSentence("Meridian", { kind: "phrase", value: "Data Analyst" }), "You searched for: company Meridian, title Data Analyst. Your results are below.");
});

test("the extension's fragment: k with c and t; p or r with k, a k that fails the check, doubles and over long values refuse the whole fragment", () => {
  const ok = parseSearchFragment("#k=KIO7K3M9Q2XW4T9&c=Meridian%20Health&t=Data%20Analyst");
  assert.deepEqual(ok, { ours: true, result: { company: "Meridian Health", kind: "kio", value: "KIO-7K3M-9Q2X-W4T9", stored: "KIO7K3M9Q2XW4T9", title: "Data Analyst" } });
  assert.deepEqual(parseSearchFragment("#k=KIO7K3M9Q2XW4T9").result, { company: "", kind: "kio", value: "KIO-7K3M-9Q2X-W4T9", stored: "KIO7K3M9Q2XW4T9", title: "" });
  assert.equal(parseSearchFragment("#k=KIO7K3M9Q2XW4T9&c=Meridian&r=4471").result, null, "no req number with an ID");
  assert.equal(parseSearchFragment("#k=KIO7K3M9Q2XW4T9&c=Meridian&p=D21M48YBZQBF").result, null, "no old code with an ID");
  assert.equal(parseSearchFragment("#k=KIO7K3M9Q2XW4TX&c=Meridian").result, null, "a wrong check character");
  assert.equal(parseSearchFragment("#k=KIO7K3M9Q2XW4T9&k=KIO7K3M9Q2XW4T9").result, null, "a key twice");
  assert.equal(parseSearchFragment("#k=" + "A".repeat(30)).result, null);
  assert.equal(parseSearchFragment("#k=KIO7K3M9Q2XW4T9&t=" + "x".repeat(81)).result, null, "a title over 80 characters");
  assert.equal(parseSearchFragment("#k=KIO7K3M9Q2XW4T9&c=Meridian%0A").result, null, "a control character");
  assert.equal(parseSearchFragment("#k=").result, null);
  // the old three forms are as they were
  assert.deepEqual(parseSearchFragment("#c=Meridian&r=4471").result, { company: "Meridian", kind: "req", value: "4471" });
});
