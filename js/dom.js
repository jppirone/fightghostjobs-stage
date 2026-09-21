// dom.js - the ONLY way pages put data on the screen.
// Everything a person or the backend supplies (posting titles, company names, comments, labels, error text) is UNTRUSTED: it is inserted as text nodes / attribute values,
// never as HTML. There is no innerHTML anywhere in this site (tests/site-check.js fails the build if one appears).

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

// Only a same-site relative path or an https URL may ever become a link target.
export function safeHref(url) {
  if (typeof url !== "string") return null;
  if (/^[a-z0-9][a-z0-9._/-]*(\?[a-z0-9=&._%-]*)?(#[a-z0-9_-]*)?$/i.test(url)) return url;          // relative page, e.g. "search.html?ref=abc"
  try { const u = new URL(url); return u.protocol === "https:" ? u.href : null; } catch { return null; }
}

// h("div", { class: "chip", style: "font-weight:700;" }, "text", childNode, [more, nodes])
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === "class") el.className = String(v);
    else if (k === "text") el.textContent = String(v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "href") { const s = safeHref(String(v)); if (s !== null) el.setAttribute("href", s); }
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el) { el.replaceChildren(); return el; }
export function show(el, on = true) { el.hidden = !on; return el; }

// The small "i" with its tooltip, exactly as designed (mouse-over or keyboard focus).
export function infoIcon(tooltip) {
  return h("span", { class: "info-icon", tabindex: "0", "aria-label": tooltip }, "i", h("span", { class: "info-tooltip", role: "tooltip" }, tooltip));
}

// One chip. spec = { text, bold?, tooltip? }
export function chip(spec) {
  return h("div", { class: "chip", style: spec.bold ? "font-weight:700;" : false }, spec.text, spec.tooltip ? infoIcon(spec.tooltip) : null);
}

// A message box (errors, notices). kind: "error" | "notice" | "ok"
export function alertBox(kind, text) {
  return h("div", { class: "alert alert-" + kind, role: kind === "error" ? "alert" : "status" }, text);
}
