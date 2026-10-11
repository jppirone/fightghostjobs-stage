// focus-ring.js - the button that has the cursor when a dialog opens shows its ring at once (prompt BK, October 11, 2026).
// Why: the site draws a ring on :focus-visible, and a browser does not treat a focus set by script as "visible" when the dialog was opened with a mouse click, so the cursor was on the button and nothing showed it.
// This puts the same ring (the .focus-ring class in app.css: the same colour and width as the :focus-visible rule) on the button the dialog chose and takes it off when the cursor leaves. It never decides WHICH
// button gets the cursor: the caller names it. (js/dialog-focus.js is the other module about dialogs: the focus trap of the details window.)
export function focusWithRing(el) {
  if (!el || typeof el.focus !== "function") return;
  el.focus();
  if (!el.classList) return;
  el.classList.add("focus-ring");
  const off = () => { el.classList.remove("focus-ring"); if (el.removeEventListener) el.removeEventListener("blur", off); };
  if (el.addEventListener) el.addEventListener("blur", off);
}
