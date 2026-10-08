// app.js - what every page shares: the API object wired to the real session, the top-bar account area, and the "you must be signed in as ..." guards.

import { createApi, describeError, isAuthFailure } from "./api.js";
import { SUPABASE_URL, PUBLISHABLE_KEY } from "./config.js";
import { accessToken, currentSession, signOut, rememberNext } from "./session.js";
import { h, clear, alertBox } from "./dom.js";
import { takeLanded, landingText, landingKindForPage } from "./landing-notice.js";
import { initials } from "./format.js";
import { buildAccount, wireAccountMenu } from "./account-menu.js";
import { orderHeader, watchHeaderOrder } from "./header-order.js";

// the Tab order of the top bar follows what is drawn, at every width (js/header-order.js)
if (typeof document !== "undefined" && typeof window !== "undefined") watchHeaderOrder(document, window);

export const api = createApi({ baseUrl: SUPABASE_URL, key: PUBLISHABLE_KEY, getToken: accessToken });
export { describeError, isAuthFailure, currentSession, signOut };

export function go(url) { location.assign(url); }

// The employer's own name and organization, cached for a few minutes so every page does not spend one of their rate-limited calls on it.
const INFO_KEY = "fgj-poster-info";
export async function posterInfo(session, { fresh = false } = {}) {
  if (!fresh) {
    try {
      const c = JSON.parse(sessionStorage.getItem(INFO_KEY) || "null");
      if (c && c.sub === session.claims.sub && Date.now() - c.at < 5 * 60 * 1000) return { ok: true, data: c.data };
    } catch { /* no cache */ }
  }
  const r = await api.posterSession();
  if (r.ok) { try { sessionStorage.setItem(INFO_KEY, JSON.stringify({ sub: session.claims.sub, at: Date.now(), data: r.data })); } catch { /* ignore */ } }
  return r;
}

export function forgetLocalState() { try { sessionStorage.removeItem(INFO_KEY); } catch { /* ignore */ } }

// An employer page: returns { session, info } or sends the visitor to the employer sign-in page (remembering where they were going).
export async function requirePoster(thisPage) {
  const session = await currentSession();
  if (!session) { rememberNext(thisPage, "poster"); go("employer-signin.html?reason=signin"); return null; }
  if (!session.isPoster) { go("employer-signin.html?reason=notposter"); return null; }
  const r = await posterInfo(session);
  if (!r.ok) {
    if (isAuthFailure(r.error)) { await signOut(); rememberNext(thisPage, "poster"); go("employer-signin.html?reason=expired"); return null; }
    return { session, info: null, error: r.error };
  }
  return { session, info: r.data };
}

// The landing note clears on the person's first real action on the page (October 5, 2026), so it does not sit above the work for the whole visit: on the search page, typing in one of the three boxes or a search the person started
// finishing (search.js calls clearLandingNote; a search replayed by the sign-in handoff does not count, the person did nothing); on every other page, the first click or key press inside the page content (a save, a pause, a close,
// any button or field), not on the note itself. No close button, no timer, nothing is announced when it goes. (js/landing-notice.js has the words.)
let landingNoteOn = null;
export function clearLandingNote() {
  if (!landingNoteOn) return;
  const { box, off } = landingNoteOn; landingNoteOn = null; off();
  box.hidden = true; clear(box);
}
// The one-time note on the page a sign-in link lands on (landing-notice.js). The first page that builds the top bar after the link shows it, once, in #landedNotice or at the top of the main area.
function showLandingNote(session) {
  if (!session) return;
  const flag = takeLanded(sessionStorage);
  if (!flag) return;   // no sign-in link just landed here
  // the wording follows the PAGE (employer pages: the employer sentence; search: the candidate sentence), and only when the session really has that role: an employer-only session on the search page gets no landing note, because the
  // search page already says plainly that an employer session cannot search (one notice, not two). A page that is neither kind falls back on the flag the callback left.
  const kind = landingKindForPage(location.pathname, location.search) || flag;
  const text = kind === "candidate" && session.isCandidate ? landingText("candidate") : kind === "poster" && session.isPoster ? landingText("poster") : null;
  if (!text) return;
  let box = document.getElementById("landedNotice");
  if (!box) {
    const main = document.getElementById("main"); if (!main) return;
    box = h("div", { id: "landedNotice", class: "pg", style: "padding:24px 32px 0 32px;max-width:1440px;margin:0 auto;" });
    main.insertBefore(box, main.firstChild);
  }
  box.hidden = false; clear(box); box.append(alertBox("ok", text));
  const onAct = (ev) => { const main = document.getElementById("main"), t = ev.target; if (t && t.nodeType === 1 && main && main.contains(t) && !box.contains(t)) clearLandingNote(); };
  const off = () => { for (const t of ["click", "keydown"]) document.removeEventListener(t, onAct, true); };
  landingNoteOn = { box, off };
  if (!/search\.html$/.test(location.pathname)) for (const t of ["click", "keydown"]) document.addEventListener(t, onAct, true);   // the search page clears it from search.js (typing, or a search the person started)
}

// The right-hand side of the top bar. Signed-in employer: the links, the initials circle (the control: name and organization are its accessible name and its label, see account-menu.js) and Sign out.
// Anyone else: the "Register a Posting" call to action.
export async function mountAccount(container, { cta = true } = {}) {
  clear(container);
  const session = await currentSession();
  showLandingNote(session);
  if (session && session.isPoster) {
    const r = await posterInfo(session);
    const name = r.ok ? r.data.poster.full_name : "Employer";
    const org = r.ok ? r.data.organization.name : "";
    const account = buildAccount(h, initials, name, org);
    container.classList.add("nav-acct-area");
    container.append(
      h("a", { class: "btn btn-outline btn-sm", href: "dashboard.html" }, "My openings"),
      h("a", { class: "btn btn-outline btn-sm", href: "analytics.html" }, "Analytics"),
      r.ok && r.data.poster.is_org_admin ? h("a", { class: "btn btn-outline btn-sm", href: "team.html" }, "Team") : null,
      account.root,
      h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: async () => { await signOut(); forgetLocalState(); go("index.html"); } }, "Sign out"),
    );
    wireAccountMenu(account, document);
    orderHeader(document, window);
    return session;
  }
  if (session && session.isCandidate) {
    container.classList.add("nav-acct-area");
    container.append(
      h("span", { style: "font-size:13px;color:var(--muted);" }, "Email confirmed"),
      h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: async () => { await signOut(); go("index.html"); } }, "Sign out"),
    );
    orderHeader(document, window);
    return session;
  }
  if (cta) container.append(h("a", { class: "btn btn-primary btn-sm", href: "register.html" }, "Register an Opening →"));
  orderHeader(document, window);
  return session;
}
