// account-menu.test.js - the signed-in circle in the top bar (October 4, 2026).
//   * accountText: the words (the name and organization become the circle's accessible name); one place, no information lost
//   * buildAccount / wireAccountMenu on a tiny fake DOM (no browser here): the circle is a real button with an accessible name, aria-expanded and aria-controls; the label mirrors it;
//     click / Enter / Space toggles, Escape closes and puts focus back on the circle, a click elsewhere closes, focus leaving the control closes, wiring twice does not stack listeners
//   * the page's own source and stylesheet, for what cannot run without a browser: app.js uses the control and no longer prints the text beside the circle, the edit page's guard does not hold the circle back,
//     the stylesheet has the label, the hover rule for real pointers only, the keyboard-focus rule, the wrap and narrow layout
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACCOUNT, accountText, buildAccount, wireAccountMenu } from "../js/account-menu.js";
import { initials } from "../js/format.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// ---- a tiny fake DOM: elements with attributes, a class list, children, listeners, focus
class El {
  constructor(tag, doc) { this.tag = tag; this.doc = doc; this.attrs = {}; this.cls = new Set(); this.children = []; this.parentNode = null; this.listeners = {}; this.textContent = ""; this.classList = {
    toggle: (c, on) => { const want = on === undefined ? !this.cls.has(c) : !!on; if (want) this.cls.add(c); else this.cls.delete(c); return want; }, add: (c) => this.cls.add(c), remove: (c) => this.cls.delete(c), contains: (c) => this.cls.has(c) }; }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  append(...kids) { for (const k of kids) { if (k === null || k === undefined) continue; if (typeof k === "string") { const t = new El("#text", this.doc); t.textContent = k; this.children.push(t); t.parentNode = this; } else { this.children.push(k); k.parentNode = this; } } }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); } removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter((x) => x !== f); }
  dispatch(t, ev) { const e = Object.assign({ type: t, target: this, preventDefault() { this.defaultPrevented = true; } }, ev || {}); for (let n = this; n; n = n.parentNode) { for (const f of (n.listeners[t] || []).slice()) f(e); } if (t === "click" || t === "keydown" || t === "focusout") for (const f of (this.doc.listeners[t] || []).slice()) f(e); return e; }
  focus() { const old = this.doc.activeElement; this.doc.activeElement = this; if (old && old !== this) old.dispatch("focusout", { relatedTarget: this }); }
  text() { return (this.textContent || "") + this.children.map((c) => c.text()).join(""); }
  matches() { return false; }
}
function fakeDoc() {
  const doc = { listeners: {}, activeElement: null,
    addEventListener(t, f) { (doc.listeners[t] = doc.listeners[t] || []).push(f); }, removeEventListener(t, f) { doc.listeners[t] = (doc.listeners[t] || []).filter((x) => x !== f); },
    createElement: (tag) => new El(tag, doc) };
  const h = (tag, attrs, ...kids) => { const el = new El(tag, doc); for (const [k, v] of Object.entries(attrs || {})) { if (v === false || v === null || v === undefined) continue; if (k === "class") String(v).split(" ").forEach((c) => el.cls.add(c)); else if (k === "text") el.textContent = String(v); else el.setAttribute(k, v === true ? "" : v); } el.append(...kids.flat(Infinity)); return el; };
  return { doc, h };
}
const mount = (name, org) => { const { doc, h } = fakeDoc(); const parts = buildAccount(h, initials, name, org); const api = wireAccountMenu(parts, doc); const outside = h("a", { href: "x" }, "elsewhere"); return { doc, h, parts, api, outside }; };

// ---- the words
test("accountText: the name and organization become one accessible name; spaces are tidied; no organization and no name are handled", () => {
  assert.equal(accountText("John Pirone", "Fight Ghost Jobs Pilot").label, "Signed in as John Pirone, Fight Ghost Jobs Pilot");
  assert.equal(accountText("  John   Pirone ", " Fight  Ghost\nJobs Pilot ").label, "Signed in as John Pirone, Fight Ghost Jobs Pilot");
  assert.equal(accountText("John Pirone", "").label, "Signed in as John Pirone", "no organization: no stray comma");
  assert.equal(accountText("John Pirone", null).label, "Signed in as John Pirone");
  assert.equal(accountText("", "Acme").label, "Signed in as Employer, Acme", "an empty name reads Employer (the page's own fallback)");
  assert.equal(accountText(undefined, undefined).name, "Employer");
  assert.equal(ACCOUNT.PREFIX, "Signed in as ");
  assert.ok(!/—/.test(JSON.stringify(accountText("A", "B"))) && !/—/.test(src("js/account-menu.js")), "no em dash");
});

