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
export const BOTH_ROLES_TEXT = "This address is also an employer address, so the employer buttons show above. Searching here works as a candidate.";
export const LANDED_KEY = "fgj-landed";

export function markLanded(store, kind) { try { store.setItem(LANDED_KEY, kind === "poster" ? "poster" : "candidate"); } catch { /* ignore */ } }
// -> "candidate" | "poster" | null; always consumed (the note is shown once)
export function takeLanded(store) { try { const v = store.getItem(LANDED_KEY); store.removeItem(LANDED_KEY); return v === "candidate" || v === "poster" ? v : null; } catch { return null; } }
// WHICH wording a page gets (October 4, 2026, after the stage recheck): by the PAGE the sign-in landed on, never by guessing the role from the session. The emailed link opens a new tab that does not know which
// kind of sign-in was asked for, and an address that is both an employer and a candidate carries both claims: choosing by role showed the candidate sentence ("keep searching here") on My postings.
// Employer pages: My postings, Analytics, Team, the Edit page, Register a posting (New posting), and the comments page of one of the employer's own postings (comments.html?id=). Candidate pages: Search and the comments page
// of a posting reached from search (comments.html?ref=). Any other page: null (the caller falls back on the flag the callback left).
export const EMPLOYER_PAGES = ["dashboard.html", "analytics.html", "team.html", "edit.html", "register.html"];
export const CANDIDATE_PAGES = ["search.html"];
export function landingKindForPage(pathname, search) {
  const name = String(pathname || "").split("/").pop();
  if (EMPLOYER_PAGES.includes(name)) return "poster";
  if (CANDIDATE_PAGES.includes(name)) return "candidate";
  if (/^comments\.html$/.test(name)) { const q = new URLSearchParams(String(search || "")); return q.has("id") ? "poster" : q.has("ref") ? "candidate" : null; }
  return null;
}
// the text to show on this page, or null: only for the kind of sign-in this page serves, and only when the note is switched on
export function landingText(kind, enabled = LANDING_NOTICE_ENABLED) { return enabled && LANDING_TEXT[kind] ? LANDING_TEXT[kind] : null; }
// what the session's claims say about roles, for the search page: "both" (employer AND candidate), "employer" (employer only), or null (a candidate only, or nobody)
export function roleNoteKind(session) {
  if (!session) return null;
  if (session.isPoster && session.isCandidate) return "both";
  if (session.isPoster) return "employer";
  return null;
}
