// fake-site.js - the repo's own files served on 127.0.0.1 with a tiny FAKE backend, for the browser tests (tests/signin-tabs.test.js, tests/phone-layout.test.js, tests/header-layout.test.js uses its own copy).
// No real project, no key, no network: every answer below is made up. The real API origin written into the pages and scripts is replaced with this server's own address.
//   startFakeSite(root)  -> { url, calls, close() }      calls: every backend request seen { name, body, auth } (the sign-in e-mail request is recorded as name "auth-otp" with its full address and body)
//   /_dev/link?kind=poster|candidate|both   what the emailed link does: redirects to auth-callback.html with a fake session in the fragment (both = an address that is an employer AND a verified candidate)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const REAL = "https://tpmvkjuhbbwftqoodzcn.supabase.co";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".json": "application/json" };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export const fakeJwt = (claims) => b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: "00000000-0000-4000-8000-000000000001", role: "authenticated", aud: "authenticated", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...claims }) + ".sig";
export const NOLINKS_REF = "m".repeat(20), CLOSED_REF = "c".repeat(20);   // a posting reference with no employer links, and one that is closed (detail answers 409 posting_not_open)
export const LONG_NAME = "Bartholomew Featherstonehaugh-Wolverhampton", LONG_ORG = "Meridian Health Systems of the Greater Providence and Boston Region";
const day = 864e5, inDays = (d) => new Date(Date.now() + d * day).toISOString();
const code = (c) => "****-****-" + c.slice(-4);
const posting = (company, title, pcode, extra) => Object.assign({ company_name: company, title, locations: ["Austin, TX"], is_remote: false, posted_at: inDays(-12), closes_at: inDays(33), applicant_cap: null, status: "live", closed_reason: null, ai_filtering: false, ai_interview_other: false, ai_disclosure_shown: false, third_party_recruiter: false, masked_req: "4****71", masked_code: code(pcode), posting_ref: pcode.toLowerCase().padEnd(20, "x"), last_edited_at: null }, extra || {});
const RESULTS = [
  posting("Meridian Health Systems of the Greater Region", "Senior Data Analyst, Population Health Reporting and Quality Improvement", "D21M48YBZQBF", { locations: ["Boston, MA", "Providence, RI", "Hartford, CT"], ai_filtering: true, ai_disclosure_shown: true, applicant_cap: 250 }),
  posting("Meridian Health Systems of the Greater Region", "Nurse Practitioner", "K7Q3W9ZT2XPM", { is_remote: true, locations: [], ai_interview_other: true, ai_disclosure_shown: true }),
];
const MINE = [
  ["Senior Data Analyst", "4471", "D21M48YBZQBF", "live", 17, 138], ["Nurse Practitioner", "R-2026-0451", "K7Q3W9ZT2XPM", "paused", 9, 52], ["Analytics Team Lead", "4390", "P4R9T2V6X8ZA", "scheduled", null, 0],
  ["Junior BI Developer", "4210", "A1B2C3D4E5F6", "draft", null, 0], ["Data Governance Analyst", "4118", "H7J8K9M1N2P3", "expired", -15, 12],
].map(([title, req, pc, status, exp, comments], i) => ({ id: "3f1d5b1e-0000-4000-8000-00000000000" + (i + 1), title, req_number: req, post_id: pc, status, closed_reason: status === "expired" ? "expired_no_action" : null, stored_status: status === "scheduled" ? "draft" : status === "expired" ? "live" : status, is_remote: false, locations: ["Austin, TX"], location_ids: [], locations_attested: false,
  window_days: 45, posted_at: status === "draft" || status === "scheduled" ? null : inDays(-12), expiration_date: exp === null ? null : inDays(exp), publish_by: status === "draft" ? inDays(11) : null, go_live_at: status === "scheduled" ? inDays(20) : null, applicant_cap: i === 0 ? 250 : null, bump_used: false, bump_days: null, created_at: inDays(-20), last_edited_at: null, comment_count: comments }));
