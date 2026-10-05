// scroll-lock.test.js - js/scroll-lock.js on a fake document (the real browser behavior is proven in tests/search-ui.test.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { lockScroll } from "../js/scroll-lock.js";

function fake({ htmlOverflow = "", bodyOverflow = "", pad = "", bar = 0, bodyStyleAttr = null } = {}) {
  const html = { style: { overflow: htmlOverflow }, clientWidth: 1000 - bar, _attr: null, getAttribute() { return this.style.overflow === "" ? "" : "x"; }, removeAttribute() { this._removed = true; } };
  const body = { style: { overflow: bodyOverflow, paddingRight: pad }, getAttribute() { return bodyStyleAttr !== null ? bodyStyleAttr : (this.style.overflow === "" && this.style.paddingRight === "" ? "" : "x"); }, removeAttribute() { this._removed = true; } };
  const doc = { documentElement: html, body };
  const win = { innerWidth: 1000, getComputedStyle: () => ({ paddingRight: pad || "0px" }) };
  return { doc, win, html, body };
}
test("lock hides the page's overflow, unlock puts back exactly what was there (empty stays empty)", () => {
  const f = fake(); const un = lockScroll(f.doc, f.win);
  assert.equal(f.html.style.overflow, "hidden"); assert.equal(f.body.style.overflow, "hidden"); assert.equal(f.body.style.paddingRight, "", "no scrollbar, no padding added");
  un(); assert.equal(f.html.style.overflow, ""); assert.equal(f.body.style.overflow, ""); assert.equal(f.body.style.paddingRight, "");
});
test("unlock restores values that were already set inline", () => {
  const f = fake({ htmlOverflow: "scroll", bodyOverflow: "auto", pad: "8px" }); const un = lockScroll(f.doc, f.win);
  assert.equal(f.html.style.overflow, "hidden");
  un(); assert.equal(f.html.style.overflow, "scroll"); assert.equal(f.body.style.overflow, "auto"); assert.equal(f.body.style.paddingRight, "8px");
});
test("a classic scrollbar's width is added to the body's right padding while locked, and removed on unlock", () => {
  const f = fake({ bar: 15, pad: "4px" }); const un = lockScroll(f.doc, f.win);
  assert.equal(f.body.style.paddingRight, "19px");
  un(); assert.equal(f.body.style.paddingRight, "4px");
});
test("unlock can be called twice (the second call does nothing)", () => {
  const f = fake(); const un = lockScroll(f.doc, f.win); un(); f.html.style.overflow = "visible"; un();
  assert.equal(f.html.style.overflow, "visible", "the second unlock did not touch the page again");
});
