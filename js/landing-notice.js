// landing-notice.js - the one-time note on the page a sign-in link lands on, and the note on the search page for an address that is both a candidate and an employer.
//
// 1. The landing note: the emailed link opens a NEW tab, so the person now has two tabs of the site. The note says what happened ("you are signed in; you can close this tab and go back to the one you started from").
//    auth-callback.js leaves a one-time flag (sessionStorage of THIS tab); the first page that builds the top bar (app.js mountAccount) shows the note once.
// 2. The both-roles note: a sign-in whose session carries BOTH an employer claim and a candidate claim shows the employer buttons in the top bar (the bar follows the employer claim) and searches as a candidate.
//    The search page says so. It is shown for that case only: not for a candidate-only session and not for an employer-only session (that one has its own notice, which tells the person to sign out to search).
//
// WORDING APPROVED by John on October 4, 2026 (exactly these sentences). LANDING_NOTICE_ENABLED is on.

export const LANDING_NOTICE_ENABLED = true;
export const LANDING_TEXT = {
  candidate: "You are signed in. You can close this tab and go back to the one you started from, or keep searching here.",
  poster: "You are signed in. You can close this tab and go back to the one you started from, or keep working here.",
};
export const BOTH_ROLES_TEXT = "This address is also registered as an employer, so the employer buttons show above. Searching here works as a candidate.";
export const LANDED_KEY = "fgj-landed";

export function markLanded(store, kind) { try { store.setItem(LANDED_KEY, kind === "poster" ? "poster" : "candidate"); } catch { /* ignore */ } }
// -> "candidate" | "poster" | null; always consumed (the note is shown once)
export function takeLanded(store) { try { const v = store.getItem(LANDED_KEY); store.removeItem(LANDED_KEY); return v === "candidate" || v === "poster" ? v : null; } catch { return null; } }
// the text to show on this page, or null: only for the kind of sign-in this page serves, and only when the note is switched on
export function landingText(kind, enabled = LANDING_NOTICE_ENABLED) { return enabled && LANDING_TEXT[kind] ? LANDING_TEXT[kind] : null; }
// what the session's claims say about roles, for the search page: "both" (employer AND candidate), "employer" (employer only), or null (a candidate only, or nobody)
export function roleNoteKind(session) {
  if (!session) return null;
  if (session.isPoster && session.isCandidate) return "both";
  if (session.isPoster) return "employer";
  return null;
}
