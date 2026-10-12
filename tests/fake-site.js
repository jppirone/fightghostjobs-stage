// fake-site.js - the repo's own files served on 127.0.0.1 with a tiny FAKE backend, for the browser tests (tests/signin-tabs.test.js, tests/phone-layout.test.js, tests/header-layout.test.js uses its own copy).
// No real project, no key, no network: every answer below is made up. The real API origin written into the pages and scripts is replaced with this server's own address.
//   startFakeSite(root)  -> { url, calls, close() }      calls: every backend request seen { name, body, auth } (the sign-in e-mail request is recorded as name "auth-otp" with its full address and body)
//   /_dev/link?kind=poster|candidate|both   what the emailed link does: redirects to auth-callback.html with a fake session in the fragment (both = an address that is an employer AND a verified candidate)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { kioCheckChar, kioDisplay, readKio } from "../js/kio.js";

// prompt BQ (October 12, 2026): opts.kio switches the fake backend to the MIGRATED database: every opening's ID is a KIO ID (the 12 character codes below with their last character replaced by the check character), search rows carry
// kio_id, and candidate-search answers a lookup by ID alone. Without opts.kio every answer is as it always was (an unmigrated database), which the pages must still show correctly.
//   the IDs the fake knows: the two search results (by their codes), "KIO7K3M9Q2XW4T9" (a closed opening with its closing date), "KIO000000000000" (an opening past its retention: 410), any other well formed ID: 404
export const KIO_CLOSED = "KIO7K3M9Q2XW4T9", KIO_GONE = "KIO000000000000";
export const kioOf = (pcode) => { const body = String(pcode).slice(0, 11), cc = kioCheckChar(body); return { stored: "KIO" + body + cc, shown: kioDisplay(body + cc) }; };

const REAL = "https://tpmvkjuhbbwftqoodzcn.supabase.co";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".json": "application/json" };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export const fakeJwt = (claims) => b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: "00000000-0000-4000-8000-000000000001", role: "authenticated", aud: "authenticated", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...claims }) + ".sig";
export const NOLINKS_REF = "m".repeat(20), CLOSED_REF = "c".repeat(20);   // a posting reference with no employer links, and one that is closed (detail answers 409 posting_not_open)
export const LONG_NAME = "Bartholomew Featherstonehaugh-Wolverhampton", LONG_ORG = "Meridian Health Systems of the Greater Providence and Boston Region";
const day = 864e5, inDays = (d) => new Date(Date.now() + d * day).toISOString();
// prompt BJ: the rows of "My openings" are built from ONE moment (they used to read the clock once per row, so the order of rows that tie on the posted time depended on whether a millisecond ticked while the list was built)
const T0 = Date.now(), inDaysAt = (d) => new Date(T0 + d * day).toISOString();
// the plan the fake backend reports (opts.plan: "verified", "lapsed" or the default: not on the destination links tier), for get-my-posting AND, since prompt BJ, poster-session (the register page reads it there)
const planFor = (o) => (o.plan === "verified" ? { verified: true, source: "pilot", expires_at: null, lapsed: false } : o.plan === "lapsed" ? { verified: false, source: "paid", expires_at: inDays(-3), lapsed: true } : { verified: false, source: null, expires_at: null, lapsed: false });
const code = (c) => "****-****-" + c.slice(-4);
const posting = (company, title, pcode, extra) => Object.assign({ company_name: company, title, locations: ["Austin, TX"], is_remote: false, posted_at: inDays(-12), closes_at: inDays(33), applicant_cap: null, status: "live", closed_reason: null, ai_filtering: false, ai_interview_other: false, ai_disclosure_shown: false, third_party_recruiter: false, masked_req: "4****71", masked_code: code(pcode), posting_ref: pcode.toLowerCase().padEnd(20, "x"), last_edited_at: null, is_registered: false }, extra || {});
const RESULTS = [
  posting("Meridian Health Systems of the Greater Region", "Senior Data Analyst, Population Health Reporting and Quality Improvement", "D21M48YBZQBF", { locations: ["Boston, MA", "Providence, RI", "Hartford, CT"], ai_filtering: true, ai_disclosure_shown: true, applicant_cap: 250, is_registered: true }),   // October 9, 2026: the first result is a registered opening (an active paid plan), the second is not
  posting("Meridian Health Systems of the Greater Region", "Nurse Practitioner", "K7Q3W9ZT2XPM", { is_remote: true, locations: [], ai_interview_other: true, ai_disclosure_shown: true }),
];
// the staff scope (October 8, 2026): what the two database functions would answer for a staff person. Every status; exactly the agreed keys.
const staffRow = (title, status, extra) => Object.assign({ company_name: "Meridian Health Systems of the Greater Region", organization_name: "Meridian Health Systems", title, locations: ["Austin, TX"], is_remote: false, status, stored_status: status, closed_reason: null,
  posted_at: inDays(-12), closes_at: inDays(33), go_live_at: null, applicant_cap: null, ai_filtering: false, ai_interview_other: false, third_party_recruiter: false, opening_id: "D21M-48YB-ZQBF", req_number: "4471", is_registered: false }, extra || {});
