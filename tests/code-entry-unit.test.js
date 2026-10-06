// code-entry-unit.test.js - the pure parts of js/code-entry.js (October 6, 2026): what is cleaned out of a typed code, what is refused before any request, and the two failure sentences. No browser.
// The page behavior is proven in a real browser by tests/code-entry.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanCode, codeProblem, failureText } from "../js/code-entry.js";

test("cleanCode removes spaces and dashes only", () => {
  assert.equal(cleanCode("123456"), "123456");
  assert.equal(cleanCode(" 123 456 "), "123456");
  assert.equal(cleanCode("123-456"), "123456");
  assert.equal(cleanCode("12\t34\n56"), "123456");
  assert.equal(cleanCode("abc"), "abc");
  assert.equal(cleanCode(undefined), "");
  assert.equal(cleanCode(null), "");
});

test("codeProblem: 6 to 10 digits go through, everything else gets a plain sentence and sends nothing", () => {
  for (const ok of ["123456", "1234567", "12345678", "123456789", "1234567890", "123 456", "123-456"]) assert.equal(codeProblem(ok), null, ok);
  assert.equal(codeProblem(""), "Type the code from the email.");
  assert.equal(codeProblem("   "), "Type the code from the email.");
  for (const bad of ["12345", "12345678901", "abc123", "12 34 5", "12345a", "١٢٣٤٥٦", "123456; drop"]) assert.equal(codeProblem(bad), "The code is made of digits only, usually 6.", bad);
});

test("failureText: a rate limit says wait; everything else is the plain 'did not work' sentence and never says why", () => {
  assert.equal(failureText({ status: 429, message: "" }), "Too many tries. Wait a minute and try again.");
  assert.equal(failureText({ status: 0, message: "email rate limit exceeded, try after 60 seconds" }), "Too many tries. Wait a minute and try again.");
  for (const r of [{ status: 403, message: "Token has expired or is invalid", code: "otp_expired" }, { status: 422, message: "x" }, { status: 0, message: "" }, null, undefined]) assert.equal(failureText(r), "That code did not work. Check it, or ask for a new link.");
});