const ROSTER = [
  { poster_id: "00000000-0000-4000-8000-0000000000aa", full_name: "Dana Whitfield", email: "dana.whitfield@meridian-health-systems.example", is_org_admin: true, status: "active", added_at: inDays(-40), first_signin_at: inDays(-40), last_verified_at: inDays(-2) },
  { poster_id: "00000000-0000-4000-8000-0000000000ab", full_name: "Sam Owner", email: "sam@meridian.example", is_org_admin: false, status: "active", added_at: inDays(-20), first_signin_at: inDays(-19), last_verified_at: inDays(-5) },
  { poster_id: "00000000-0000-4000-8000-0000000000ac", full_name: "Lee Invited", email: "lee@meridian.example", is_org_admin: false, status: "invited", added_at: inDays(-1), first_signin_at: null, last_verified_at: null },
];
const ANALYTICS = { live_postings: 4, searches: 1284, detail_views: 406, link_clicks: 151, platform_activity_total: 5400, share_of_registry_pct: 18.4,
  by_posting: [{ posting_id: "3f1d5b1e-0000-4000-8000-000000000001", title: "Senior Data Analyst", status: "live", closed_reason: null, expiration_date: inDays(17), searches: 412, detail_views: 138, link_clicks: 61 }, { posting_id: "3f1d5b1e-0000-4000-8000-000000000002", title: "Nurse Practitioner", status: "paused", closed_reason: null, expiration_date: inDays(9), searches: 163, detail_views: 52, link_clicks: 18 }, { posting_id: "3f1d5b1e-0000-4000-8000-000000000003", title: "Support Engineer II", status: "closed", closed_reason: "filled", expiration_date: inDays(-2), searches: 44, detail_views: 13, link_clicks: 3 }],
  by_link: [{ link_id: "4f1d5b1e-0000-4000-8000-000000000001", posting_id: "3f1d5b1e-0000-4000-8000-000000000001", source_label: "Careers site, primary listing", kind: "apply", firm_name: null, display_order: 1, clicks: 88 }, { link_id: "4f1d5b1e-0000-4000-8000-000000000003", posting_id: "3f1d5b1e-0000-4000-8000-000000000002", source_label: null, kind: "recruiter", firm_name: "Recruiter-provided link", display_order: 1, clicks: 16 }],
  by_search_mode: { phrase: 61, code: 24, req: 15 } };