export const STAFF_ROWS = [
  staffRow("Senior Data Analyst, Population Health Reporting and Quality Improvement", "live", { is_registered: true }),
  staffRow("Data Analyst Draft", "draft", { posted_at: null, closes_at: null, opening_id: "A1B2-C3D4-E5F6", req_number: "4210" }),
  staffRow("Data Analyst Scheduled", "draft", { posted_at: null, closes_at: null, go_live_at: inDays(2), opening_id: "P4R9-T2V6-X8ZA", req_number: "4390" }),
  staffRow("Data Analyst Held For Review", "flagged", { opening_id: "H7J8-K9M1-N2P3", req_number: null }),
  staffRow("Data Analyst Paused", "paused", { opening_id: "K7Q3-W9ZT-2XPM", req_number: "R-2026-0451" }),
  staffRow("Data Analyst Closed", "closed", { closed_reason: "filled", opening_id: "B2C3-D4E5-F6G7", req_number: "4118" }),
  staffRow("Data Analyst Expired", "expired", { stored_status: "live", closed_reason: "expired_no_action", opening_id: "C3D4-E5F6-G7H8", req_number: "4001" }),
];
const MINE = [
  ["Senior Data Analyst", "4471", "D21M48YBZQBF", "live", 17, 138], ["Nurse Practitioner", "R-2026-0451", "K7Q3W9ZT2XPM", "paused", 9, 52], ["Analytics Team Lead", "4390", "P4R9T2V6X8ZA", "scheduled", null, 0],
  ["Junior BI Developer", "4210", "A1B2C3D4E5F6", "draft", null, 0], ["Data Governance Analyst", "4118", "H7J8K9M1N2P3", "expired", -15, 12],
].map(([title, req, pc, status, exp, comments], i) => ({ id: "3f1d5b1e-0000-4000-8000-00000000000" + (i + 1), title, req_number: req, post_id: pc, status, closed_reason: status === "expired" ? "expired_no_action" : null, stored_status: status === "scheduled" ? "draft" : status === "expired" ? "live" : status, is_remote: false, locations: ["Austin, TX"], location_ids: [], locations_attested: false,
  window_days: 45, posted_at: status === "draft" || status === "scheduled" ? null : inDaysAt(-12), expiration_date: exp === null ? null : inDaysAt(exp), publish_by: status === "draft" ? inDaysAt(11) : null, go_live_at: status === "scheduled" ? inDaysAt(20) : null, applicant_cap: i === 0 ? 250 : null, bump_used: false, bump_days: null, created_at: inDaysAt(-20), last_edited_at: null, comment_count: comments }));
const ROSTER = [
  { poster_id: "00000000-0000-4000-8000-0000000000aa", full_name: "Dana Whitfield", email: "dana.whitfield@meridian-health-systems.example", is_org_admin: true, status: "active", added_at: inDays(-40), first_signin_at: inDays(-40), last_verified_at: inDays(-2) },
  { poster_id: "00000000-0000-4000-8000-0000000000ab", full_name: "Sam Owner", email: "sam@meridian.example", is_org_admin: false, status: "active", added_at: inDays(-20), first_signin_at: inDays(-19), last_verified_at: inDays(-5) },
  { poster_id: "00000000-0000-4000-8000-0000000000ac", full_name: "Lee Invited", email: "lee@meridian.example", is_org_admin: false, status: "invited", added_at: inDays(-1), first_signin_at: null, last_verified_at: null },
];
const ANALYTICS = { live_postings: 4, searches: 1284, detail_views: 406, link_clicks: 151, platform_activity_total: 5400, share_of_registry_pct: 18.4,
  by_posting: [{ posting_id: "3f1d5b1e-0000-4000-8000-000000000001", title: "Senior Data Analyst", status: "live", closed_reason: null, expiration_date: inDays(17), searches: 412, detail_views: 138, link_clicks: 61 }, { posting_id: "3f1d5b1e-0000-4000-8000-000000000002", title: "Nurse Practitioner", status: "paused", closed_reason: null, expiration_date: inDays(9), searches: 163, detail_views: 52, link_clicks: 18 }, { posting_id: "3f1d5b1e-0000-4000-8000-000000000003", title: "Support Engineer II", status: "closed", closed_reason: "filled", expiration_date: inDays(-2), searches: 44, detail_views: 13, link_clicks: 3 }],
  by_link: [{ link_id: "4f1d5b1e-0000-4000-8000-000000000001", posting_id: "3f1d5b1e-0000-4000-8000-000000000001", source_label: "Careers site, primary listing", kind: "apply", firm_name: null, display_order: 1, clicks: 88 }, { link_id: "4f1d5b1e-0000-4000-8000-000000000003", posting_id: "3f1d5b1e-0000-4000-8000-000000000002", source_label: null, kind: "recruiter", firm_name: "Recruiter-provided link", display_order: 1, clicks: 16 }],
  by_search_mode: { phrase: 61, code: 24, req: 15 } };