test("the text is placed as text: a name or organization that looks like markup stays text", () => {
  const { parts } = mount("<img src=x onerror=alert(1)>", "<b>Acme</b>");
  assert.equal(parts.button.getAttribute("aria-label"), "Signed in as <img src=x onerror=alert(1)>, <b>Acme</b>");
  assert.equal(parts.pop.children.length, 2);
  assert.equal(parts.pop.children[0].textContent, "<img src=x onerror=alert(1)>");
  assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(src("js/account-menu.js")));
});

// ---- the elements
test("the circle is a real button with the initials, the full accessible name, aria-expanded and aria-controls; the label mirrors it and is hidden from screen readers (no double reading)", () => {
  const { parts } = mount("John Pirone", "Fight Ghost Jobs Pilot");
  const { root, button, pop } = parts;
  assert.equal(button.tag, "button"); assert.equal(button.getAttribute("type"), "button");
  assert.ok(button.cls.has("avatar") && button.cls.has("avatar-btn"));
  assert.equal(button.text(), "JP", "the initials are what is drawn");
  assert.equal(button.getAttribute("aria-label"), "Signed in as John Pirone, Fight Ghost Jobs Pilot", "no information lost: a screen reader gets the full name and organization");
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(button.getAttribute("aria-controls"), pop.getAttribute("id")); assert.equal(pop.getAttribute("id"), ACCOUNT.POP_ID);
  assert.equal(pop.getAttribute("aria-hidden"), "true");
  assert.deepEqual(pop.children.map((c) => c.textContent), ["John Pirone", "Fight Ghost Jobs Pilot"]);
  assert.equal(root.children.length, 2); assert.equal(root.children[0], button); assert.equal(root.children[1], pop); assert.ok(root.cls.has("nav-account"));
  assert.equal(buildAccount(fakeDoc().h, initials, "Solo Name", "").pop.children.length, 1, "no organization: one line in the label");
});

// ---- the behaviour
test("a click (and so Enter and Space on a real button) opens and closes the label and keeps aria-expanded in step", () => {
  const { parts, api } = mount("John Pirone", "Acme");
  assert.equal(api.isOpen(), false); assert.equal(parts.pop.cls.has("open"), false);
  const e1 = parts.button.dispatch("click"); assert.equal(e1.defaultPrevented, true);
  assert.equal(api.isOpen(), true); assert.ok(parts.pop.cls.has("open")); assert.equal(parts.button.getAttribute("aria-expanded"), "true");
  parts.button.dispatch("click");
  assert.equal(api.isOpen(), false); assert.equal(parts.pop.cls.has("open"), false); assert.equal(parts.button.getAttribute("aria-expanded"), "false");
  assert.ok(!/key === "Enter"|key === " "/.test(src("js/account-menu.js")), "Enter and Space are the browser's own (a real button), not re-implemented");
});

test("Escape closes the label, puts focus back on the circle and keeps the hover / focus label dismissed until the pointer or focus leaves", () => {
  const { doc, parts, api, outside } = mount("John Pirone", "Acme");
  parts.button.dispatch("click"); outside.focus();                         // focus is somewhere else on the page
  assert.equal(doc.activeElement, outside);
  doc.listeners.keydown[0]({ key: "Escape", preventDefault() {} });
  assert.equal(api.isOpen(), false); assert.equal(parts.button.getAttribute("aria-expanded"), "false"); assert.equal(doc.activeElement, parts.button, "focus returns to the circle");
  assert.ok(parts.pop.cls.has("dismissed"), "dismissed: the label stays hidden although the circle has focus");
  parts.root.dispatch("mouseleave"); assert.equal(parts.pop.cls.has("dismissed"), false, "the pointer left: the label can show again");
  parts.button.dispatch("click"); assert.ok(parts.pop.cls.has("open") && !parts.pop.cls.has("dismissed"), "opening clears dismissed");
  doc.listeners.keydown[0]({ key: "a", preventDefault() {} }); assert.equal(api.isOpen(), true, "other keys do nothing");
});

test("a click elsewhere closes it (without stealing focus); a click inside the control does not; focus leaving the control closes it, focus moving inside it does not", () => {
  const { doc, parts, api, outside } = mount("John Pirone", "Acme");
  parts.button.dispatch("click"); assert.equal(api.isOpen(), true);
  doc.listeners.click[0]({ target: parts.pop }); assert.equal(api.isOpen(), true, "inside the control (the label)");
  doc.listeners.click[0]({ target: outside }); assert.equal(api.isOpen(), false, "outside");
  parts.button.dispatch("click"); parts.root.dispatch("focusout", { relatedTarget: parts.pop }); assert.equal(api.isOpen(), true, "focus moved within the control");
  parts.root.dispatch("focusout", { relatedTarget: outside }); assert.equal(api.isOpen(), false, "focus moved to something else (Tab to Sign out)");
  parts.button.dispatch("click"); parts.root.dispatch("focusout", { relatedTarget: null }); assert.equal(api.isOpen(), true, "no related target (the window lost focus): left as it is");
});

