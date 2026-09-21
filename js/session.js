// session.js - who is signed in, and the sign-in / sign-out actions.
//
// Sessions are Supabase Auth sessions created by an emailed one-time link (no password exists). The Auth client keeps the session in THIS origin's localStorage, refreshes it before it expires,
// and coordinates between tabs. The token the backend's Custom Access Token hook mints tells the two kinds of session apart:
//   poster_id             -> an employer (an active member of an organization's roster; the server re-checks that on every call)
//   candidate_identity_id -> a verified candidate
// Reading those claims here only decides which page to show. It grants nothing: every function checks the token again on the server.

import { GoTrueClient } from "../vendor/auth-js.min.mjs";
import { SUPABASE_URL, PUBLISHABLE_KEY, STORAGE_KEY, NEXT_KEY, KIND_KEY } from "./config.js";

let client = null;
export function authClient() {
  if (!client) {
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
  const { error } = await authClient().signInWithOtp({ email, options: { emailRedirectTo: location.origin + "/auth-callback.html", shouldCreateUser: true } });
  return error ? { ok: false, status: error.status || 0, message: error.message || "", code: error.code || "" } : { ok: true };
}

export async function signOut() {
  try { await authClient().signOut(); } catch { /* the local session is dropped below either way */ }
  try { localStorage.removeItem(STORAGE_KEY); sessionStorage.clear(); } catch { /* ignore */ }
}

export function takeNext(defaultPage) {
  let next = "", kind = "";
  try { next = sessionStorage.getItem(NEXT_KEY) || ""; kind = sessionStorage.getItem(KIND_KEY) || ""; sessionStorage.removeItem(NEXT_KEY); sessionStorage.removeItem(KIND_KEY); } catch { /* ignore */ }
  // only a plain same-site page name is ever followed
  return { next: /^[a-z0-9-]+\.html(\?[a-z0-9=&._%-]*)?$/i.test(next) ? next : defaultPage, kind };
}
export function rememberNext(next, kind) { try { sessionStorage.setItem(NEXT_KEY, next); sessionStorage.setItem(KIND_KEY, kind); } catch { /* ignore */ } }

export function onSessionChange(cb) { return authClient().onAuthStateChange((event) => cb(event)); }