// opts.pageCache: Cache-Control for the pages and scripts (default no-store, as always). opts.commentsOff: serve js/config.js with the comments switch turned OFF (COMMENTS_VISIBLE false), to test the pages in that state. By default the fake site serves the file exactly as shipped, which is ON since October 6, 2026, so every test written for the pages with comments keeps covering them
export function startFakeSite(root, opts = {}) {
  root = path.resolve(root);
  const calls = [], hits = []; let SELF = "";      // hits (prompt BM): every request the browser made, "METHOD /path", whatever it was for
  const createGate = {}; createGate.promise = new Promise((r) => { createGate.release = r; });      // opts.createHold (prompt BW): create-posting is answered only when the test calls site.releaseCreate()
  const state = { published: false };   // prompt BK: what a call changed that a later read must show (the opening is live after Publish)
  let policyState = opts.policy === undefined ? null : opts.policy;   // the AI and hiring policy link the fake backend holds for the one opening (see opts.plan, opts.policy, opts.policyCheck, opts.policyDetail below)
  // the recruiter firms the fake backend holds for the one opening (prompt BC, October 10, 2026): opts.firms = [{ firm, with_address (default true), check_status, check_http, shown_as }] in position order; opts.recruiter: the saved toggle is on
  let firmsState = (opts.firms || []).map((f, i) => ({ position: i + 1, firm: f.firm, has_url: f.with_address !== false, shown_as: f.shown_as === undefined ? "Employer's own site" : f.shown_as, check_status: f.check_status || "ok", check_http: f.check_http === undefined ? (f.check_status === "failed" ? 404 : 200) : f.check_http }));
  // the destination (application) links the fake backend holds (prompt BN, October 11, 2026): opts.applyLinks = [{ label }] in position order. Only when the option is given are they returned by get-my-posting and replaced by a
  // whole-set save (every other test keeps the old behavior: nothing stored, a save is only answered).
  let applyState = Array.isArray(opts.applyLinks) ? opts.applyLinks.map((l, i) => ({ position: i + 1, label: l.label || null, check_status: l.check_status || "ok" })) : null;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    hits.push(req.method + " " + url.pathname);
    const send = (status, body, extra) => { res.writeHead(status, Object.assign({ "Content-Type": "application/json", "Cache-Control": "no-store" }, extra || {})); res.end(typeof body === "string" ? body : JSON.stringify(body)); };
    const readBody = () => new Promise((ok) => { let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch { ok({}); } }); });
    const claimsOf = () => { try { return JSON.parse(Buffer.from(String(req.headers.authorization || "").replace(/^Bearer /, "").split(".")[1], "base64url").toString()); } catch { return null; } };
    // the two database functions of the staff scope, called as PostgREST rpc with the person's own token (opts.noRpc: the functions do not exist, as before the SQL is run; opts.rpcFail: the database errors;
    // opts.staffSearchFails: is_staff says yes but the search itself errors; opts.staffEmails: who is on the staff list, default staff@example.test)
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const fn = url.pathname.slice(13), body = await readBody(), c = claimsOf();
      calls.push({ name: "rpc:" + fn, body, auth: c ? { email: c.email || "", poster: typeof c.poster_id === "string", candidate: typeof c.candidate_identity_id === "string" } : null, cacheControl: req.headers["cache-control"] || null });
      if (opts.noRpc) return send(404, { code: "PGRST202", message: "Could not find the function" });
      if (opts.rpcFail) return send(500, { code: "XX000", message: "boom" });
      if (!c) return send(401, { code: "PGRST301", message: "JWT required" });
      const staff = (opts.staffEmails || ["staff@example.test"]).includes(String(c.email || "").toLowerCase());
      if (fn === "is_staff") return send(200, staff ? "true" : "false");
      if (fn === "staff_search_openings") {
        if (!staff) return send(404, { code: "FG404", message: "not found" });
        if (opts.staffSearchFails) return send(500, { code: "XX000", message: "boom" });
        const co = String(body.p_company || "").toLowerCase(), ph = String(body.p_phrase || "").toLowerCase();
        const rows = STAFF_ROWS.filter((r) => r.company_name.toLowerCase().includes(co) && (!ph || r.title.toLowerCase().includes(ph) || (body.p_code ? r.opening_id.replace(/-/g, "") === body.p_code.replace(/-/g, "") : false)));
        const out = opts.staffOmitRegistered ? rows.map((r) => { const q = { ...r }; delete q.is_registered; return q; }) : rows;   // opts.staffOmitRegistered: the staff function before the registered-check migration (no is_registered key)
        // opts.staffPlaceOverrides: for each staff result in order an object merged into the row (locations, source_location_text), for the tests of the display-only place text (AZ3)
        const outPlaced = opts.staffPlaceOverrides ? out.map((r, i) => Object.assign({}, r, (opts.staffPlaceOverrides[i] || {}))) : out;
        return send(200, { mode: body.p_req ? "req" : body.p_code ? "code" : "phrase", truncated: false, results: outPlaced });
      }
      return send(404, { code: "PGRST202", message: "Could not find the function" });
    }
    if (url.pathname.startsWith("/functions/v1/")) {
      const name = url.pathname.slice(14), body = await readBody(), c = claimsOf();
      calls.push({ name, body, auth: c ? { poster: typeof c.poster_id === "string", candidate: typeof c.candidate_identity_id === "string" } : null });
      const poster = c && typeof c.poster_id === "string", cand = c && typeof c.candidate_identity_id === "string";
      const unauth = () => send(401, { error: "unauthorized", code: "unauthorized" });
      if (name === "poster-login-intent") return send(202, { ok: true });
      if (name === "poster-session") return poster ? send(200, { poster: { poster_id: c.poster_id, full_name: LONG_NAME, is_org_admin: true }, organization: { organization_id: "00000000-0000-4000-8000-0000000000bb", name: LONG_ORG }, verified_at: new Date().toISOString(), reverify_by: inDays(30), plan: planFor(opts) }) : unauth();
      // prompt BL: opts.mineOverrides: for each of the five rows in order an object merged into it; opts.mineExtra: more rows (each merged over the first row's shape) for the layout tests of My openings
      const mine = () => MINE.map((p, i) => ({ ...p, ...(opts.kio ? { post_id: kioOf(p.post_id).stored } : {}), ...((opts.mineOverrides && opts.mineOverrides[i]) || {}) })).concat((opts.mineExtra || []).map((x, i) => ({ ...MINE[0], ...(opts.kio ? { post_id: kioOf(MINE[0].post_id).stored } : {}), id: "3f1d5b1e-0000-4000-8000-0000000001" + String(10 + i), ...x })));
      if (name === "list-my-postings") return poster ? send(200, { total: mine().length, postings: body.offset ? [] : mine().map((p, i) => (i === 0 && opts.placeText ? { ...p, locations: [], location_ids: [], source_location_text: opts.placeText } : p)), next_offset: null }) : unauth();
      if (name === "employer-analytics") return poster ? send(200, ANALYTICS) : unauth();
      if (name === "poster-roster-list") return poster ? send(200, { posters: ROSTER.map((p, i) => (i === 0 ? { ...p, poster_id: c.poster_id } : p)) }) : unauth();
      // the AI and hiring policy link (prompt BA, October 10, 2026). opts.plan: "locked" (default: not on the destination links tier), "verified" or "lapsed"; opts.policy: the link already stored, { check_status, check_http, shown_as } or null (default none);
      // opts.policyCheck: what the address check answers when a link is saved ("ok" default, "failed" with HTTP 404, "skipped"); a save is answered 403 plan_required unless opts.plan is "verified". opts.policyDetail: candidates are sent the policy link.
      const planDoc = () => (opts.plan === "verified" ? { verified: true, source: "pilot", expires_at: null, lapsed: false } : opts.plan === "lapsed" ? { verified: false, source: "paid", expires_at: inDays(-3), lapsed: true } : { verified: false, source: null, expires_at: null, lapsed: false });
      const policyEntry = () => (policyState ? { position: 1, kind: "policy", firm: null, label: null, shown_as: policyState.shown_as ?? "Employer's own site", check_status: policyState.check_status ?? null, check_http: policyState.check_http ?? null } : null);
      const firmEntries = () => firmsState.map((f) => ({ position: f.position, kind: "recruiter", firm: f.firm, label: null, shown_as: f.has_url ? f.shown_as : null, check_status: f.has_url ? f.check_status : null, check_http: f.has_url ? f.check_http : null }));
      const PLAN_REFUSAL = { error: "This feature is part of the destination links tier. Your organization is not on it (or the tier has ended), so nothing was changed. Contact sales@fightghostjobs.com.", code: "plan_required" };
      // Check link for a firm or for the policy link: a one-time ticket (an https address on a host that is not the site; the test replaces window.open and reads it)
      if (name === "check-destination-link" && poster) {
        if (opts.plan !== "verified") return send(403, PLAN_REFUSAL);
        if (opts.checkLinkRefused) return send(429, { error: "rate_limited", code: "rate_limited" }, { "Retry-After": "30" });
        const missing = () => send(404, { error: "link_not_found", code: "link_not_found" });
        if (body.kind === "recruiter") { const f = firmsState.find((x) => x.position === body.position); if (!f || !f.has_url) return missing(); }
        else if (body.kind === "policy") { if (!policyState || body.position !== 1) return missing(); }
        else return missing();   // application links are not modeled by this fake
        return send(200, { go_url: "https://go.example.invalid/check/" + body.kind + "-" + body.position, expires_at: new Date(Date.now() + 60000).toISOString() });
      }
      // one-firm changes by stored position (edit: a new address and/or a new name; remove) and the whole-set replace of the firms
      if (name === "set-destination-links" && poster && body.kind === "recruiter" && body.op === "add") {
        // prompt BG: the one-firm add. The position is chosen here (the lowest free one of 1 to 3); the other firms are not touched. opts.addRefusal = { status, body } makes the server refuse it.
        if (opts.plan !== "verified") return send(403, PLAN_REFUSAL);
        if (opts.addRefusal) return send(opts.addRefusal.status, opts.addRefusal.body);
        const nm = typeof body.name === "string" ? body.name.trim() : "";
        if (nm === "") return send(400, { error: "name must not be empty", field: "name", errors: [{ field: "name", message: "name must not be empty" }] });
        const has = typeof body.url === "string" && body.url.trim() !== "";
        if (has && !/^https:\/\//i.test(body.url)) return send(400, { error: "url must start with https://", field: "url", errors: [{ field: "url", message: "url must start with https://" }] });
        if (has && /blocked\.example/.test(body.url)) return send(400, { error: "url host is not allowed", field: "url", errors: [{ field: "url", message: "url host is not allowed" }] });
        if (firmsState.length >= 3) return send(409, { error: "A posting can name at most 3 recruiter firms; nothing was changed. Remove one first.", code: "firm_limit" });
        let pos = 1; while (firmsState.some((x) => x.position === pos)) pos++;
        firmsState.push({ position: pos, firm: nm, has_url: has, shown_as: "Employer's own site", url: has ? body.url : undefined, check_status: has ? (opts.firmCheck || "ok") : null, check_http: has ? (opts.firmCheck === "failed" ? 404 : 200) : null });
        firmsState.sort((x, y) => x.position - y.position);
        return send(200, { posting_id: body.posting_id, kind: "recruiter", op: "add", position: pos, changed: true, active_links: firmsState.length, links: firmEntries() });
      }
      if (name === "set-destination-links" && poster && body.kind === "recruiter" && body.op) {
        if (opts.plan !== "verified") return send(403, PLAN_REFUSAL);
        const f = firmsState.find((x) => x.position === body.position);
        if (!f) return send(404, { error: "link_not_found", code: "link_not_found" });
        let changed = false;
        if (body.op === "remove") { firmsState = firmsState.filter((x) => x !== f); changed = true; }
        else {
          if (typeof body.url === "string" && body.url.trim() !== "") {
            if (!/^https:\/\//i.test(body.url)) return send(400, { error: "url must start with https://", field: "url", errors: [{ field: "url", message: "url must start with https://" }] });
            if (/blocked\.example/.test(body.url)) return send(400, { error: "url host is not allowed", field: "url", errors: [{ field: "url", message: "url host is not allowed" }] });
            f.has_url = true; f.url = body.url; f.check_status = opts.firmCheck || "ok"; f.check_http = f.check_status === "failed" ? 404 : 200; changed = true;
          }
          if (typeof body.name === "string" && body.name.trim() !== "" && body.name.trim() !== f.firm) { f.firm = body.name.trim(); changed = true; }
        }
        return send(200, { posting_id: body.posting_id, kind: "recruiter", op: body.op, position: body.position, changed, active_links: firmsState.length, links: firmEntries() });
      }
      if (name === "set-destination-links" && poster && body.kind === "recruiter") {
        if (opts.plan !== "verified") return send(403, PLAN_REFUSAL);
        const list = Array.isArray(body.links) ? body.links : [];
        if (list.length > 3) return send(400, { error: "links must contain at most 3 entries", field: "links", errors: [{ field: "links", message: "links must contain at most 3 entries" }] });
        firmsState = list.map((x, i) => ({ position: i + 1, firm: String(x.name || ""), has_url: typeof x.url === "string" && x.url !== "", shown_as: "Employer's own site", check_status: opts.firmCheck || "ok", check_http: opts.firmCheck === "failed" ? 404 : 200 }));
        return send(200, { posting_id: body.posting_id, kind: "recruiter", changed: true, active_links: firmsState.length, links: firmEntries() });
      }
      if (name === "set-destination-links" && poster && body.kind === "policy") {
        if (opts.plan !== "verified") return send(403, { error: "This feature is part of the destination links tier. Your organization is not on it (or the tier has ended), so nothing was changed. Contact sales@fightghostjobs.com.", code: "plan_required" });
        const list = Array.isArray(body.links) ? body.links : [];
        if (list.length > 1) return send(400, { error: "links must contain at most 1 entries", field: "links", errors: [{ field: "links", message: "links must contain at most 1 entries" }] });
        if (list.length === 0) { const had = !!policyState; policyState = null; return send(200, { posting_id: body.posting_id, kind: "policy", changed: had, active_links: 0, links: [] }); }
        const u = String(list[0].url || "");
        if (!/^https:\/\//i.test(u)) return send(400, { error: "url must start with https://", field: "links[0].url", errors: [{ field: "links[0].url", message: "url must start with https://" }] });
        if (/blocked\.example/.test(u)) return send(400, { error: "url host is not allowed", field: "links[0].url", errors: [{ field: "links[0].url", message: "url host is not allowed" }] });
        const chk = opts.policyCheck || "ok", next = { check_status: chk, check_http: chk === "failed" ? 404 : chk === "ok" ? 200 : null, shown_as: "Employer's own site" };
        const changed = !policyState || policyState.check_status !== next.check_status || u !== policyState.url;
        policyState = { ...next, url: u };
        return send(200, { posting_id: body.posting_id, kind: "policy", changed, active_links: 1, links: [policyEntry()] });
      }
      // prompt BJ: the whole-set replace of the application links (the register page saves them right after the opening is added). opts.applyCheck: "ok" (default) or "failed" (HTTP 404) for every address;
      // opts.applyRefusal = { status, body } makes it refuse. The addresses are never sent back (position and label only), like the real one.
      // opts.linkDelayMs (prompt BK): every address-saving call answers after this long (the server asks each address once), for the wait word
      if (name === "set-destination-links" && opts.linkDelayMs) await new Promise((r) => setTimeout(r, opts.linkDelayMs));
      if (name === "set-destination-links" && poster && (body.kind === undefined || body.kind === "apply")) {
        if (opts.plan !== "verified") return send(403, PLAN_REFUSAL);
        if (opts.applyRefusal) return send(opts.applyRefusal.status, opts.applyRefusal.body);
        const list = Array.isArray(body.links) ? body.links : [];
        if (list.length > 10) return send(400, { error: "links must contain at most 10 entries", field: "links", errors: [{ field: "links", message: "links must contain at most 10 entries" }] });
        const bad = list.findIndex((x) => !String((x && x.url) || "").toLowerCase().startsWith("https://"));
        if (bad >= 0) return send(400, { error: "url must start with https://", field: "links[" + bad + "].url", errors: [{ field: "links[" + bad + "].url", message: "url must start with https://" }] });
        const chk = opts.applyCheck || "ok";
        const links = list.map((x, i) => ({ position: i + 1, kind: "apply", firm: null, label: typeof x.label === "string" && x.label !== "" ? x.label : null, shown_as: "Employer's own site", check_status: chk, check_http: chk === "failed" ? 404 : 200 }));
        if (applyState) applyState = links.map((l) => ({ position: l.position, label: l.label, check_status: l.check_status }));
        return send(200, { posting_id: body.posting_id, changed: true, active_links: links.length, links });
      }
      if (name === "get-my-posting") {
        if (!poster) return unauth();
        // prompt BK: opts.postingStatus: "live" (default), "draft", "scheduled" (a draft with a go-live time), "paused", "closed" or "expired" (a live opening whose clock has run out)
        const ps = state.published ? "live" : (opts.postingStatus || "live");
        const PS = ps === "draft" ? { status: "draft", stored_status: "draft", closed_reason: null, posted_at: null, expiration_date: null, publish_by: inDays(11), go_live_at: null }
          : ps === "scheduled" ? { status: "scheduled", stored_status: "draft", closed_reason: null, posted_at: null, expiration_date: null, publish_by: null, go_live_at: inDays(5) }
          : ps === "paused" ? { status: "paused", stored_status: "paused", closed_reason: null, posted_at: inDays(-10), expiration_date: inDays(35), publish_by: null, go_live_at: null }
          : ps === "closed" ? { status: "closed", stored_status: "closed", closed_reason: "filled", posted_at: inDays(-10), expiration_date: inDays(35), publish_by: null, go_live_at: null }
          : ps === "expired" ? { status: "expired", stored_status: "live", closed_reason: "expired_no_action", posted_at: inDays(-50), expiration_date: inDays(-5), publish_by: null, go_live_at: null }
          : { status: "live", stored_status: "live", closed_reason: null, posted_at: inDays(-10), expiration_date: inDays(35), publish_by: null, go_live_at: null };
        return send(200, { posting: { id: body.posting_id, title: "Data Analyst", req_number: "4471", company_name: "Meridian Health", post_id: opts.kio ? kioOf("ABCDEFGHJKMN").stored : "ABCDEFGHJKMN", ...PS, is_remote: opts.postingRemote === true, locations: (opts.placeText || opts.postingNoPlace) ? [] : ["Austin, TX"], location_ids: (opts.placeText || opts.postingNoPlace) ? [] : ["gn:4671654"], source_location_text: opts.placeText || null, locations_attested: false, ai_filtering: false, ai_interview_other: null, third_party_recruiter: opts.recruiter === true || firmsState.length > 0, req_searchable: true, destination_links_exclusive: false, applicant_cap: null, description_text: Array.from({ length: 60 }, (_, i) => "requirement" + i).join(" "), window_days: 45, created_at: opts.createdAt || inDays(-10), last_edited_at: null },
          destination_links: (applyState ? applyState.map((l) => ({ position: l.position, kind: "apply", firm: null, label: l.label, shown_as: "Employer's own site", check_status: l.check_status, check_http: 200 })) : []).concat(firmEntries(), policyEntry() ? [policyEntry()] : []), plan: planDoc(), recent_changes: opts.recentChanges || [{ at: inDays(-2), note: "Fixed a typo in the third paragraph", kind: "text_correction", fields: ["description_text"] }, { at: inDays(-5), note: "Renamed the role", kind: "edit", fields: ["title"] }] });
      }
      // prompt BH: create-posting answers with a draft (the request body is in site.calls); opts.createRefusal = { status, body } makes it refuse, opts.createDropsPlace answers without the typed place
      if (name === "create-posting") {
        if (!poster) return unauth();
        if (opts.createHold) await createGate.promise;      // prompt BW: the request is held open until site.releaseCreate()
        if (opts.createRefusal) return send(opts.createRefusal.status, opts.createRefusal.body);
        return send(201, { id: "3f1d5b1e-0000-4000-8000-0000000000aa", status: "draft", title: String(body.title || ""), expiration_date: inDays(30), public_code: opts.kio ? kioOf("ABCDEFGHJKMN").stored : "ABCDEFGHJKMN", posting_ref: "abcdefghjkmnpqrstvwx", closed_reason: null, source_location_text: opts.createDropsPlace ? null : (typeof body.source_location_text === "string" ? body.source_location_text : null) });   // the real one answers with the whole row (returning *); opts.createDropsPlace: a server that does not know the typed place yet
      }
      // prompt BK: Publish on the edit page (the same call My openings makes). opts.publishRefusal = { status, body } makes it refuse.
      if (name === "publish-posting") {
        if (!poster) return unauth();
        if (opts.publishRefusal) return send(opts.publishRefusal.status, opts.publishRefusal.body);
        state.published = true;
        return send(200, { posting: { id: body.posting_id, status: "live", title: "Data Analyst", expiration_date: inDays(45), public_code: opts.kio ? kioOf("ABCDEFGHJKMN").stored : "ABCDEFGHJKMN", posting_ref: "abcdefghjkmnpqrstvwx", closed_reason: null } });
      }
      if (name === "edit-posting") return poster ? send(200, { edited: true, changed_fields: ["title"], similarity_pct: null }) : unauth();   // the saved posting reads back as it was (the fake keeps nothing), so a save ends with nothing unsaved
      if (name === "list-posting-comments") return poster ? send(200, { posting_id: body.posting_id, comments: [{ id: "c1", body: "This role was filled last month, according to a friend who works there.", created_at: inDays(-3), is_mine: false }], total: 1, next_offset: null }) : unauth();   // the employer reads the thread of their own posting
      if (name === "candidate-session") return cand ? send(200, { ok: true }) : unauth();
      if (!cand) return send(401, { error: "unauthorized", code: poster ? "not_a_candidate_session" : "unauthorized" });
      // prompt BQ: with opts.kio a search row carries the whole KIO ID (derived from the row's code, which is its posting_ref's first twelve characters)
      const withKio = (p) => (opts.kio ? { ...p, kio_id: kioOf(p.posting_ref.slice(0, 12).toUpperCase()).shown } : p);
      if (name === "candidate-search" && body.kio !== undefined) {
        if (!opts.kio) return send(400, { error: "Unknown field. Only company, phrase, code and req are accepted.", code: "invalid_request", field: "kio" });
        const r = readKio(String(body.kio));
        if (r.kind !== "kio") return send(400, { error: "That ID is not valid. Check it and try again.", code: "invalid_request", field: "kio" });
        if (r.stored === KIO_GONE) return send(410, { error: "gone", code: "gone" });
        let row = RESULTS.map(withKio).find((p) => kioOf(p.posting_ref.slice(0, 12).toUpperCase()).stored === r.stored) || null;
        if (r.stored === KIO_CLOSED) row = { ...RESULTS[0], kio_id: r.display, status: "closed", closed_reason: "filled", closed_at: inDays(-40), posting_ref: "z".repeat(20), masked_code: "****-****-W4T9" };
        if (!row) return send(404, { error: "not_found", code: "not_found" });
        // the notice: only for what was sent, by the page's own plain comparison (letters and digits, case ignored)
        const alnum = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const co = alnum(body.company), ph = alnum(body.phrase);
        const mismatch = (co !== "" && !alnum(row.company_name).startsWith(co)) || (ph !== "" && !alnum(row.title).includes(ph));
        return send(200, { mode: "kio", truncated: false, mismatch, results: [row] });
      }
      if (name === "candidate-search") {
        const co = String(body.company || "").toLowerCase();
        // opts.registeredValues: what is_registered carries on each result in order (true, false, "true", 1, null, or the word omit to leave the key out), for the tests of the check mark rule
        const vals = opts.registeredValues;
        const rows = RESULTS.filter((p) => p.company_name.toLowerCase().includes(co)).map((p, i) => { const q = { ...withKio(p) }; if (vals && i < vals.length) { if (vals[i] === "omit") delete q.is_registered; else q.is_registered = vals[i]; } return q; });
        // opts.placeOverrides: for each result in order an object merged into the row (locations, is_remote, source_location_text), for the tests of the display-only place text (AZ3)
        const placed = opts.placeOverrides ? rows.map((r, i) => Object.assign({}, r, (opts.placeOverrides[i] || {}))) : rows;
        return send(200, { mode: body.req ? "req" : body.code ? "code" : "phrase", truncated: false, results: placed });
      }
      if (name === "candidate-posting-detail" && body.posting_ref === NOLINKS_REF) return send(200, { posting: { ...RESULTS[0], posting_ref: NOLINKS_REF }, links: [], comment_count: 1 });
      if (name === "candidate-posting-detail" && body.posting_ref === CLOSED_REF) return send(409, { error: "posting_not_open", code: "posting_not_open", status: "closed", closed_reason: "filled" });
      if (name === "candidate-post-comment") return send(200, { comment: { id: "c9", body: String(body.body || ""), created_at: new Date().toISOString(), is_mine: true } });
      if (name === "candidate-report-link") return send(200, { report_id: 1 });
      // opts.policyDetail: true = the AI and hiring policy link is sent with the other links; "only" = it is the only link the opening has (no application link)
      const POLICY_ENTRY = { position: 1, kind: "policy", firm: null, label: "Employer's own site" };
      if (name === "candidate-posting-detail") {
        const p = RESULTS.find((x) => x.posting_ref === body.posting_ref);
        if (!p) return send(404, { error: "not_found", code: "not_found" });
        const apply = opts.policyDetail === "only" ? [] : [{ position: 1, label: "Careers site" }, { position: 2, label: "Apply on LinkedIn, the employer's own page" }];
        // opts.detailFirms: [{ firm, label }] named recruiter firms sent with the links (label null = a firm named without an address); prompt BG
        const firmLinks = (opts.detailFirms || []).map((f, i) => ({ position: i + 1, kind: "recruiter", firm: f.firm, label: f.label === undefined ? "Employer's own site" : f.label }));
        // opts.detailOverride (prompt BJ): merged into the posting the comments page and the details call receive (for example { locations: [], source_location_text: "Berlin, Germany" })
        return send(200, { posting: opts.detailOverride ? { ...withKio(p), ...opts.detailOverride } : withKio(p), links: apply.concat(firmLinks, opts.policyDetail ? [POLICY_ENTRY] : []) });
      }
      // with opts.policyDetail the one-time links are https addresses the page accepts (the page opens whatever it is given; the test replaces window.open and reads the address); without it the answer is as it always was
      if (name === "candidate-link-issue") return send(200, { expires_at: inDays(0.0014), links: [{ position: 1, label: "Careers site", go_url: opts.policyDetail || opts.detailFirms ? "https://go.example.invalid/f/apply-1" : SELF + "/404.html" }].concat(opts.detailFirms ? [{ position: 2, label: "Apply on LinkedIn, the employer's own page", go_url: "https://go.example.invalid/f/apply-2" }] : []).concat((opts.detailFirms || []).map((f, i) => ({ position: i + 1, kind: "recruiter", firm: f.firm, label: f.label === undefined ? "Employer's own site" : f.label, go_url: "https://go.example.invalid/f/firm-" + (i + 1) }))).concat(opts.policyDetail ? [{ position: 1, kind: "policy", label: "Employer's own site", go_url: "https://go.example.invalid/f/policy-1" }] : []) });
      if (name === "candidate-list-comments") return send(200, { comments: [{ id: "c1", body: "This role was filled last month, according to a friend who works there.", created_at: inDays(-3), is_mine: false }], total: 1, next_offset: null });
      return send(404, { error: "no such function", code: "not_found" });
    }
    if (url.pathname === "/auth/v1/otp") { const body = await readBody(); calls.push({ name: "auth-otp", address: req.url, body }); return send(200, {}); }
    // the emailed one-time code (October 6, 2026): the code 123456 is right, 000429 is answered with a rate limit, anything else (or the wrong type when opts.codeType says which type this fake accepts) is refused like an expired or wrong code.
    // The kind of session follows the address: poster* -> an employer, both* -> both roles, anything else -> a candidate.
    if (url.pathname === "/auth/v1/verify") {
      const body = await readBody(); calls.push({ name: "auth-verify", address: req.url, body });
      if (body.token === "000429") return send(429, { code: 429, error_code: "over_request_rate_limit", msg: "Too many requests" });
      if (body.token !== "123456" || (opts.codeType ? body.type !== opts.codeType : !["email", "signup"].includes(body.type))) return send(403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
      const em = String(body.email || ""), kind = /^both/i.test(em) ? "both" : /^poster/i.test(em) ? "poster" : "candidate", claims = {};
      if (kind === "poster" || kind === "both") claims.poster_id = crypto.randomUUID();
      if (kind === "candidate" || kind === "both") claims.candidate_identity_id = crypto.randomUUID();
      return send(200, { access_token: fakeJwt({ ...claims, email: em }), token_type: "bearer", expires_in: 3600, refresh_token: "refresh-" + kind, user: { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: em, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
    }
    if (url.pathname === "/auth/v1/user") return send(200, { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "dana@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
    if (url.pathname === "/auth/v1/logout") { res.writeHead(204); return res.end(); }
    if (url.pathname === "/_dev/link") {
      const kind = url.searchParams.get("kind") || "poster";
      const claims = {};
      if (kind === "poster" || kind === "both") claims.poster_id = crypto.randomUUID();
      if (kind === "candidate" || kind === "both") claims.candidate_identity_id = crypto.randomUUID();
      const frag = new URLSearchParams({ access_token: fakeJwt({ ...claims, email: url.searchParams.get("email") || "" }), refresh_token: "refresh-" + kind, expires_in: "3600", token_type: "bearer", type: "magiclink" }).toString();
      res.writeHead(302, { Location: "/auth-callback.html#" + frag }); return res.end();
    }
    let rel = decodeURIComponent(url.pathname); if (rel.endsWith("/")) rel += "index.html";
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { "Content-Type": MIME[".html"] }); const nf = path.join(root, "404.html"); return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : "not found"); }
    const ext = path.extname(file);
    let data = fs.readFileSync(file);
    if ([".html", ".js", ".mjs"].includes(ext)) data = Buffer.from(data.toString("utf8").split(REAL).join(SELF));
    if (rel === "/js/config.js" && opts.commentsOff) data = Buffer.from(data.toString("utf8").replace("COMMENTS_VISIBLE = true", "COMMENTS_VISIBLE = false"));
    if (rel === "/js/config.js" && opts.shortLinkLive) data = Buffer.from(data.toString("utf8").replace("KIO_SHORT_LINK_LIVE = false", "KIO_SHORT_LINK_LIVE = true"));   // opts.shortLinkLive (prompt BQ): the short link switched ON (it ships OFF)
    if (rel === "/js/config.js" && opts.codeOn) data = Buffer.from(data.toString("utf8").replace("EMAIL_CODE_ENTRY = false", "EMAIL_CODE_ENTRY = true"));   // opts.codeOn: the emailed-code field switched ON (it ships OFF, so every other test sees the sign-in pages as shipped)
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": opts.pageCache || "no-store" }); res.end(data);   // opts.pageCache: the Cache-Control the real stage serves (max-age=600), for the test that needs the browser's back/forward cache to be allowed; the default is unchanged
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => { SELF = "http://127.0.0.1:" + server.address().port; resolve({ url: SELF, calls, hits, releaseCreate: () => createGate.release(), close: () => new Promise((r) => { server.close(r); if (server.closeAllConnections) server.closeAllConnections(); }) }); }));
}
