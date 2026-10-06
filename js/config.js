// config.js - the ONLY place the browser learns where the backend is.
// The publishable key is PUBLIC BY DESIGN (it only identifies the project; every real permission is decided by the signed-in session on the server).
// NEVER put a secret key, a database password or any token here: this file is served to everyone.
export const SUPABASE_URL = "https://tpmvkjuhbbwftqoodzcn.supabase.co";
export const PUBLISHABLE_KEY = "sb_publishable_b9ybhjQuSv_K8lIraieR3g_iBslDBOB";
// COMMENTS_VISIBLE (switch added October 5, 2026, shipped ON from October 6, 2026 on John's decision): the one switch for candidate comments on the pages. While true everything is shown: the home page's example card has its Comments link; the details
// window has "Comments (N)" next to "Report a wrong link"; the comments page has the thread, the comment form, the contest form and the "Comments stay open" line; My postings has the Comments column, the row link and the phone card line.
// While false: no Comments link on the home card, none in the details window ("Report a wrong link" stays); the comments page shows only the wrong-link report section; My postings has no Comments column, no row link and no phone card line.
// This switch hides the SCREENS only: the backend still accepts and lists comments if it is called directly (see the report for what a backend refusal flag would take).
export const COMMENTS_VISIBLE = true;
export const STORAGE_KEY = "fgj-auth";          // where the Auth client keeps the session (this origin's localStorage only)
export const NEXT_KEY = "fgj-next";              // where a page remembers "go here after the sign-in link" (sessionStorage)
export const KIND_KEY = "fgj-signin-kind";       // "poster" | "candidate": what the person asked to sign in as (sessionStorage)
