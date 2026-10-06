// config.js - the ONLY place the browser learns where the backend is.
// The publishable key is PUBLIC BY DESIGN (it only identifies the project; every real permission is decided by the signed-in session on the server).
// NEVER put a secret key, a database password or any token here: this file is served to everyone.
export const SUPABASE_URL = "https://tpmvkjuhbbwftqoodzcn.supabase.co";
export const PUBLISHABLE_KEY = "sb_publishable_b9ybhjQuSv_K8lIraieR3g_iBslDBOB";
// ALLOW_INDEXING (October 6, 2026): the one flag for search engines. FALSE on stage: every page says noindex, nofollow and robots.txt disallows everything. TRUE only on a production site, deliberately: then the PUBLIC pages (index.html, privacy.html)
// say index, follow and robots.txt allows crawling. Pages that need a sign-in or show a person's own data stay noindex in every environment, whatever this says. Changing it is two steps: edit this line, then run  node tests/apply-indexing.js  (it rewrites
// robots.txt and the robots tag of the two public pages and nothing else); tests/indexing.test.js and the static rule S60 fail if the two disagree.
export const ALLOW_INDEXING = false;
// EMAIL_CODE_ENTRY (October 6, 2026): TRUE shows a field "Or type the code from the email" on the search page and the employer sign-in page once a sign-in link has been requested, so the person can finish in the SAME tab. It only works
// once the Supabase sign-in email shows the code ({{ .Token }}) next to the link (a dashboard change the owner makes, see the report). SHIPS FALSE (John's decision, October 6, 2026) and stays false until John has pasted the email template on stage
// and tested it (the steps are in handoff\11-emailed-code-template-and-dashboard-steps.txt); then this line is set to true in its own commit, together with the pins in tests/code-entry.test.js and rule S61. The link keeps working either way.
export const EMAIL_CODE_ENTRY = false;
// COMMENTS_VISIBLE (switch added October 5, 2026, shipped ON from October 6, 2026 on John's decision): the one switch for candidate comments on the pages. While true everything is shown: the home page's example card has its Comments link; the details
// window has "Comments (N)" next to "Report a wrong link"; the comments page has the thread, the comment form, the contest form and the "Comments stay open" line; My postings has the Comments column, the row link and the phone card line.
// While false: no Comments link on the home card, none in the details window ("Report a wrong link" stays); the comments page shows only the wrong-link report section; My postings has no Comments column, no row link and no phone card line.
// This switch hides the SCREENS only: the backend still accepts and lists comments if it is called directly (see the report for what a backend refusal flag would take).
export const COMMENTS_VISIBLE = true;
export const STORAGE_KEY = "fgj-auth";          // where the Auth client keeps the session (this origin's localStorage only)
export const NEXT_KEY = "fgj-next";              // where a page remembers "go here after the sign-in link" (sessionStorage)
export const KIND_KEY = "fgj-signin-kind";       // "poster" | "candidate": what the person asked to sign in as (sessionStorage)
