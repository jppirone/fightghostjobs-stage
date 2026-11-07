// signin-handoff.js - what a sign-in by emailed link has to carry from the tab that asked for the link to the tab the email opens it in (October 4, 2026).
//
// The webmail site (Yahoo, Gmail) opens the emailed link in a NEW tab. A new tab starts with empty sessionStorage, so anything kept there (the search the person had typed, the page they came from) was lost.
// Two things are therefore kept in localStorage, which every tab of the same browser can read:
//   - the search typed before the sign-in (company, req number, title): "pending search";
//   - the page to land on after the link: "landing page".
// Both expire after one hour, are removed as soon as they are used (and on sign-out), and NEVER leave the browser: nothing here is sent to the server, put in the emailed link or in the redirect address.
// A different BROWSER (for example the phone's mail app opening Safari while the search was typed in Chrome) has a different localStorage: nothing can be carried across; the page falls back to its defaults.
//
// The second part is the other direction: the tab that asked for the link never hears about the sign-in done in the other tab unless it listens. watchSignIn lets a page notice a sign-in completed
// elsewhere (the Auth client stores the session in localStorage, so the browser's "storage" event reaches every other tab; coming back to the tab is checked as well, in case an event was missed).
//
// Pure functions over an injected storage / window, so they are unit tested without a browser; the browser test (tests/signin-tabs.test.js) proves it with two real tabs.
import { requestOrigin } from "./search-origin.js?v=b0cdfe2e";
import { limitSource } from "./source-clean.js?v=228d1fb3";

export const HANDOFF_TTL_MS = 60 * 60 * 1000;
export const PENDING_SEARCH_KEY = "fgj-pending-search";
export const LANDING_PAGE_KEY = "fgj-landing-page";
const MAX_FIELD = 300;

function write(store, key, value, now) {
  try { store.setItem(key, JSON.stringify({ v: value, exp: now + HANDOFF_TTL_MS })); return true; } catch { return false; }
}
// returns the value and REMOVES the entry (used, expired or damaged alike); null when there is nothing valid
function take(store, key, now) {
  try {
    const raw = store.getItem(key);
    if (raw === null || raw === undefined) return null;
    store.removeItem(key);
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object" || typeof o.exp !== "number" || !(o.exp > now)) return null;
    return o.v === undefined ? null : o.v;
  } catch { return null; }
}
function drop(store, key) { try { store.removeItem(key); } catch { /* ignore */ } }

const isText = (x) => typeof x === "string" && x.length <= MAX_FIELD;

// prompt IA (November 1, 2026): the saved search also holds WHERE the search was asked from, so that the search that runs by itself after the emailed link (often in a new tab, which has forgotten it) is counted the same way: only the origin
// word (site, extension or mobile) and, for the extension alone, the cleaned host of the job page. Nothing else is added (the KIO title words the extension path holds are not saved). Both are checked again through requestOrigin when they are
// saved and when they are read back; a value saved before this change has no origin and is read as site, and a damaged or unknown word is read as site: never an error.
const originOfSaved = (o, h) => { const f = requestOrigin({ origin: o, host: h }); return { origin: f.origin, host: f.origin_host === undefined ? null : f.origin_host }; };
// the source is part of the saved search ONLY when there is one (a search with none is saved and read back exactly as before)
const sourceOfSaved = (s) => { const v = limitSource(s); return v === "" ? {} : { source: v }; };
export function savePending(store, p, now = Date.now()) {
  if (!p || !isText(p.company) || !isText(p.q) || !(p.r === undefined || isText(p.r))) return false;
  // prompt JD (November 7, 2026): the optional source (where the person found the job) rides in the saved search too, limited the same way (js/source-clean.js), so a first time person, who always searches signed out first, does not lose it. One hour, removed when used, like the rest.
  return write(store, PENDING_SEARCH_KEY, { company: p.company, q: p.q, r: p.r === undefined ? "" : p.r, ...originOfSaved(p.origin, p.host), ...sourceOfSaved(p.source) }, now);
}
export function takePending(store, now = Date.now()) {
  const v = take(store, PENDING_SEARCH_KEY, now);
  return v && isText(v.company) && isText(v.q) && isText(v.r) ? { company: v.company, q: v.q, r: v.r, ...originOfSaved(v.origin, v.host), ...sourceOfSaved(v.source) } : null;
}
export const hasPending = (store, now = Date.now()) => { try { const o = JSON.parse(store.getItem(PENDING_SEARCH_KEY) || "null"); return !!(o && typeof o.exp === "number" && o.exp > now); } catch { return false; } };

// only a plain same-site page name is ever followed (the same pattern session.js takeNext applies)
export const SAFE_PAGE = /^[a-z0-9-]+\.html(\?[a-z0-9=&._%-]*)?$/i;
// The staff view's address parameter (October 9, 2026) may ride along in the kept landing page, and in exactly one form: scope=all, once. A page with any other scope value, an empty one or a repeated one is not followed at all (the
// person lands on the default page, which is the live-only view). Staff status itself is still decided by the database, never by this parameter.
export function scopeParamOk(page) {
  try { const q = String(page).split("?")[1]; if (q === undefined) return true; const all = new URLSearchParams(q).getAll("scope"); return all.length === 0 || (all.length === 1 && all[0] === "all"); } catch { return false; }
}
export const isSafePage = (page) => typeof page === "string" && SAFE_PAGE.test(page) && scopeParamOk(page);
export function saveLanding(store, page, now = Date.now()) { return isSafePage(page) ? write(store, LANDING_PAGE_KEY, page, now) : false; }
export function takeLanding(store, now = Date.now()) { const v = take(store, LANDING_PAGE_KEY, now); return isSafePage(v) ? v : null; }

export function clearHandoff(store) { drop(store, PENDING_SEARCH_KEY); drop(store, LANDING_PAGE_KEY); }

// ---- noticing a sign-in completed in another tab -------------------------------------------------------------------------------------------------------------------------------------------------
// check: async () => the current session or null.  onSignedIn(session): called once a session shows up that `accept` (default: any) takes; then the listeners are removed.
// A session that `accept` refuses (for example an employer session on a candidate page) keeps the watch alive. Returns stop().
export function watchSignIn({ win, doc, storageKey, check, onSignedIn, accept = (s) => !!s }) {
  let done = false, running = false, again = false;
  const run = async () => {
    if (done) return;
    if (running) { again = true; return; }
    running = true;
    try {
      let s = null; try { s = await check(); } catch { s = null; }
      if (s && accept(s) && !done) { done = true; stop(); await onSignedIn(s); }
    } finally { running = false; if (again && !done) { again = false; run(); } }
  };
  const onStorage = (ev) => { if (ev.key === null || ev.key === storageKey) run(); };
  const onVisible = () => { if (!doc || doc.visibilityState !== "hidden") run(); };
  function stop() {
    done = true;
    try { win.removeEventListener("storage", onStorage); win.removeEventListener("focus", run); if (doc) doc.removeEventListener("visibilitychange", onVisible); } catch { /* ignore */ }
  }
  win.addEventListener("storage", onStorage); win.addEventListener("focus", run); if (doc) doc.addEventListener("visibilitychange", onVisible);
  return stop;
}
