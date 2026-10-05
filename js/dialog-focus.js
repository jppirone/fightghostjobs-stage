// dialog-focus.js - the keyboard and screen-reader side of a window that opens over the page (October 5, 2026; John's keyboard-only pass on stage, October 4, 2026). Used by the details window on the search page.
// While the window is open:
//   * focus moves INTO it (to the window itself, which has a name: the posting's title), so a keyboard or screen-reader user is not left on the button behind it;
//   * Tab and Shift+Tab stay inside it (from the last control Tab goes to the first, and Shift+Tab from the first goes to the last);
//   * everything else on the page is made inert (it cannot be reached by Tab, read by a screen reader's page cursor or clicked), and made live again exactly as it was when the window closes;
// and when it closes, focus goes back to the exact control that opened it (or, when that control is gone or disabled, to a fallback that the page names).
// What it does NOT do: it does not close the window on Escape and does not lock the page's scroll (the page does both itself; the scroll lock is js/scroll-lock.js and is untouched).
//   focusablesIn(root)                     -> the controls inside root that a keyboard can reach, in order
//   trapFocus({ doc, dialog, backdrop, opener, fallback }) -> release()      release() undoes everything and returns the focus (idempotent)
const REACHABLE = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex]';

export function focusablesIn(root) {
  return Array.from(root.querySelectorAll(REACHABLE)).filter((e) => {
    if (e.disabled || e.hidden || e.closest("[hidden],[inert]")) return false;
    const t = e.getAttribute("tabindex");
    if (t !== null && Number(t) < 0) return false;
    return e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
  });
}

export function trapFocus({ doc, dialog, backdrop, opener, fallback }) {
  // everything outside the window: the siblings of the window's backdrop, and of each of its ancestors, up to the body
  const made = [];
  for (let node = backdrop; node && node !== doc.body && node.parentElement; node = node.parentElement) {
    for (const sib of Array.from(node.parentElement.children)) {
      if (sib === node || sib.hasAttribute("inert")) continue;
      const tag = sib.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "LINK" || tag === "TEMPLATE") continue;
      sib.setAttribute("inert", ""); made.push(sib);
    }
  }
  if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
  dialog.focus({ preventScroll: true });

  const onKey = (ev) => {
    if (ev.key !== "Tab" || ev.defaultPrevented) return;
    const items = focusablesIn(dialog), first = items[0], last = items[items.length - 1], at = doc.activeElement;
    if (!items.length) { ev.preventDefault(); dialog.focus({ preventScroll: true }); return; }
    const inside = dialog.contains(at);
    if (ev.shiftKey && (!inside || at === first || at === dialog)) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && (!inside || at === last)) { ev.preventDefault(); first.focus(); }
  };
  doc.addEventListener("keydown", onKey, true);

  let done = false;
  return function release() {
    if (done) return; done = true;
    doc.removeEventListener("keydown", onKey, true);
    for (const el of made) el.removeAttribute("inert");
    const usable = (el) => !!el && el.isConnected && !el.disabled && !el.hidden && !el.closest("[hidden]");
    let target = usable(opener) ? opener : fallback || null;
    if (target && target === fallback && !target.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) target.setAttribute("tabindex", "-1");
    if (target) target.focus({ preventScroll: true });   // the page must be exactly where it was (the scroll lock hands it back untouched); focus must not scroll it
  };
}
