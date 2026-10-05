// search-status.js - the ONE spoken message after a search (October 5, 2026; John's keyboard-only pass on stage, October 4, 2026). A screen-reader user pressed Search and heard nothing: the result count was a plain line that
// appeared on the page. This is a polite status message (role="status" on #searchStatus in search.html, kept in the page from the start, so a screen reader is already listening when its text changes).
// It never moves focus. It is told ONCE per search: the message is emptied when a search starts, and set when the search finishes (a short moment later, so a screen reader sees a change even when the words
// are the same as last time, for example the same search twice). A search that stops on a message (a missing company, a rate limit, "verify your email first") says nothing here: those messages announce themselves.
//   makeAnnouncer(el, win) -> { announce(text), clear() }
// HOW PART C TAKES THIS OVER: the recap box (Part C) changes exactly ONE line, in showResults() of js/pages/search.js: the text handed to announce() becomes the recap sentence and "results are below" instead of the count,
// so there is still one message per search, from this same element; the count is not announced as well because nothing else calls announce().
export const ANNOUNCE_DELAY_MS = 60;

export function makeAnnouncer(el, win) {
  let timer = null;
  const stop = () => { if (timer !== null) { win.clearTimeout(timer); timer = null; } };
  return {
    clear() { stop(); el.textContent = ""; },
    announce(text) { stop(); el.textContent = ""; timer = win.setTimeout(() => { timer = null; el.textContent = text; }, ANNOUNCE_DELAY_MS); },
  };
}
