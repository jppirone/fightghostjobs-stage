// info-box.js - the small box behind an "i" icon (prompt LM, October 23, 2026). It REUSES the pieces the site already has: the round "i" of the info icons (class info-icon, same look and same larger touch area),
// the window frame of the details window (class modal in a modal-backdrop), the focus handling of js/dialog-focus.js (focus goes into the box, Tab stays in it, the page behind is inert, focus goes back to the control that
// opened it) and the scroll lock of js/scroll-lock.js. What it adds is only the glue: a title, a close control, Escape, and a click outside the box.
//   infoBoxIcon({ label, title, body })  -> the "i" (a keyboard-reachable button that says it opens a dialog); body is a function that returns the nodes to show, called each time the box opens
//   openInfoBox({ title, nodes, opener }) -> opens the box over whatever is on the page (also over the details window, which keeps its own focus loop under it)
// Only one box is open at a time. Everything shown is built by h() from text (never HTML), so words an employer typed can never become markup or a link.
import { h } from "./dom.js?v=5c78a8cd";
import { trapFocus } from "./dialog-focus.js?v=f788366d";
import { lockScroll } from "./scroll-lock.js?v=b751eb4c";

let current = null;   // { close } of the box that is open

export function closeInfoBox() { if (current) current.close(); }

export function openInfoBox({ title, nodes, opener, doc = document, win = window }) {
  closeInfoBox();
  const titleId = "infoBoxTitle";
  const closeBtn = h("button", { type: "button", class: "btn btn-ghost btn-sm info-box-close", "aria-label": "Close" }, "✕");
  const dialog = h("div", { class: "modal info-box", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId },
    h("div", { class: "info-box-head" }, h("div", { id: titleId, class: "info-box-title" }, title), closeBtn),
    h("div", { class: "info-box-body" }, ...nodes));
  const backdrop = h("div", { class: "modal-backdrop open info-box-backdrop" }, dialog);
  doc.body.append(backdrop);
  const unlock = lockScroll(doc, win);
  const release = trapFocus({ doc, dialog, backdrop, opener, fallback: null });
  let done = false;
  const close = () => {
    if (done) return; done = true;
    doc.removeEventListener("keydown", onKey, true);
    backdrop.remove();
    unlock();
    release();   // the page is live again and focus is back on the control that opened the box
    if (current && current.close === close) current = null;
  };
  // Escape closes THIS box only: it is caught first and stopped, so the details window under it (which closes on Escape) stays open
  const onKey = (ev) => { if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); close(); } };
  doc.addEventListener("keydown", onKey, true);
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", (ev) => { if (ev.target === backdrop) close(); });
  current = { close };
  return { close, dialog };
}

export function infoBoxIcon({ label, title, body }) {
  const icon = h("span", { class: "info-icon info-box-icon", tabindex: "0", role: "button", "aria-label": label, "aria-haspopup": "dialog" }, "i");
  const open = (ev) => { ev.preventDefault(); ev.stopPropagation(); openInfoBox({ title, nodes: body(), opener: icon }); };
  icon.addEventListener("click", open);
  icon.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") open(ev); });
  return icon;
}
