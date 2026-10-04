// landing-notice.js - the one-time note on the page a sign-in link lands on: "you are signed in; you can close this tab and go back to the one you started from".
//
// The emailed link opens a NEW tab, so the person now has two tabs of the site. This note says what happened. auth-callback.js leaves a one-time flag (sessionStorage of THIS tab); the landing page shows the note once.
//
// WORDING NOT APPROVED (October 4, 2026): the sentences below are PROPOSED for John and the note is OFF (LANDING_NOTICE_ENABLED = false) until he approves or changes them. Turn it on by setting the
// constant to true after the wording is final; nothing else needs to change. The behavior is tested with the note forced on (tests/signin-handoff.test.js, tests/signin-tabs.test.js).

export const LANDING_NOTICE_ENABLED = false;
export const LANDING_TEXT = {   // PROPOSED, not approved
  candidate: "You are signed in. You can close this tab and go back to the one you started from, or keep searching here.",
  poster: "You are signed in. You can close this tab and go back to the one you started from, or keep working here.",
};
export const LANDED_KEY = "fgj-landed";

export function markLanded(store, kind) { try { store.setItem(LANDED_KEY, kind === "poster" ? "poster" : "candidate"); } catch { /* ignore */ } }
// -> "candidate" | "poster" | null; always consumed (the note is shown once)
export function takeLanded(store) { try { const v = store.getItem(LANDED_KEY); store.removeItem(LANDED_KEY); return v === "candidate" || v === "poster" ? v : null; } catch { return null; } }
// the text to show on this page, or null: only for the kind of sign-in this page serves, and only when the note is switched on
export function landingText(kind, enabled = LANDING_NOTICE_ENABLED) { return enabled && LANDING_TEXT[kind] ? LANDING_TEXT[kind] : null; }
