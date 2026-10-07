// session.js - who is signed in, and the sign-in / sign-out actions.
//
// Sessions are Supabase Auth sessions created by an emailed one-time link (no password exists). The Auth client keeps the session in THIS origin's localStorage, refreshes it before it expires,
// and coordinates between tabs. The token the backend's Custom Access Token hook mints tells the two kinds of session apart:
//   poster_id             -> an employer (an active member of an organization's roster; the server re-checks that on every call)
//   candidate_identity_id -> a verified candidate
// Reading those claims here only decides which page to show. It grants nothing: every function checks the token again on the server.

import { GoTrueClient } from "../vendor/auth-js.min.mjs";
import { SUPABASE_URL, PUBLISHABLE_KEY, STORAGE_KEY, NEXT_KEY, KIND_KEY } from "./config.js";
import { saveLanding, takeLanding, clearHandoff, watchSignIn, SAFE_PAGE } from "./signin-handoff.js";

let client = null;
// The client is created WITHOUT the library's cross-tab channel. The library opens a BroadcastChannel on every page and posts every sign-in event on it; a page the browser has kept for Back (its back/forward cache)
// is thrown away the moment such a message reaches it, so Back from Comments or Report a wrong link gave a blank search form (October 7, 2026; the browser's own reason is "broadcastchannel-message").
// Nothing here uses the channel: a sign-in done in another tab is noticed through the browser's storage event (js/signin-handoff.js), and every call reads the session again from localStorage.
// The constructor reads globalThis.BroadcastChannel once, synchronously: it is hidden for that moment and put back at once. tests/site-check.js pins this and tests/back-restore.test.js proves the result.
export function authClient() {
  if (!client) {
    const channel = globalThis.BroadcastChannel;
    globalThis.BroadcastChannel = undefined;
    try {
    client = new GoTrueClient({
      url: SUPABASE_URL + "/auth/v1",
      headers: { apikey: PUBLISHABLE_KEY },
      storageKey: STORAGE_KEY,
      storage: window.localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,     // the sign-in link lands on auth-callback.html with the session in the URL fragment
      flowType: "implicit",         // works when the email is opened on a different device than the one that asked for it
    });
    } finally { globalThis.BroadcastChannel = channel; }
  }
  return client;
}

export function decodeClaims(token) {
  try {
    const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(atob(p + "=".repeat((4 - (p.length % 4)) % 4)).split("").map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
    const o = JSON.parse(json);
    return o !== null && typeof o === "object" ? o : null;
  } catch { return null; }
}

// -> { token, claims, isPoster, isCandidate } or null when nobody is signed in (a session whose refresh was refused counts as nobody)
export async function currentSession() {
  const auth = authClient();
  let res;
  try { res = await auth.getSession(); } catch { return null; }
  const s = res && res.data && res.data.session;
  if (!s || !s.access_token) return null;
  const claims = decodeClaims(s.access_token);
  if (!claims || claims.is_anonymous === true) return null;
  return { token: s.access_token, claims, isPoster: typeof claims.poster_id === "string", isCandidate: typeof claims.candidate_identity_id === "string" };
}
export async function accessToken() { const s = await currentSession(); return s ? s.token : null; }

// Ask for an emailed sign-in link. kind: "poster" | "candidate". `next` is where to go afterwards (a same-site page).
export async function requestLink(email, kind, next) {
  try { sessionStorage.setItem(KIND_KEY, kind); sessionStorage.setItem(NEXT_KEY, next || ""); } catch { /* private mode: the callback falls back to a default page */ }
  // the emailed link opens in a NEW tab (empty sessionStorage): the page to land on is also kept where every tab of this browser can read it, for one hour (signin-handoff.js)
  try { saveLanding(localStorage, next || ""); } catch { /* ignore */ }
  const { error } = await authClient().signInWithOtp({ email, options: { emailRedirectTo: location.origin + "/auth-callback.html", shouldCreateUser: true } });
  return error ? { ok: false, status: error.status || 0, message: error.message || "", code: error.code || "" } : { ok: true };
}

// Confirm the short code that the same email carries next to the link (October 6, 2026): the person types it in the tab that asked for the link, so no other tab or browser is involved. It is the same Auth service call that
// completes a link, type "email" (Supabase documentation: signInWithOtp sends a code instead of, or next to, the link when the email template shows {{ .Token }}; verifyOtp with type "email" returns the session). The Auth client stores the session
// exactly as it does for a link. A first-time address is sent the "Confirm signup" template by Supabase, so when "email" is refused the code is tried once as type "signup" before giving up.
export async function confirmEmailCode(email, token) {
  const call = (type) => authClient().verifyOtp({ email, token, type });
  let { error } = await call("email");
  if (error && error.status !== 429) { const second = await call("signup"); if (!second.error) error = null; }
  return error ? { ok: false, status: error.status || 0, message: error.message || "", code: error.code || "" } : { ok: true };
}

export async function signOut() {
  try { await authClient().signOut(); } catch { /* the local session is dropped below either way */ }
  try { localStorage.removeItem(STORAGE_KEY); clearHandoff(localStorage); sessionStorage.clear(); } catch { /* ignore */ }
}

export function takeNext(defaultPage) {
  let next = "", kind = "";
  try { next = sessionStorage.getItem(NEXT_KEY) || ""; kind = sessionStorage.getItem(KIND_KEY) || ""; sessionStorage.removeItem(NEXT_KEY); sessionStorage.removeItem(KIND_KEY); } catch { /* ignore */ }
  // a link opened in another tab has none of the sessionStorage of the tab that asked for it: the page kept in localStorage (always consumed, so it cannot be used twice)
  let fromOtherTab = null; try { fromOtherTab = takeLanding(localStorage); } catch { /* ignore */ }
  if (!next) next = fromOtherTab || "";
  // only a plain same-site page name is ever followed
  return { next: SAFE_PAGE.test(next) ? next : defaultPage, kind };
}
// the page remembered by rememberNext (a page that sent the person to sign in), or "" when there is none; nothing is consumed
export function rememberedNext() { try { const n = sessionStorage.getItem(NEXT_KEY) || ""; return SAFE_PAGE.test(n) ? n : ""; } catch { return ""; } }
export function rememberNext(next, kind) { try { sessionStorage.setItem(NEXT_KEY, next); sessionStorage.setItem(KIND_KEY, kind); } catch { /* ignore */ } }

export function onSessionChange(cb) { return authClient().onAuthStateChange((event) => cb(event)); }

// Call on a page that asks for a sign-in link: onSignedIn(session) runs once when a sign-in is completed in another tab of this browser (or the person comes back to this tab and it is done). See signin-handoff.js.
export function watchOtherTabSignIn(onSignedIn, accept) {
  return watchSignIn({ win: window, doc: document, storageKey: STORAGE_KEY, check: currentSession, onSignedIn, accept });
}
