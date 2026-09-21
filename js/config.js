// config.js - the ONLY place the browser learns where the backend is.
// The publishable key is PUBLIC BY DESIGN (it only identifies the project; every real permission is decided by the signed-in session on the server).
// NEVER put a secret key, a database password or any token here: this file is served to everyone.
export const SUPABASE_URL = "https://tpmvkjuhbbwftqoodzcn.supabase.co";
export const PUBLISHABLE_KEY = "sb_publishable_b9ybhjQuSv_K8lIraieR3g_iBslDBOB";
export const STORAGE_KEY = "fgj-auth";          // where the Auth client keeps the session (this origin's localStorage only)
export const NEXT_KEY = "fgj-next";              // where a page remembers "go here after the sign-in link" (sessionStorage)
export const KIND_KEY = "fgj-signin-kind";       // "poster" | "candidate": what the person asked to sign in as (sessionStorage)
