// fake-dom.js - a tiny fake DOM, just what js/dom.js and the rows panels (js/row-panel.js and its three profiles) use, for tests that run in Node with no browser (prompt BC, October 10, 2026).
// Importing this file installs globalThis.Node and globalThis.document. Nothing here touches a network.
export class FNode {}
export class FText extends FNode { constructor(t) { super(); this.data = String(t); this.parent = null; } get textContent() { return this.data; } }
export class FEl extends FNode {
  constructor(tag) { super(); this.tag = tag; this.attrs = {}; this.children = []; this.listeners = {}; this.parent = null; this.value = ""; this.disabled = false; this.className = ""; }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } removeAttribute(k) { delete this.attrs[k]; }
  get hidden() { return "hidden" in this.attrs; } set hidden(v) { if (v) this.attrs.hidden = ""; else delete this.attrs.hidden; }
  append(...kids) { for (const k of kids) { const n = k instanceof FNode ? k : new FText(k); if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = this; this.children.push(n); } }
  replaceChildren() { for (const c of this.children) c.parent = null; this.children = []; }
  get textContent() { return this.children.map((c) => c.textContent).join(""); } set textContent(v) { this.replaceChildren(); this.append(String(v)); }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  async fire(t) { for (const fn of this.listeners[t] || []) await fn({ preventDefault() {} }); }
  focus() { globalThis.document.activeElement = this; }
}
globalThis.Node = FNode;
globalThis.document = { createElement: (t) => new FEl(t), createTextNode: (t) => new FText(t), activeElement: null };

export const all = (el, pred, out = []) => { if (el instanceof FEl) { if (pred(el)) out.push(el); for (const c of el.children) all(c, pred, out); } return out; };
export const byClass = (el, cls) => all(el, (e) => e.className.split(" ").includes(cls));
export const byTag = (el, tag) => all(el, (e) => e.tag === tag);
export const visible = (el) => { for (let e = el; e; e = e.parent) if (e.hidden) return false; return true; };
export const text = (el) => all(el, (e) => visible(e) && e !== el && e.children.some((c) => c instanceof FText)).map((e) => e.children.filter((c) => c instanceof FText).map((c) => c.data).join("")).join(" | ");
export const serialize = (el) => JSON.stringify(all(el, () => true).map((e) => [e.tag, e.attrs, e.value, e.children.filter((c) => c instanceof FText).map((c) => c.data)]));
export const btn = (el, name) => byTag(el, "button").find((b) => b.attrs["aria-label"] === name || (!b.attrs["aria-label"] && b.children.map((c) => c.textContent).join("") === name));
export const rowEl = (host, n) => byClass(host, "link-row").find((r) => r.attrs["data-position"] === String(n));
export const win = () => ({ closed: false, opener: "the-opener", location: null, closeCalls: 0, close() { this.closed = true; this.closeCalls++; } });
