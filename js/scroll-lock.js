// scroll-lock.js - keeps the page behind a dialog from scrolling while the dialog is open (October 4, 2026), and puts everything back exactly when it closes.
// What it does: html and body get overflow hidden (the page cannot scroll, the scroll position is NOT touched, so nothing jumps and the dialog itself does not move). On a window with a classic scrollbar the scrollbar's width is
// added to the body's right padding for as long as the lock lasts, so the page does not shift sideways when the scrollbar disappears. unlock() restores the inline values that were there before (an empty value stays empty).
// What it does not do: it is not position:fixed on the body (that variant needs the scroll position saved and restored by hand and makes iPhone Safari jump); the dialog's own box scrolls (overflow-y auto) and the stylesheet
// keeps a swipe on the dark backdrop from chaining to the page (touch-action and overscroll-behavior in app.css).
export function lockScroll(doc, win) {
  const html = doc.documentElement, body = doc.body;
  const prev = { html: html.style.overflow, body: body.style.overflow, pad: body.style.paddingRight };
  const bar = Math.max(0, win.innerWidth - html.clientWidth);   // 0 for overlay scrollbars (phones) and when the page has none
  if (bar > 0) body.style.paddingRight = (parseFloat(win.getComputedStyle(body).paddingRight) || 0) + bar + "px";
  html.style.overflow = "hidden"; body.style.overflow = "hidden";
  let done = false;
  return function unlock() {
    if (done) return; done = true;
    html.style.overflow = prev.html; body.style.overflow = prev.body; body.style.paddingRight = prev.pad;
    if (body.getAttribute("style") === "") body.removeAttribute("style");
    if (html.getAttribute("style") === "") html.removeAttribute("style");
  };
}
