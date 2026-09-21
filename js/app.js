// app.js - what every page shares: the API object wired to the real session, the top-bar account area, and the "you must be signed in as ..." guards.

import { createApi, describeError, isAuthFailure } from "./api.js";
import { SUPABASE_URL, PUBLISHABLE_KEY } from "./config.js";
import { accessToken, currentSession, signOut, rememberNext } from "./session.js";
import { h, clear } from "./dom.js";
import { initials } from "./format.js";

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

// The right-hand side of the top bar. Signed-in employer: avatar + name + organization + Sign out. Anyone else: the "Register a Posting" call to action.
export async function mountAccount(container, { cta = true } = {}) {
  clear(container);
  const session = await currentSession();
  if (session && session.isPoster) {
    const r = await posterInfo(session);
    const name = r.ok ? r.data.poster.full_name : "Employer";
    const org = r.ok ? r.data.organization.name : "";
    container.append(
      h("span", { class: "nav-account" }, h("span", { class: "avatar" }, initials(name)), name + (org ? " · " + org : "")),
      h("button", { type: "button", class: "btn btn-ghost btn-sm", style: "margin-left:14px;", onclick: async () => { await signOut(); forgetLocalState(); go("index.html"); } }, "Sign out"),
    );
    return session;
  }
  if (session && session.isCandidate) {
    container.append(
      h("span", { style: "font-size:13px;color:var(--muted);margin-right:14px;" }, "Email verified"),
      h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: async () => { await signOut(); go("index.html"); } }, "Sign out"),
    );
    return session;
  }
  if (cta) container.append(h("a", { class: "btn btn-primary btn-sm", href: "register.html" }, "Register a Posting →"));
  return session;
}