// opts.commentsOff: serve js/config.js with the comments switch turned OFF (COMMENTS_VISIBLE false), to test the pages in that state. By default the fake site serves the file exactly as shipped, which is ON since October 6, 2026, so every test written for the pages with comments keeps covering them
export function startFakeSite(root, opts = {}) {
  root = path.resolve(root);
  const calls = []; let SELF = "";
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const send = (status, body, extra) => { res.writeHead(status, Object.assign({ "Content-Type": "application/json", "Cache-Control": "no-store" }, extra || {})); res.end(typeof body === "string" ? body : JSON.stringify(body)); };
    const readBody = () => new Promise((ok) => { let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch { ok({}); } }); });
    const claimsOf = () => { try { return JSON.parse(Buffer.from(String(req.headers.authorization || "").replace(/^Bearer /, "").split(".")[1], "base64url").toString()); } catch { return null; } };
    if (url.pathname.startsWith("/functions/v1/")) {
      const name = url.pathname.slice(14), body = await readBody(), c = claimsOf();
      calls.push({ name, body, auth: c ? { poster: typeof c.poster_id === "string", candidate: typeof c.candidate_identity_id === "string" } : null });
      const poster = c && typeof c.poster_id === "string", cand = c && typeof c.candidate_identity_id === "string";
      const unauth = () => send(401, { error: "unauthorized", code: "unauthorized" });
      if (name === "poster-login-intent") return send(202, { ok: true });
      if (name === "poster-session") return poster ? send(200, { poster: { poster_id: c.poster_id, full_name: LONG_NAME, is_org_admin: true }, organization: { organization_id: "00000000-0000-4000-8000-0000000000bb", name: LONG_ORG }, verified_at: new Date().toISOString(), reverify_by: inDays(30), plan: { verified: false, source: null, expires_at: null, lapsed: false } }) : unauth();
      if (name === "list-my-postings") return poster ? send(200, { total: MINE.length, postings: body.offset ? [] : MINE, next_offset: null }) : unauth();
      if (name === "employer-analytics") return poster ? send(200, ANALYTICS) : unauth();
      if (name === "poster-roster-list") return poster ? send(200, { posters: ROSTER.map((p, i) => (i === 0 ? { ...p, poster_id: c.poster_id } : p)) }) : unauth();
      if (name === "get-my-posting") {
        if (!poster) return unauth();
        return send(200, { posting: { id: body.posting_id, title: "Data Analyst", req_number: "4471", company_name: "Meridian Health", post_id: "ABCDEFGHJKMN", status: "live", closed_reason: null, stored_status: "live", is_remote: false, locations: ["Austin, TX"], location_ids: ["gn:4671654"], locations_attested: false, ai_filtering: false, ai_interview_other: null, third_party_recruiter: false, req_searchable: true, destination_links_exclusive: false, applicant_cap: null, description_text: Array.from({ length: 60 }, (_, i) => "requirement" + i).join(" "), window_days: 45, posted_at: inDays(-10), expiration_date: inDays(35), publish_by: null, go_live_at: null, created_at: inDays(-10), last_edited_at: null },
          destination_links: [], plan: { verified: false, source: null, expires_at: null, lapsed: false }, recent_changes: [{ at: inDays(-2), note: "Fixed a typo in the third paragraph", kind: "text_correction", fields: ["description_text"] }, { at: inDays(-5), note: "Renamed the role", kind: "edit", fields: ["title"] }] });
      }
      if (name === "edit-posting") return poster ? send(200, { edited: true, changed_fields: ["title"], similarity_pct: null }) : unauth();   // the saved posting reads back as it was (the fake keeps nothing), so a save ends with nothing unsaved
      if (name === "list-posting-comments") return poster ? send(200, { posting_id: body.posting_id, comments: [{ id: "c1", body: "This role was filled last month, according to a friend who works there.", created_at: inDays(-3), is_mine: false }], total: 1, next_offset: null }) : unauth();   // the employer reads the thread of their own posting
      if (name === "candidate-session") return cand ? send(200, { ok: true }) : unauth();
      if (!cand) return send(401, { error: "unauthorized", code: poster ? "not_a_candidate_session" : "unauthorized" });
      if (name === "candidate-search") {
        const co = String(body.company || "").toLowerCase();
        const rows = RESULTS.filter((p) => p.company_name.toLowerCase().includes(co));
        return send(200, { mode: body.req ? "req" : body.code ? "code" : "phrase", truncated: false, results: rows });
      }
      if (name === "candidate-posting-detail" && body.posting_ref === NOLINKS_REF) return send(200, { posting: { ...RESULTS[0], posting_ref: NOLINKS_REF }, links: [], comment_count: 1 });
      if (name === "candidate-posting-detail" && body.posting_ref === CLOSED_REF) return send(409, { error: "posting_not_open", code: "posting_not_open", status: "closed", closed_reason: "filled" });
      if (name === "candidate-post-comment") return send(200, { comment: { id: "c9", body: String(body.body || ""), created_at: new Date().toISOString(), is_mine: true } });
      if (name === "candidate-report-link") return send(200, { report_id: 1 });
      if (name === "candidate-posting-detail") { const p = RESULTS.find((x) => x.posting_ref === body.posting_ref); return p ? send(200, { posting: p, links: [{ position: 1, label: "Careers site" }, { position: 2, label: "Apply on LinkedIn, the employer's own page" }] }) : send(404, { error: "not_found", code: "not_found" }); }
      if (name === "candidate-link-issue") return send(200, { expires_at: inDays(0.0014), links: [{ position: 1, label: "Careers site", go_url: SELF + "/404.html" }] });
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
      const frag = new URLSearchParams({ access_token: fakeJwt({ ...claims, email: "" }), refresh_token: "refresh-" + kind, expires_in: "3600", token_type: "bearer", type: "magiclink" }).toString();
      res.writeHead(302, { Location: "/auth-callback.html#" + frag }); return res.end();
    }
    let rel = decodeURIComponent(url.pathname); if (rel.endsWith("/")) rel += "index.html";
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { "Content-Type": MIME[".html"] }); const nf = path.join(root, "404.html"); return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : "not found"); }
    const ext = path.extname(file);
    let data = fs.readFileSync(file);
    if ([".html", ".js", ".mjs"].includes(ext)) data = Buffer.from(data.toString("utf8").split(REAL).join(SELF));
    if (rel === "/js/config.js" && opts.commentsOff) data = Buffer.from(data.toString("utf8").replace("COMMENTS_VISIBLE = true", "COMMENTS_VISIBLE = false"));
    if (rel === "/js/config.js" && opts.codeOff) data = Buffer.from(data.toString("utf8").replace("EMAIL_CODE_ENTRY = true", "EMAIL_CODE_ENTRY = false"));   // opts.codeOff: the emailed-code field switched off
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(data);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => { SELF = "http://127.0.0.1:" + server.address().port; resolve({ url: SELF, calls, close: () => new Promise((r) => server.close(r)) }); }));
}
