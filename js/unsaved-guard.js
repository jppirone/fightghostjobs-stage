// unsaved-guard.js - the edit page's protection against leaving with work that was never saved: the bar that stays at the bottom of the window, the browser's own leave-page question (beforeunload),
// and a dialog of our own (Save, Discard, Stay) for the links and buttons of this page. What counts as "unsaved" and every sentence are in js/dirty-state.js; the page decides WHAT is unsaved (getModel).
// Everything is built from elements the page already has (edit.html); nothing is created from HTML, nothing is stored, nothing is sent anywhere.
//
// ctx: { win, root, bar, head, detail, live, saveBtn, discardBtn, dlg: { overlay, title, text, save, discard, stay },
//        getModel(): { form, panels, status, noteMissing, noteRequired },   save(): Promise<boolean> (true when the main form was saved),   discard(): void,
//        go(url), activeElement(): the focused element, confirmDiscard(): boolean, rescueFocus(): where focus goes when the bar closes with focus inside it }
//   win: needs addEventListener / removeEventListener (the window); root: the <html> element (gets the class unsaved-on while the bar shows)
// -> { refresh, isDirty, summary, announce, hush, interceptClick, openDialog, dialogOpen, allowLeave }
import { summarize, linkLeaves, UNSAVED } from "./dirty-state.js";

// is node inside ancestor (works on a real DOM and on the small fake the tests use)
const within = (node, ancestor) => { for (let n = node; n; n = n.parentNode || n.parent) if (n === ancestor) return true; return false; };
const isBody = (el) => !el || String(el.tagName || el.tag || "").toUpperCase() === "BODY";

export function mountUnsavedGuard(ctx) {
  const { win, root, bar, head, detail, live, saveBtn, discardBtn, dlg } = ctx;
  let listening = false, leaving = false, lastLive = "", dialog = null, bypass = false, busy = false, hushed = false;

  const summary = () => summarize(ctx.getModel());
  function onBeforeUnload(ev) { if (leaving) return undefined; ev.preventDefault(); ev.returnValue = ""; return ""; }

  // redraw the bar and the leave-page warning from the page's current state; call it after anything that can change it. { quiet: true }: the caller says something itself about the bar going away (a discard)
  // A screen reader is told once when the bar appears (what is unsaved) and once when it goes away (UNSAVED.CLEARED); focus never moves for either.
  function refresh(opts) {
    const s = summary(), quiet = hushed || !!(opts && opts.quiet), wasShown = !bar.hidden;
    const hadFocus = !s.any && within(ctx.activeElement(), bar);
    bar.hidden = !s.any;
    if (root && root.classList) root.classList.toggle("unsaved-on", s.any);
    if (s.any) { head.textContent = s.headline; detail.textContent = s.detail; saveBtn.hidden = !s.showSave; }
    // what the status says: the unsaved-changes message while the bar shows; when it has just closed, UNSAVED.CLEARED (or nothing, when the page says its own sentence); after that it is left alone, so the closing message is not wiped by the next refresh
    const say = s.any ? s.liveText : (wasShown ? (quiet ? "" : UNSAVED.CLEARED) : null);
    if (say !== null && say !== lastLive) { live.textContent = say; lastLive = say; }          // told once per change of meaning, not on every keystroke
    if (s.any && !listening) { win.addEventListener("beforeunload", onBeforeUnload); listening = true; }
    else if (!s.any && listening) { win.removeEventListener("beforeunload", onBeforeUnload); listening = false; }
    if (hadFocus && ctx.rescueFocus) ctx.rescueFocus();                          // the bar closed under the focus: keyboard users are not left on nothing
    return s;
  }

  // ---- the dialog: Save, Discard, Stay. Focus goes to Stay (the choice that loses nothing); Escape is Stay; Tab stays inside; focus goes back to what opened it.
  function openDialog(proceed, opener) {
    const s = summary();
    if (!s.any) { proceed(); return; }
    dialog = { proceed, returnTo: opener || ctx.activeElement() };
    dlg.title.textContent = s.dialogTitle; dlg.text.textContent = s.dialogText;
    dlg.save.hidden = !s.leaveCanSave; dlg.save.textContent = s.leaveSaveLabel;
    dlg.overlay.hidden = false;
    dlg.stay.focus();
  }
  function closeDialog(restoreFocus) {
    const d = dialog; dialog = null; dlg.overlay.hidden = true;
    if (restoreFocus && d && d.returnTo && d.returnTo.focus) d.returnTo.focus();
  }
  const setDialogBusy = (on) => { busy = on; dlg.save.disabled = on; dlg.discard.disabled = on; dlg.stay.disabled = on; };

  dlg.stay.addEventListener("click", () => { if (dialog && !busy) closeDialog(true); });
  dlg.discard.addEventListener("click", () => {
    if (!dialog || busy) return;
    const d = dialog; leaving = true; closeDialog(false); d.proceed();            // leaving on purpose: the browser's own question is not asked a second time
  });
  dlg.save.addEventListener("click", async () => {
    if (!dialog || busy) return;
    setDialogBusy(true);
    let ok = false;
    try { ok = await ctx.save(); } finally { setDialogBusy(false); }
    const d = dialog; if (!d) return;
    if (ok && !summary().any) { leaving = true; closeDialog(false); d.proceed(); return; }
    // not saved (the page shows why, and has put the focus on the field), or something else is still unsaved (the bar says what): the person stays
    const a = ctx.activeElement();
    closeDialog(within(a, dlg.overlay) || isBody(a));
    refresh();
  });
  dlg.overlay.addEventListener("keydown", (ev) => {
    if (!dialog) return;
    if (ev.key === "Escape") { ev.preventDefault(); if (!busy) closeDialog(true); return; }
    if (ev.key === "Tab") {
      const items = [dlg.save, dlg.discard, dlg.stay].filter((b) => !b.hidden && !b.disabled);
      ev.preventDefault();
      if (!items.length) return;
      const i = items.indexOf(ctx.activeElement());
      items[ev.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i < 0 || i === items.length - 1 ? 0 : i + 1)].focus();
    }
  });

  // ---- the bar's buttons
  saveBtn.addEventListener("click", async () => { if (busy) return; busy = true; try { await ctx.save(); } finally { busy = false; refresh(); } });
  discardBtn.addEventListener("click", () => { if (busy) return; if (!ctx.confirmDiscard()) return; ctx.discard(); });

  // a click on a link or a button of this page that leaves it: ask first. target: { kind: "link", href, target, download, el } | { kind: "button", el } (a button such as Sign out, which leaves the page itself)
  // -> true when the click was held back (the dialog is open)
  function interceptClick(ev, target) {
    if (bypass || dialog || !target || !summary().any) return false;
    if (target.kind === "link" && !linkLeaves(ev, target)) return false;
    ev.preventDefault();
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    openDialog(target.kind === "link" ? () => ctx.go(target.href) : () => { bypass = true; try { target.el.click(); } finally { bypass = false; } }, target.el);
    return true;
  }

  // say something to a screen reader through the polite live region (told once; the next refresh clears it)
  const announce = (text) => { live.textContent = text; lastLive = text; };
  // hush(true) while the page itself is about to say why the bar goes away (a discard redraws the form, which closes the bar before the discard sentence is spoken): the closing is not announced as well
  const hush = (on) => { hushed = !!on; };
  return { refresh, summary, announce, hush, isDirty: () => summary().any, interceptClick, openDialog, dialogOpen: () => dialog !== null, allowLeave: () => { leaving = true; } };
}