test("mounting the account twice (a page that does it again) removes the first wiring: no stacked listeners, only the new control reacts", () => {
  const { doc, h } = fakeDoc();
  const a = buildAccount(h, initials, "John Pirone", "Acme"), b = buildAccount(h, initials, "John Pirone", "Acme");
  wireAccountMenu(a, doc); assert.equal(doc.listeners.keydown.length, 1); assert.equal(doc.listeners.click.length, 1);
  const apiB = wireAccountMenu(b, doc); assert.equal(doc.listeners.keydown.length, 1, "the first keydown listener was removed"); assert.equal(doc.listeners.click.length, 1);
  a.button.dispatch("click"); assert.equal(a.pop.cls.has("open"), false, "the replaced control does nothing");
  b.button.dispatch("click"); assert.equal(apiB.isOpen(), true);
});

// ---- the page's own source and stylesheet
test("app.js builds the signed-in area from the control: the circle, no name or organization printed beside it, no inline margins, a wrapping area; Sign out and Email confirmed stay", () => {
  const js = src("js/app.js");
  assert.match(js, /import \{ buildAccount, wireAccountMenu \} from "\.\/account-menu\.js";/);
  assert.match(js, /const account = buildAccount\(h, initials, name, org\);/);
  assert.match(js, /container\.append\([\s\S]*?"My openings"[\s\S]*?"Analytics"[\s\S]*?"Team"[\s\S]*?account\.root,[\s\S]*?"Sign out"[\s\S]*?\);\s*wireAccountMenu\(account, document\);/);
  assert.ok(!/name \+ \(org \? " · " \+ org : ""\)/.test(js) && !js.includes('" · "'), "the text is no longer printed beside the circle");
  assert.ok(!/class: "nav-account"/.test(js), "the old span with the printed text is gone");
  assert.equal((js.match(/container\.classList\.add\("nav-acct-area"\)/g) || []).length, 2, "both signed-in areas (employer and candidate) wrap");
  assert.ok(!/margin-right:14px|margin-left:14px/.test(js), "spacing comes from the stylesheet gap, not inline margins");
  assert.match(js, /"Email confirmed"/); assert.match(js, /h\("button", \{ type: "button", class: "btn btn-ghost btn-sm", onclick: async \(\) => \{ await signOut\(\); forgetLocalState\(\); go\("index\.html"\); \} \}, "Sign out"\)/);
});

test("the edit page's leave guard holds back Sign out but NOT the initials circle (which only opens a label)", () => {
  const js = src("js/pages/edit.js");
  assert.ok(js.includes('t.closest("#navAccount button:not(.avatar-btn)")'));
});

test("the stylesheet: the label, hover only for real pointers, the keyboard-focus label, Escape dismissal, a bigger hit area, the wrapping area and the narrow layouts", () => {
  const css = src("app.css");
  assert.match(css, /\.account-pop\{display:none;position:absolute;top:calc\(100% \+ 10px\);right:0;z-index:30;/);
  assert.match(css, /\.account-pop\.open,\.avatar-btn:focus-visible\+\.account-pop\{display:block\}/, "an open label and a keyboard-focused circle show it");
  assert.match(css, /@media \(hover:hover\)\{\.nav-account:hover \.account-pop\{display:block\}\}/, "hover only where a pointer can hover (a touch screen would keep it stuck open)");
  assert.match(css, /\.account-pop\.dismissed\{display:none!important\}/);
  assert.match(css, /\.avatar-btn::before\{content:"";position:absolute;inset:-6px\}/, "the circle's touch target is bigger than the drawn circle (44 pixels)");
  assert.match(css, /\.nav-acct-area\{[^}]*flex-wrap:wrap[^}]*\}/);
  assert.match(css, /@media \(max-width:1300px\)\{\.nav\{padding:0 24px\}/);
  assert.match(css, /@media \(max-width:1080px\)\{\.nav\{height:auto;min-height:72px;flex-wrap:wrap;/);
  assert.match(css, /a:focus-visible,button:focus-visible/, "a visible focus outline for every button, the circle included");
  assert.ok(!/\.nav-account\+\.btn\{margin-left/.test(css), "the old margin rule that depended on the printed text is gone");
});
