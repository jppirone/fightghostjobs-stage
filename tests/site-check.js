// site-check.js - static rules for the whole site. Run: node tests/site-check.js [rootDir]      (exit 1 on any finding)
// The site handles two kinds of session and shows text written by strangers (postings, comments), so these rules are enforced by a program, not by care:
//   S1  every page carries the one expected Content-Security-Policy (scripts only from this site; the only network destination is the project's own API)
//   S2  every page says noindex, nofollow
//   S3  no inline script, no inline event handler, no javascript: URL
//   S4  every <script> is a module from js/ and exists
//   S5  no way to turn text into HTML or code (innerHTML, outerHTML, insertAdjacentHTML, document.write, eval, new Function, string timers)
//   S6  every import resolves to a real file
//   S7  every local href / src / stylesheet exists
//   S8  no network address other than the project's API appears in code, markup or styles (no CDN, no analytics, no font host); the one exception is the pricing card's link to https://www.fightghostjobs.com/plans.html
//   S31 the brand and accessibility structure: skip link, header with the logo as the way home, main, footer, the darker palette, the shared accessibility rules
//   S9  no secret: no secret key, no token, no database URL; the publishable key appears only in js/config.js
//   S10 the vendored Auth client is byte-identical to the recorded hash
//   S11 every font file the stylesheet names exists; nothing is @imported
//   S12 links that open a new tab carry rel="noopener"
//   S13 styles.css is loaded before app.css on every page
//   S14 the empty-search note says closed or expired postings appear only by postID, and search.js uses that note
//   S15 the register form's window is 14 to 45 days (default 45), matches the backend range, and the extended tier is not offered
//   S17 a table is never wrapped in an element that clips it (overflow:hidden): a too-wide table must scroll sideways, or its last column (the row actions once) silently disappears off the edge
//   S18 the req number: the candidate's req box on search.html is MASKED as it is typed (type=password) with a show/hide toggle, and the register hint says it is required, searchable by candidates, masked, rate-limited and always visible to the employer
//   S19 the requirements-text hint ("compared with any later changes ...") is on the register form AND the edit page, word for word, and the edit page's note label is the approved one
//   S22 privacy.html with the approved sections; every page links to it (footer) and carries the privacy contact; both email boxes link to it
//   S36 comments: no text says an employer can contest, dispute or answer a comment, or sees comments across postings (neither is built); the employer's note says the page shows the comments on this one posting
//   S35 (TEMPORARY, John 2026-09-30) no user-facing text says whether employer analytics or reporting is free or paid or in a tier (the code does not gate it yet); John removes this rule when the tier gate is built
//   S34 the register form has no editable company field: the company name is shown read only from the organization, the form never reads or sends one (the server takes it from the organization and ignores any in the request)
//   S33 links: every link goes somewhere real: a mailto only to an approved address and only where its text says it opens an email, no tel or # or empty or javascript: link, every internal target and #anchor exists, new-tab links have rel=noopener, external links only to the marketing site, and the pricing card's "See what's included" goes to the marketing plans page
//   S32 public wording: the app never says or implies it confirms a posting is real (the badge says Registered, the details dialog says what it does not confirm), and makes no price promise (no always, forever, permanently, no cost)
//   S23 no page promises what is not built (cross-posting count, ATS import, company-wide view, "1 in 5", "Upgrade to add"); the sample card says it is fictional
//   S24 the Team page exists with its controls and calls the roster only through api.js
//   S25 the AI-disclosure "i" tooltips are on the register AND edit pages (designed wording), positioned and tap-able; the destination-link rows are on both pages and register.js saves them
//   S26 the candidate's details dialog explains the one-time links and what to do when one is wrong; the employer pages say the label is theirs only; api.js accepts the derived label + check
//   S27 the recruiter-firm editor is on register AND edit (no "coming soon"), saved through api.setRecruiterFirms; the search page renders "Recruiter firm: <name>"
//   S28 the employer's AI notes: a 300-char box under each AI toggle on both pages (shown to candidates, no web addresses), checked by the shared rule, shown on the search card as the employer's words
//   S29 candidate comments: comments.html (thread, compose, private wrong-link report, employer read-only) reached only with ?ref= / ?id=, through api.js; anonymous; the privacy page says what is kept
//   S16 locations are chosen from the catalog, not typed: the picker markup and the one-opening statement are on the form, the caps match the backend (13 / 3 / 10), the form never sends free text, the GeoNames + Census
//       attribution is on the page, the catalog files are the ones recorded in their manifest, and only js/location-catalog.js loads the catalog module
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const API_ORIGIN = "https://tpmvkjuhbbwftqoodzcn.supabase.co";
export const EXPECTED_CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src " + API_ORIGIN + "; base-uri 'self'; form-action 'self'; object-src 'none'";
export const EXPECTED_CSP_404 = "default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'";

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};
const stripJsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, "$1")).join("\n");

export function checkSite(root) {
  const findings = []; const add = (rule, file, msg) => findings.push({ rule, file: path.relative(root, file).replace(/\\/g, "/"), msg });
  const files = walk(root);
  const html = files.filter((f) => f.endsWith(".html")), js = files.filter((f) => f.endsWith(".js") && !f.includes(path.sep + "tests" + path.sep) && !f.includes(path.sep + "vendor" + path.sep)), css = files.filter((f) => f.endsWith(".css"));
  const mjs = files.filter((f) => f.endsWith(".mjs"));
  const read = (f) => fs.readFileSync(f, "utf8");

  for (const f of html) {
    const s = read(f); const name = path.basename(f);
    const csps = [...s.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/g)].map((m) => m[1]);
    if (csps.length !== 1) add("S1", f, "expected exactly one Content-Security-Policy meta, found " + csps.length);
    else if (csps[0] !== (name === "404.html" ? EXPECTED_CSP_404 : EXPECTED_CSP)) add("S1", f, "the Content-Security-Policy is not the expected one");
    if (!/<meta name="robots" content="noindex, nofollow">/.test(s)) add("S2", f, "missing noindex, nofollow");
    const scripts = [...s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    for (const m of scripts) {
      const attrs = m[1];
      if (!/\bsrc="/.test(attrs) || m[2].trim() !== "") add("S3", f, "inline <script>");
      else {
        const src = (attrs.match(/\bsrc="([^"]*)"/) || [])[1] || "";
        // the one non-module script allowed is the STAGE-ONLY gate (S30), which must run before the page renders
        if (src === "js/stage-gate.js" && !/\btype="module"/.test(attrs)) { if (!fs.existsSync(path.join(root, src))) add("S4", f, "script does not exist: " + src); }
        else if (!/\btype="module"/.test(attrs) || !/^js\/[a-z0-9\/-]+\.js$/i.test(src)) add("S4", f, "script must be a module from js/: " + src);
        else if (!fs.existsSync(path.join(root, src))) add("S4", f, "script does not exist: " + src);
      }
    }
    if (/\son[a-z]+\s*=\s*["']/i.test(s.replace(/<script[\s\S]*?<\/script>/gi, ""))) add("S3", f, "inline event handler attribute");
    if (/\b(href|src|action)\s*=\s*["']\s*javascript:/i.test(s)) add("S3", f, "javascript: URL");
    if (/<a\b[^>]*target="_blank"(?![^>]*rel="[^"]*noopener)[^>]*>/i.test(s) || /<a\b(?![^>]*rel="[^"]*noopener)[^>]*target="_blank"[^>]*>/i.test(s)) add("S12", f, "target=_blank without rel=noopener");
    for (const m of s.matchAll(/\b(?:href|src)\s*=\s*"([^"]*)"/g)) {
      const u = m[1];
      if (u === "" || u.startsWith("#") || u.startsWith("mailto:")) continue;
      if (/^https?:\/\//i.test(u)) { if (!u.startsWith(API_ORIGIN) && u !== "https://www.fightghostjobs.com/plans.html") add("S8", f, "external address in markup: " + u); continue; }   // the one exception: the pricing card's navigation link to the marketing plans page (rule S33 pins where it may appear)
      const target = u.split("#")[0].split("?")[0];
      const p = target.startsWith("/") ? path.join(root, target) : path.join(path.dirname(f), target);
      if (!fs.existsSync(p)) add("S7", f, "broken local reference: " + u);
    }
    const ci = s.indexOf('href="styles.css"'), ca = s.indexOf('href="app.css"');
    if (name !== "404.html" && (ci < 0 || ca < 0 || ci > ca)) add("S13", f, "styles.css must be loaded, then app.css");
  }

  const importRe = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  for (const f of js.concat(mjs.filter((x) => !x.includes(path.sep + "vendor" + path.sep)))) {
    const raw = read(f), s = stripJsComments(raw);
    const bans = [[/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\b|createContextualFragment/, "S5", "a way to turn text into HTML"], [/\beval\s*\(|new\s+Function\b|\bFunction\s*\(/, "S5", "eval / Function"],
      [/setTimeout\s*\(\s*["'`]|setInterval\s*\(\s*["'`]/, "S5", "a string timer"], [/document\.cookie/, "S9", "cookie access"], [/importScripts|XMLHttpRequest|WebSocket|sendBeacon|EventSource/, "S8", "a network path other than fetch through api.js"]];
    for (const [re, rule, msg] of bans) if (re.test(s)) add(rule, f, msg);
    if (/\bfetch\s*\(/.test(s) && !/js[\\/]api\.js$/.test(f)) add("S8", f, "fetch outside api.js");
    for (const m of s.matchAll(importRe)) {
      const spec = m[1] || m[2];
      if (!spec.startsWith(".")) { add("S6", f, "bare import: " + spec); continue; }
      if (!fs.existsSync(path.resolve(path.dirname(f), spec))) add("S6", f, "import does not resolve: " + spec);
    }
    for (const m of s.matchAll(/https?:\/\/[^\s"'`)<>]+/g)) if (!m[0].startsWith(API_ORIGIN)) add("S8", f, "network address in code: " + m[0]);
    if (/_blank/.test(s) && !/noopener/.test(s)) add("S12", f, "a new-tab open without noopener");
  }

  for (const f of css) {
    const s = read(f);
    if (/@import/i.test(s)) add("S11", f, "@import (nothing may be pulled from elsewhere)");
    if (/url\(\s*["']?https?:/i.test(s)) add("S8", f, "external URL in styles");
    for (const m of s.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) if (!/^(data:|https?:)/.test(m[1]) && !fs.existsSync(path.join(path.dirname(f), m[1]))) add("S11", f, "missing file: " + m[1]);
  }

  // secrets: nowhere. The publishable key only in js/config.js.
  const textFiles = files.filter((f) => /\.(html|js|mjs|css|json|md|txt)$/.test(f) && !f.includes(path.sep + "node_modules" + path.sep) && !f.includes(path.sep + "tests" + path.sep));   // the checks themselves name the patterns they look for
  let pubHits = 0;
  for (const f of textFiles) {
    const s = read(f); const isVendor = f.includes(path.sep + "vendor" + path.sep);
    if (/sb_secret_[A-Za-z0-9_-]{6,}|postgres(?:ql)?:\/\/|SB_POOLED_DB_URL|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/.test(s) || (!isVendor && /service_role/.test(s))) add("S9", f, "a secret-looking value");
    const pk = s.match(/sb_publishable_[A-Za-z0-9_-]+/g) || [];
    if (pk.length) { pubHits += pk.length; if (!/js[\\/]config\.js$/.test(f) && !/tests[\\/]/.test(f)) add("S9", f, "the publishable key outside js/config.js"); }
  }
  const cfg = path.join(root, "js", "config.js");
  if (fs.existsSync(cfg)) { if (!/export const PUBLISHABLE_KEY = "sb_publishable_[A-Za-z0-9_-]+";/.test(read(cfg))) add("S9", cfg, "config.js must hold exactly the publishable key"); if (/sb_secret_/.test(read(cfg))) add("S9", cfg, "SECRET KEY in config.js"); }
  else add("S6", root, "js/config.js is missing");

  // S14: the empty-search note keeps its last sentence (a title search never lists closed or expired postings, so "no match" must say where they can be found), and the page uses that one note.
  const si = path.join(root, "js", "search-input.js"), sp = path.join(root, "js", "pages", "search.js");
  if (fs.existsSync(si) && fs.existsSync(sp)) {
    const note = (read(si).match(/export const NO_MATCH_NOTE = "([^"]*)";/) || [])[1] || "";
    if (!note.endsWith("Closed or expired postings appear only when you search by postID.")) add("S14", si, "NO_MATCH_NOTE must end with the closed-or-expired-by-code sentence");
    const src = read(si);
    const fn = (src.match(/export function noMatchMessage\([^)]*\)\s*\{([\s\S]*?)\n\}/) || [])[1] || "";
    if (!/\+\s*NO_MATCH_NOTE;\s*$/.test(fn.trim())) add("S14", si, "noMatchMessage must end with NO_MATCH_NOTE");
    if (!/No postings found for/.test(fn)) add("S14", si, "noMatchMessage must echo what was searched (\"No postings found for ...\")");
    const page = read(sp);
    if (!/import\s*\{[^}]*\bnoMatchMessage\b[^}]*\}\s*from\s*"\.\.\/search-input\.js"/.test(page) || !/empty-note[^\n]*noMatchMessage\(searched\.company, searched\.query, searched\.kind\)\)/.test(page)) add("S14", sp, "the empty-result message must be noMatchMessage(company, query, kind)");
    if (/No postings? (found|matched)/.test(page)) add("S14", sp, "a second, hand-written empty-result message");
  } else add("S14", root, "js/search-input.js or js/pages/search.js is missing");

  // S15: the register form offers the standard window range the backend and the database enforce (14 to 45 days, 45 by default) and offers nothing longer.
  const rf = path.join(root, "js", "register-form.js"), rh = path.join(root, "register.html");
  if (fs.existsSync(rf) && fs.existsSync(rh)) {
    if (!read(rf).includes("export const MIN_WINDOW_DAYS = 14, MAX_WINDOW_DAYS = 45;")) add("S15", rf, "the window range must be exactly 14 to 45 (the backend and the database enforce the same)");
    const rhtml = read(rh);
    if (!/<input id="livedays"[^>]*value="45"/.test(rhtml)) add("S15", rh, "the window input (id=livedays) must exist and default to 45");
    if (!rhtml.includes("14 to 45 days")) add("S15", rh, "the form must say the window is 14 to 45 days");
    if (/id="tier"|extended tier|value="extended"/i.test(rhtml)) add("S15", rh, "the extended tier must not be offered in the form");
  } else add("S15", root, "js/register-form.js or register.html is missing");

  // S16: the location picker (pass 12c). Locations are CHOSEN from the catalog (ids); the database refuses anything else, and these checks keep the page honest about it.
  const lr = path.join(root, "js", "location-rules.js"), lc = path.join(root, "js", "location-catalog.js"), dm = path.join(root, "js", "data", "locations-us.js");
  if (fs.existsSync(rf) && fs.existsSync(rh) && fs.existsSync(lr) && fs.existsSync(lc) && fs.existsSync(dm)) {
    const rhtml = read(rh), rules = read(lr), form = stripJsComments(read(rf));
    if (!rules.includes("export const CAPS = { total: 13, areas: 3, states: 10 };")) add("S16", lr, "the caps must be exactly 13 in all, 3 areas, 10 states (the database and the edge functions enforce the same)");
    if (/<input id="loc"/.test(rhtml)) add("S16", rh, "a free-text location input (id=loc) must not exist: locations are chosen from the catalog");
    for (const id of ["locq", "locList", "locChips", "attestRow", "attest"]) if (!new RegExp('id="' + id + '"').test(rhtml)) add("S16", rh, "the picker markup is missing id=" + id);
    for (const f of ["locpicker", "attest"]) if (!rhtml.includes('data-error-for="' + f + '"')) add("S16", rh, "no place to show the " + f + " error");
    if (!/<input id="locq"[^>]*role="combobox"/.test(rhtml)) add("S16", rh, "the picker input must be a combobox");
    if (!rhtml.includes("This is one opening that can be filled from any of these locations, not separate openings.")) add("S16", rh, "the one-opening statement must be on the form, word for word");
    if (!/id="locAttribution"[^>]*>[^<]*GeoNames[^<]*CC BY 4\.0[^<]*Census/.test(rhtml)) add("S16", rh, "the GeoNames (CC BY 4.0) and Census attribution must be on the page");
    const body = (form.match(/export function buildCreateBody\([^)]*\)\s*\{([\s\S]*?)\n\}/) || [])[1] || "";
    if (/\blocations\s*:|body\.locations\s*=/.test(body) || !/body\.location_ids = /.test(body) || !/body\.locations_attested = /.test(body)) add("S16", rf, "buildCreateBody must send location_ids and locations_attested, never free-text locations");
    for (const f of js) if (f !== lc && f !== dm && /locations-us\.js/.test(stripJsComments(read(f)))) add("S16", f, "only js/location-catalog.js may load the catalog module");
    if (!/import\("\.\/data\/locations-us\.js"\)/.test(stripJsComments(read(lc)))) add("S16", lc, "the catalog module must be loaded lazily (dynamic import)");
    const manifests = files.filter((f) => /[\\/]data[\\/]location-catalog-[^\\/]+\.manifest\.json$/.test(f));
    if (manifests.length !== 1) add("S16", root, "expected exactly one catalog manifest in data/, found " + manifests.length);
    else {
      const man = JSON.parse(read(manifests[0])), seed = manifests[0].replace(/\.manifest\.json$/, ".json"), sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
      if (!fs.existsSync(seed) || sha(seed) !== man.seed_sha256) add("S16", seed, "the catalog seed file does not match its manifest");
      if (sha(dm) !== man.module_sha256) add("S16", dm, "the catalog module does not match its manifest");
      if (!seed.endsWith("location-catalog-" + man.catalog_version + ".json")) add("S16", seed, "the seed file name must carry the catalog version");
    }
  } else add("S16", root, "the location picker files are missing");

  // S17: no overflow:hidden on the element that directly wraps a <table> (it would cut off the columns that do not fit)
  for (const f of html) if (/<[a-z]+\b[^>]*style="[^"]*overflow\s*:\s*hidden[^"]*"[^>]*>\s*<table\b/i.test(read(f))) add("S17", f, "a table is wrapped in an overflow:hidden element: a too-wide table would be clipped, not scrolled");

  // S18: the req number decisions (pass 12f)
  const sh = path.join(root, "search.html");
  if (fs.existsSync(sh) && fs.existsSync(rh)) {
    const shtml = read(sh), rhtml2 = read(rh);
    if (!/<input id="reqq" type="password"/.test(shtml)) add("S18", sh, "the candidate's req number box (id=reqq) must be a masked input (type=password)");
    if (!/<button type="button" id="reqToggle"/.test(shtml)) add("S18", sh, "the req box needs its show/hide toggle (id=reqToggle)");
    const hint = "Required. Your own reference, such as your ATS number. Once the posting is live, candidates can find it by company name plus this number. They see it masked (for example FGJ****45), and these lookups are rate-limited. You always see the full number in My postings.";
    if (!rhtml2.includes(hint)) add("S18", rh, "the register form's req number hint must carry the approved wording, word for word");
    if (/Req number (optional)/.test(rhtml2)) add("S18", rh, "the req number is required: its label must not say optional");
  }

  // S19: the approved requirements-text hint and the change-note label (slice C)
  const eh = path.join(root, "edit.html");
  if (fs.existsSync(rh) && fs.existsSync(eh)) {
    const REQ_TEXT_HINT = "This text is compared with any later changes to it. Small corrections (a typo, a tightened sentence, a dropped line) save straight away and are never flagged or held up. If a change would rewrite most of it, we'll ask you to register it as a new posting with its own req number, so candidates can tell which role they're looking at. Each change is saved with a short note.";
    for (const f of [rh, eh]) if (!read(f).includes('<div id="reqTextHint" class="field-hint">' + REQ_TEXT_HINT + "</div>")) add("S19", f, "the requirements-text hint (#reqTextHint) must carry the approved wording, word for word");
    if (!read(eh).includes("What changed, and why? (required; kept with the posting).")) add("S19", eh, "the change-note label must be the approved wording");
    if (!/<input id="note" type="text" maxlength="500"/.test(read(eh))) add("S19", eh, "the change note input (id=note, at most 500 characters) is missing");
  }

  // S20: destination links on the edit page (item 3, destination links tier): the section and its controls exist, a free organization is pointed to sales, the page saves through setDestinationLinks, and it never reads an address back (the server sends position and label only)
  if (fs.existsSync(eh)) {
    const eht = read(eh), ejs = path.join(root, "js", "pages", "edit.js");
    for (const id of ["linksCard", "linksLocked", "linksForm", "linkRows", "exclusiveRow", "exclusiveToggle"]) if (!eht.includes('id="' + id + '"')) add("S20", eh, "the edit page is missing #" + id + " (destination links, destination links tier)");
    if (!/<a href="mailto:sales@fightghostjobs\.com[^"]*"[^>]*>Write to sales@fightghostjobs\.com/.test(eht)) add("S20", eh, "the locked destination-links section must point to sales@fightghostjobs.com");
    if (fs.existsSync(ejs)) {
      const code = read(ejs);
      if (!code.includes("api.setDestinationLinks(")) add("S20", ejs, "the edit page must save the links through api.setDestinationLinks");
      if (/destination_links[^;\n]*\.url\b/.test(code) || /\.url\s*=[^=]*destination_links/.test(code)) add("S20", ejs, "the edit page must not read an address back from the stored links (position and label only)");
    }
  }

  // S21: the scheduled go-live control (pass 14): on the register form AND the edit page, the approved disclosure (0-15 minutes after the chosen time; the window counts from the actual go-live) word for word,
  // a datetime-local input, and the pages send it through api.schedulePosting (never a made-up start date)
  {
    const HINT = "Choose a time between 1 hour and 90 days from now. Your posting goes live within 15 minutes after that time, and its closing date is counted from the moment it actually goes live, not from now. Until then it is a scheduled draft that candidates cannot see; you can change the time, remove it or publish it now from My postings.";
    for (const f of [rh, eh]) {
      if (!fs.existsSync(f)) continue;
      const t = read(f);
      if (!t.includes('<div id="goLiveHint" class="field-hint">' + HINT + "</div>")) add("S21", f, "the go-live disclosure (#goLiveHint) must carry the approved wording, word for word");
      if (!/<input id="gldate" type="datetime-local"/.test(t)) add("S21", f, "the go-live input (id=gldate) must be a datetime-local input");
    }
    if (fs.existsSync(rh)) for (const id of ["glNow", "glLater", "glWhen"]) if (!read(rh).includes('id="' + id + '"')) add("S21", rh, "the register form is missing #" + id + " (when should it go live)");
    for (const js of ["register.js", "edit.js"]) { const p = path.join(root, "js", "pages", js); if (fs.existsSync(p) && !read(p).includes("api.schedulePosting(")) add("S21", p, js + " must schedule through api.schedulePosting");
      if (fs.existsSync(p) && /posted_at|start_date|expiration_date\s*:/.test(read(p).split("\n").filter((l) => /schedulePosting|go_live/.test(l)).join("\n"))) add("S21", p, js + " must not send a start or posted date: only go_live_at is sent"); }
  }

  // S22: privacy (launch readiness). privacy.html exists with the approved sections and the cookie sentence; EVERY page carries the footer link to it and the privacy contact; the two email boxes link to it too.
  {
    const ph = path.join(root, "privacy.html");
    if (!fs.existsSync(ph)) add("S22", ph, "privacy.html is missing");
    else {
      const t = read(ph);
      for (const need of ["If you look up postings", "If you register postings", "Cookies", "Who processes the data", "How long", "<code>__cf_bm</code>", "We set no cookies of our own", "privacy@fightghostjobs.com", "for as long as the registry exists", 'id="privacyEmails"', "five days and one day from closing", "at most once every six hours", "never its description, a comment's text or an apply link", "no unsubscribe for these operational messages yet"]) if (!t.includes(need)) add("S22", ph, "privacy.html must say: " + need);
    }
    for (const f of html) { const t = read(f); if (!/<a href="privacy\.html">Privacy<\/a>/.test(t)) add("S22", f, "every page must link to privacy.html from its footer"); if (!t.includes('href="mailto:privacy@fightghostjobs.com"')) add("S22", f, "every page must carry the privacy contact"); }
    if (fs.existsSync(sh) && !/never shown to anyone\. <a href="privacy\.html">Privacy<\/a>\./.test(read(sh))) add("S22", sh, "the candidate email box must end with the privacy one-liner and link");
    const si = path.join(root, "employer-signin.html");
    if (fs.existsSync(si) && !/keep nothing else from this form\. <a href="privacy\.html">Privacy<\/a>\./.test(read(si))) add("S22", si, "the employer email box must carry the privacy one-liner and link");
  }
  // S23: no page promises what is not built (launch readiness): no cross-posting count, no ATS import claim, no company-wide view, no unsourced statistic, no "upgrade to add" for the recruiter name.
  // The ONE place "Upgrade to add" is allowed: the locked destination-links panel on register.html (that editor genuinely exists for the destination links tier), between id="linksLocked" and <!-- /linksLocked -->.
  for (const f of html) {
    let t = read(f);
    if (path.basename(f) === "register.html") t = t.replace(/<div id="linksLocked"[\s\S]*?<!-- \/linksLocked -->/, "");
    for (const [re, why] of [[/places posted|posted in \d+ places|other places it'?s posted/i, "the cross-posting count does not exist"], [/bulk import|from your ATS/i, "there is no import page"], [/company-wide/i, "there is no company-wide view"], [/1 in 5/, "an unsourced statistic"], [/Upgrade to add/i, "the recruiter-name editor does not exist on any tier (only the register page's locked links panel may say it)"]]) if (re.test(t)) add("S23", f, why + ": " + re.source);
  }
  // S25: the AI-disclosure tooltips and the destination-link rows (pass A). Both toggles on register.html AND edit.html carry the designed "i" tooltip, word for word; the stylesheet positions the
  // icon (position:relative, or the tooltip lands off the page) and shows the tooltip on hover, focus AND the tap/click state; the pages with icons wire the click handler; register.html has the
  // links section (locked panel, rows, add button) and register.js saves them through api.setDestinationLinks after the posting is created; both pages use the shared row component.
  {
    const TIP1 = "Resume screening or keyword/ATS-style matching used to prioritize applications before a human reviews them.", TIP2 = "Any AI that interacts with a candidate directly — an AI-conducted interview, a chatbot screening call, or similar.";
    for (const name of ["register.html", "edit.html"]) {
      const p = path.join(root, name); if (!fs.existsSync(p)) { add("S25", p, name + " is missing"); continue; }
      const t = read(p);
      for (const [tip, what] of [[TIP1, "filtering"], [TIP2, "interviewing"]]) if (!t.includes('<span class="info-icon" tabindex="0">i<span class="info-tooltip">' + tip + "</span></span>")) add("S25", p, "the " + what + " toggle must carry the designed tooltip");
      for (const id of ["linkRows", "addLinkBtn", "linksForm", "linksLocked", "linksAlert"]) if (!t.includes('id="' + id + '"')) add("S25", p, name + " is missing #" + id);
    }
    const css = path.join(root, "styles.css"), c = fs.existsSync(css) ? read(css) : "";
    if (!/\.info-icon\{position:relative;/.test(c)) add("S25", css, ".info-icon must be position:relative (the tooltip is positioned against it)");
    if (!/\.info-icon:hover \.info-tooltip,\.info-icon:focus \.info-tooltip,\.info-icon\.open \.info-tooltip\{display:block\}/.test(c)) add("S25", css, "the tooltip must show on hover, focus and the open (tap) state");
    for (const rel of ["js/pages/register.js", "js/pages/edit.js", "js/pages/index.js"]) { const p = path.join(root, rel); if (!fs.existsSync(p) || !read(p).includes("wireInfoIcons()")) add("S25", p, rel + " must call wireInfoIcons()"); }
    for (const rel of ["js/pages/register.js", "js/pages/edit.js"]) { const p = path.join(root, rel); if (!fs.existsSync(p) || !read(p).includes("mountLinkRowsById()")) add("S25", p, rel + " must mount the shared link rows"); }
    const rj = path.join(root, "js", "pages", "register.js"); if (fs.existsSync(rj) && !read(rj).includes("api.setDestinationLinks(")) add("S25", rj, "register.js must save the links through api.setDestinationLinks");
  }
  // S26 (pass B): the candidate's details dialog explains the odd-looking links (one-time, tracked, protected; the name says where a link starts or that it is unverified) and says what to do when one is
  // wrong; search.js shows that note whenever links are listed; the employer pages say the label is theirs only and that shorteners are refused; api.js accepts shown_as and the check result.
  {
    const sh2 = path.join(root, "search.html");
    if (fs.existsSync(sh2)) { const t = read(sh2); if (!t.includes('id="modalLinksNote"')) add("S26", sh2, "search.html is missing #modalLinksNote"); for (const need of ["look unusual on purpose", "one-time link through FightGhostJobs", "protected from scraping", "wherever the employer told us to send you", "we could not verify it", "If a link does not lead to this job", "Report a wrong link"]) if (!t.includes(need)) add("S26", sh2, "the links note must say: " + need); }
    const sj = path.join(root, "js", "pages", "search.js"); if (fs.existsSync(sj) && !read(sj).includes('$("#modalLinksNote").hidden = false')) add("S26", sj, "search.js must show the links note when links are listed");
    for (const name of ["register.html", "edit.html"]) { const p = path.join(root, name); if (fs.existsSync(p)) { const t = read(p); if (!t.includes("The label is a note for you only")) add("S26", p, name + " must say the label is the employer's note only"); if (!t.includes("a link shortener or redirect is not accepted")) add("S26", p, name + " must say shorteners are refused"); } }
    const aj = path.join(root, "js", "api.js"); if (fs.existsSync(aj) && !/linkExtras: \(x\) => \(x\.shown_as === undefined \|\| isNullable\(x\.shown_as, isStr\)\)/.test(read(aj))) add("S26", aj, "api.js must accept shown_as on a stored link");
  }
  // S27 (pass C): the recruiter-firm editor exists on BOTH register.html and edit.html (rows, add button, the locked text), the "coming soon" placeholder is gone, both page scripts mount the
  // shared firm rows and save through api.setRecruiterFirms, and the candidate's search page renders a named firm as "Recruiter firm: …".
  {
    for (const name of ["register.html", "edit.html"]) {
      const p = path.join(root, name); if (!fs.existsSync(p)) continue; const t = read(p);
      for (const id of ["firmRows", "addFirmBtn", "firmsLocked", "firmsForm", "firmsAlert"]) if (!t.includes('id="' + id + '"')) add("S27", p, name + " is missing #" + id);
      if (/coming soon/i.test(t)) add("S27", p, "the recruiter-firm placeholder must be gone (the editor exists)");
      if (!t.includes('Candidates see the name as "Recruiter firm:')) add("S27", p, name + " must say how a firm is shown to candidates");
    }
    for (const rel of ["js/pages/register.js", "js/pages/edit.js"]) { const p = path.join(root, rel); if (!fs.existsSync(p)) continue; const c = read(p); if (!c.includes("mountFirmRowsById()")) add("S27", p, rel + " must mount the shared firm rows"); if (!c.includes("api.setRecruiterFirms(")) add("S27", p, rel + " must save the firms through api.setRecruiterFirms"); }
    const sj = path.join(root, "js", "pages", "search.js"); if (fs.existsSync(sj) && !read(sj).includes('"Recruiter firm: " + link.firm')) add("S27", sj, "search.js must render a named firm as Recruiter firm: <name>");
  }
  // S28 (pass D): the employer's AI notes. Both pages carry a 300-character box under each AI toggle that says it is shown to candidates and refuses web addresses; the pages check the note with the
  // shared rule (js/ai-notes.js) before sending; the search page shows the notes attributed as the employer's words.
  {
    for (const name of ["register.html", "edit.html"]) {
      const p = path.join(root, name); if (!fs.existsSync(p)) continue; const t = read(p);
      for (const id of ["aiFilterNoteRow", "aiFilterNote", "aiInterviewNoteRow", "aiInterviewNote"]) if (!t.includes('id="' + id + '"')) add("S28", p, name + " is missing #" + id);
      if ((t.match(/id="ai(Filter|Interview)Note" type="text" maxlength="300"/g) || []).length !== 2) add("S28", p, name + ": both AI note boxes must be text inputs capped at 300");
      if ((t.match(/In your own words \(optional, shown to candidates\)/g) || []).length !== 2) add("S28", p, name + ": both AI note labels must say the words are shown to candidates");
      if ((t.match(/no web addresses/g) || []).length !== 2) add("S28", p, name + ": both AI note labels must say no web addresses");
    }
    for (const rel of ["js/register-form.js", "js/edit-form.js"]) { const p = path.join(root, rel); if (fs.existsSync(p) && !read(p).includes('import { aiNoteProblem } from "./ai-notes.js";')) add("S28", p, rel + " must check the notes with the shared rule"); }
    const an = path.join(root, "js", "ai-notes.js"); if (!fs.existsSync(an)) add("S28", an, "js/ai-notes.js is missing"); else { const c = read(an); if (!c.includes("MAX_AI_NOTE = 300")) add("S28", an, "the note cap must be 300"); if (!c.includes("www[.]") || !c.includes("://")) add("S28", an, "the rule must refuse web addresses"); }
    const sj = path.join(root, "js", "pages", "search.js"); if (fs.existsSync(sj) && !read(sj).includes("aiNotes(row).map(")) add("S28", sj, "search.js must show the employer's AI notes on the card");
    if (fs.existsSync(an) && !read(an).includes("in the employer's words")) add("S28", an, "the notes must be attributed as the employer's words");
  }
  // S29 (candidate comments): the thread is a page of its own (comments.html: sign-in, thread, compose, the private wrong-link report, and the employer's read-only mode), reached ONLY with a
  // posting's opaque reference or an owner's posting id (every link to it carries ?ref= or ?id=; the site never lists postings), through api.js only; the details dialog points there; the
  // privacy page says what a comment and a report keep; the comments page is anonymous ("Verified candidate") and says comments are public and reportable.
  {
    const ch = path.join(root, "comments.html"), cj = path.join(root, "js", "pages", "comments.js"), cm = path.join(root, "js", "comments-model.js");
    if (!fs.existsSync(ch) || !fs.existsSync(cj) || !fs.existsSync(cm)) add("S29", ch, "comments.html / js/pages/comments.js / js/comments-model.js are missing");
    else {
      const t = read(ch); for (const id of ["signinWrap", "recap", "thread", "loadMore", "composeForm", "commentText", "reportForm", "reportLink", "reportDetail", "employerNote"]) if (!t.includes('id="' + id + '"')) add("S29", ch, "comments.html is missing #" + id);
      if (!t.includes('maxlength="2000"')) add("S29", ch, "the comment box must be capped at 2000"); if (!t.includes("privately")) add("S29", ch, "the wrong-link report must say it is private");
      const c = read(cj); for (const m of ["api.candidateListComments(", "api.candidatePostComment(", "api.candidateReportComment(", "api.candidateReportLink(", "api.employerListComments(", "api.candidateDetail(", "api.getMyPosting("]) if (!c.includes(m)) add("S29", cj, "comments.js must use " + m);
      if (!c.includes('"Verified candidate ' + String.fromCharCode(183) + ' "')) add("S29", cj, "a comment must be attributed as Verified candidate, never by name");
      if (!read(cm).includes("Comments are public and anonymous; anyone can report one.")) add("S29", cm, "the rules text must say comments are public, anonymous and reportable");
    }
    for (const f of files.filter((x) => (x.endsWith(".html") || x.endsWith(".js")) && !x.includes(path.sep + "tests" + path.sep) && !x.includes(path.sep + "vendor" + path.sep))) {
      const t = read(f);
      for (const m of t.matchAll(/comments\.html([^"'`\s)]*)/g)) if (!/^\?(ref|id)=/.test(m[1]) && !(path.basename(f) === "comments.js" && m[1] === "")) add("S29", f, "a link to comments.html must carry ?ref= or ?id= (no listing): " + m[0].slice(0, 60));
    }
    const sj2 = path.join(root, "js", "pages", "search.js"); if (fs.existsSync(sj2)) { const c = read(sj2); if (!c.includes('"comments.html?ref=" + encodeURIComponent(row.posting_ref)')) add("S29", sj2, "the details dialog must link to the posting's comments by its reference"); if (!c.includes("Report a wrong link")) add("S29", sj2, "the details dialog must offer Report a wrong link"); }
    const dj = path.join(root, "js", "pages", "dashboard.js"); if (fs.existsSync(dj) && !read(dj).includes('"comments.html?id=" + encodeURIComponent(p.id)')) add("S29", dj, "the dashboard must link each posting's comments");
    const ph2 = path.join(root, "privacy.html"); if (fs.existsSync(ph2)) { const t = read(ph2); for (const need of ['id="privacyComments"', "never who wrote it", "read only by us"]) if (!t.includes(need)) add("S29", ph2, "privacy.html must say: " + need); }
  }
  // S30 (STAGE ONLY): while js/stage-gate.js exists, it is bound to the stage host by name, says so, and is loaded (once, in the head) by every app page so no page shows data without it.
  // When the site moves stage -> alpha the gate file and every script line go away together, and this rule then has nothing to check.
  {
    const gate = path.join(root, "js", "stage-gate.js");
    if (fs.existsSync(gate)) {
      const g = read(gate);
      if (!g.includes('if (location.hostname !== HOST) return;') || !g.includes('HOST = "stage.fightghostjobs.com"')) add("S30", gate, "the stage gate must do nothing off the stage host");
      if (!g.includes("STAGE ONLY") || !g.includes("MUST NOT SHIP")) add("S30", gate, "the stage gate must be flagged STAGE ONLY / MUST NOT SHIP in its header");
      if (!g.includes('KEY = "fgj_stage_gate"') || !g.includes('localStorage.setItem(KEY, "open")')) add("S30", gate, "the stage gate must remember the answer under fgj_stage_gate");
      for (const f of html) {
        if (path.basename(f) === "404.html") continue;
        const s = read(f), n = (s.match(/<script src="js\/stage-gate\.js"><\/script>/g) || []).length;
        if (n !== 1) add("S30", f, "an app page must load the stage gate exactly once (found " + n + ")");
        else if (s.indexOf('<script src="js/stage-gate.js"></script>') > s.indexOf("<body")) add("S30", f, "the stage gate must be loaded in the head, before the body renders");
      }
    }
  }
  if (fs.existsSync(path.join(root, "index.html")) && !/fictional employer/i.test(read(path.join(root, "index.html")))) add("S23", path.join(root, "index.html"), "the sample card must say it is a fictional employer");
  // S24: the Team page (roster) exists with its controls and talks to the roster functions only through api.js
  {
    const th = path.join(root, "team.html"), tj = path.join(root, "js", "pages", "team.js");
    if (!fs.existsSync(th) || !fs.existsSync(tj)) add("S24", th, "team.html / js/pages/team.js are missing");
    else {
      const t = read(th); for (const id of ["rows", "addForm", "addEmail", "addName", "addAdmin", "notAdmin"]) if (!t.includes('id="' + id + '"')) add("S24", th, "team.html is missing #" + id);
      if (!t.includes("We do not email them")) add("S24", th, "the add form must say that nobody is emailed");
      const c = read(tj); for (const m of ["api.rosterList(", "api.rosterAdd(", "api.rosterRemove(", "api.rosterSetAdmin("]) if (!c.includes(m)) add("S24", tj, "team.js must use " + m);
    }
  }

  // S31: the brand and accessibility structure (WCAG 2.2 AA): every page has a skip link, one header holding the logo (the link back to the start page), one main and one footer;
  // the palette is the darker one (small text passes 4.5:1) and the shared stylesheet carries the accessibility rules
  {
    const OLD_COLORS = /#E8491E|#C23814|#8A837A/i;
    for (const f of html) {
      const s = read(f), name = path.basename(f), body = s.slice(s.indexOf("<body"));
      const count = (sub) => body.split(sub).length - 1;
      if (!body.startsWith('<body>\n<a class="skip-link" href="#main">Skip to content</a>\n')) add("S31", f, "the skip link must be the first thing in the body");
      if (count("<header ") !== 1 || count("</header>") !== 1) add("S31", f, "the page needs exactly one <header>");
      if (count('<main id="main">') !== 1 || count("</main>") !== 1) add("S31", f, "the page needs exactly one <main id=\"main\">");
      if (count("<footer ") !== 1 || count("</footer>") !== 1) add("S31", f, "the page needs exactly one <footer>");
      const logo = body.match(/<header class="nav">\n  <a class="nav-logo" href="(\/?index\.html)" aria-label="FightGhostJobs home">([\s\S]*?)<\/a>/);
      if (!logo) add("S31", f, "the first thing in the header must be the logo, a link back to index.html named FightGhostJobs home");
      else if (!logo[2].includes('<span class="wm-fight">Fight</span><span class="wm-ghost">Ghost</span><span class="wm-jobs">Jobs</span>') || !/<svg class="nav-mark"[^>]*aria-hidden="true"/.test(logo[2])) add("S31", f, "the logo must be the three-word wordmark with no spaces between the words, and its picture hidden from screen readers");
      if (name !== "404.html" && !body.includes('<nav class="nav-links" aria-label="Main">')) add("S31", f, "the header links must be a <nav> labelled Main");
      if (/nav-dot/.test(body)) add("S31", f, "the old square logo (nav-dot) must not come back");
      if (OLD_COLORS.test(s)) add("S31", f, "an old (lower contrast) brand color is still on the page");
    }
    const sp = path.join(root, "app.css"), st = path.join(root, "styles.css");
    if (fs.existsSync(st) && (!/--ember:#C43E19;/.test(read(st)) || !/--ember-dark:#A8320F;/.test(read(st)) || !/--faint:#726C64;/.test(read(st)) || OLD_COLORS.test(read(st)))) add("S31", st, "the palette must be the darker ember (#C43E19), ember-dark (#A8320F) and faint (#726C64)");
    if (fs.existsSync(sp)) {
      const c = read(sp);
      for (const need of [".skip-link:focus", '[aria-current="page"]', "main a:not(.btn):not(td a){text-decoration:underline", "prefers-reduced-motion:reduce", "--font-mono:", ".wm-ghost"]) if (!c.includes(need)) add("S31", sp, "app.css is missing the accessibility rule: " + need);
    }
    const sh = path.join(root, "search.html");
    if (fs.existsSync(sh) && !/<a href="search\.html" class="active" aria-current="page">/.test(read(sh))) add("S31", sh, "the current page in the header must carry aria-current=\"page\"");
    for (const f of css.concat(js)) if (OLD_COLORS.test(read(f))) add("S31", f, "an old (lower contrast) brand color is still in the code");
  }

  // S34: no editable company field (phase 2a, 2026-09-30). A posting's company name is the organization's own name, set by the server. The register form shows it read only and never reads or sends one; the edit page never had one.
  {
    const rg = path.join(root, "register.html"), eg = path.join(root, "edit.html"), rf = path.join(root, "js", "register-form.js"), rj = path.join(root, "js", "pages", "register.js");
    const fields = (t) => [...t.matchAll(/<(input|textarea|select)\b[^>]*>/gi)].map((m) => m[0]).filter((x) => /\b(id|name)\s*=\s*"[^"]*compan/i.test(x));
    for (const f of [rg, eg]) if (fs.existsSync(f) && fields(read(f)).length) add("S34", f, "a form control for the company name exists: the company name is not editable");
    if (fs.existsSync(rg)) {
      const t = read(rg);
      if (!/<div id="companyShown"[^>]*><\/div>/.test(t)) add("S34", rg, "the read-only company display (#companyShown, a plain div) is missing");
      if (/<label\b[^>]*for="company/i.test(t)) add("S34", rg, "a label points at a company control that must not exist");
    }
    if (fs.existsSync(rf)) { const t = stripJsComments(read(rf)); if (/company_name|\bv\.company\b|["']company["']/.test(t)) add("S34", rf, "the form code must not read, validate or send a company name"); }
    if (fs.existsSync(rj)) {
      const t = stripJsComments(read(rj));
      if (/#company["'`]|val\(\s*["']#company/.test(t) || /\bcompany\s*:/.test(t)) add("S34", rj, "the page must not read a company value from the form");
      if (!/\$\(\s*"#companyShown"\s*\)\.textContent\s*=\s*ctx\.info\.organization\.name/.test(t)) add("S34", rj, "the page must show the organization's name in #companyShown");
    }
  }

  // S33: links (2026-09-30 link audit). A mailto is allowed only where the visible text clearly says it opens an email (the address itself, or "Email us") and only to an address on the approved list below. Every other link must go to a real page.
  {
    const APPROVED_MAILTO = ["sales@fightghostjobs.com", "privacy@fightghostjobs.com"];   // changing this list needs John's approval
    const APPROVED_EXTERNAL = ["https://www.fightghostjobs.com/"];
    const PLANS_URL = "https://www.fightghostjobs.com/plans.html";
    const aText = (h) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    const linksIn = (t) => [...t.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((m) => { const g = (n) => { const r = m[1].match(new RegExp("\\b" + n + "\\s*=\\s*\"([^\"]*)\"", "i")); return r ? r[1] : null; }; return { href: g("href"), text: aText(m[2]), target: g("target"), rel: g("rel") }; });
    const idsIn = (t) => new Set([...t.matchAll(/\bid\s*=\s*"([^"]*)"/g)].map((m) => m[1]));
    const mailAddr = (h) => decodeURIComponent(h.replace(/^mailto:/i, "").split("?")[0]).toLowerCase();
    const internal = (h) => h.trim() !== "" && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(h.trim());
    const target = (from, h) => { const p = h.split("#")[0].split("?")[0]; return p === "" ? from : path.join(root, p.replace(/^\//, "")); };
    for (const f of html) {
      const t = read(f).replace(/<!--[\s\S]*?-->/g, ""), me = path.basename(f);
      for (const l of linksIn(t)) {
        const h = l.href, why = (m) => add("S33", f, m + ': "' + l.text.slice(0, 50) + '" -> ' + String(h).slice(0, 80));
        if (h === null || h.trim() === "" || h.trim() === "#" || /^javascript:/i.test(h.trim())) { why("a link with a missing, empty, # or javascript: target"); continue; }
        if (/^tel:/i.test(h.trim())) { why("a tel link"); continue; }
        if (/^mailto:/i.test(h.trim())) {
          const a = mailAddr(h);
          if (!APPROVED_MAILTO.includes(a)) why("a mailto to an address that is not approved");
          else if (!(l.text.toLowerCase().includes(a) || /\bemail us\b/i.test(l.text))) why("a mailto whose visible text does not say it opens an email (show the address, or say Email us)");
          continue;
        }
        if (/^#./.test(h.trim())) { if (!idsIn(t).has(h.trim().slice(1))) why("an anchor to an id that is not on the page"); continue; }
        if (/^(https?:)?\/\//i.test(h.trim())) { if (!APPROVED_EXTERNAL.some((p) => h.trim().startsWith(p))) why("an external link to a host that is not approved"); if (l.target === "_blank" && !/noopener/.test(l.rel || "")) why("a new-tab link without rel=noopener"); continue; }
        if (internal(h)) {
          const tp = target(f, h);
          if (!fs.existsSync(tp) || !fs.statSync(tp).isFile()) { why("an internal link to a file that does not exist"); continue; }
          const frag = h.split("#")[1];
          if (frag && tp.endsWith(".html") && !idsIn(read(tp)).has(frag)) why("an anchor to an id that is not on the page it names");
        }
        if (l.target === "_blank" && !/noopener/.test(l.rel || "")) why("a new-tab link without rel=noopener");
      }
      if (linksIn(t).some((l) => /included|each tier|plans?\b/i.test(l.text) && /^mailto:/i.test(l.href || ""))) add("S33", f, "a link about what is included or the tiers must not be a mailto");
    }
    // links built by the scripts
    for (const f of js) {
      const t = stripJsComments(read(f));
      if (/href["']?\s*[:=]\s*["'`]#["'`]/.test(t)) add("S33", f, "a script builds a link with # as its target");
      for (const m of t.matchAll(/["'`]mailto:([^"'`?]*)/g)) if (!APPROVED_MAILTO.includes(decodeURIComponent(m[1]).toLowerCase())) add("S33", f, "a script builds a mailto to an address that is not approved: " + m[1]);
      for (const m of t.matchAll(/["'`]([A-Za-z0-9_\-\/]+\.html)(?:[?#][^"'`]*)?["'`]/g)) { const p = path.join(root, m[1].replace(/^\//, "")); if (!fs.existsSync(p)) add("S33", f, "a script points at a page that does not exist: " + m[1]); }
    }
    // the pricing card
    const rg = path.join(root, "register.html");
    if (fs.existsSync(rg)) {
      const rl = linksIn(read(rg).replace(/<!--[\s\S]*?-->/g, "")).filter((l) => l.text === "See what's included \u2192");
      if (rl.length !== 1 || rl[0].href !== PLANS_URL) add("S33", rg, "the pricing card must have exactly one \"See what's included\" link and it must go to " + PLANS_URL);
    }
  }

  // S32: public wording (decided 2026-09-30). FightGhostJobs is a registry of job postings disclosed by employers: it never says or implies that it confirms a posting is real, and it makes no price or permanence promise beyond what is decided.
  // The old claims are caught wherever they come back (page text, attributes, script strings), and the approved replacements must be where they belong. Candidate email verification ("Verified candidate", "keeps you verified for 90 days", rule S29) is NOT in this rule.
  {
    const RETIRED = [
      [/\u2713 Verified/, "the posting badge must say Registered, not Verified"],
      [/This listing is verified/i, "the details dialog must not say the listing is verified"],
      [/a real employer|real employer/i, "no text may say a real employer registered or disclosed a posting"],
      [/(has|have) confirmed (it|the posting)/i, "no text may say an employer confirmed a posting"],
      [/any less real/i, "no text may talk about a posting being real or less real"],
      [/Prove your listing/i, "no text may promise to prove a listing is real"],
      [/free public registry/i, "the registry is described as a registry of job postings disclosed by employers, not a free public registry"],
      [/Free, always|register and disclose, always|always free/i, "no always-free promise"],
      [/tier, permanently|free, forever|free forever|never pay for anything|ever paywalled/i, "no forever or permanent price promise"],
      [/costs? nothing|no cost/i, "no cost promise (say Free for job seekers where it is decided)"],
      [/Company and title always works/i, "no always promise about search"],
      [/specific verified posting/i, "a Post ID belongs to a specific posting, not a verified one"],
      [/\bpaid\b/i, "the paid tier's user-facing name is Destination links tier: no page, script text or attribute says paid (pass 5)"],
      [/verified[- ](plan|tier)/i, "the paid tier's user-facing name is Destination links tier (the database value and function names keep their names, but no page, script text or attribute says verified plan or verified tier)"],
      [/itself worth knowing/i, "a missing posting must not be presented as meaningful about the job"],
    ];
    for (const f of html.concat(js)) {
      const t = f.endsWith(".html") ? read(f).replace(/<!--[\s\S]*?-->/g, "") : stripJsComments(read(f));
      for (const [re, why] of RETIRED) if (re.test(t)) add("S32", f, why);
    }
    const need = (rel, str, why) => { const p = path.join(root, rel); if (!fs.existsSync(p) || !read(p).includes(str)) add("S32", p, why); };
    need("js/pages/search.js", '"\u2713 Registered"', "the badge on every search result must say Registered");
    need("js/pages/search.js", "This posting was registered through FightGhostJobs by a registered poster. The dates and disclosures are the poster's own. FightGhostJobs has not confirmed that the job exists, that the poster works for the company named, or that the employer will respond.", "the details dialog must carry the approved sentence, including what FightGhostJobs has not confirmed");
    need("index.html", '<div class="pill badge-verified">\u2713 Registered</div>', "the sample card badge must say Registered");
    need("index.html", ">A registry of job postings disclosed by employers</div>", "the home pill must describe the registry as job postings disclosed by employers");
    need("index.html", "The facts candidates see are free for employers to publish on every tier, and free for job seekers to search. The destination links tier adds destination links.", "the home page tier sentence must be the approved one (it matches the marketing site: the destination links tier adds the destination links)");
    need("register.html", ">Free on every tier</div>", "the register page price label must be Free on every tier");
    need("js/chips.js", "The employer has paused it, so it is not accepting applicants right now.", "the paused message must say the employer paused it");
    need("js/search-input.js", "A missing posting may simply not be registered; it says nothing about whether the job exists.", "the empty-search note must say a missing posting says nothing about whether the job exists");
  }

  // S35 (TEMPORARY, John 2026-09-30): employer analytics and reporting are a destination links tier feature that the code does not gate yet, so no user-facing text may say they are free, paid, included, or part of a tier or plan.
  // The Analytics button, page and behavior stay. John will add the tier wording back and remove this rule when the tier gate is built.
  {
    const TOPIC = /analytic|\breporting\b|\binsights?\b|\bmetrics?\b|impressions?\b|click[- ]through|link clicks/i, TIER = /\b(free|paid|tier|tiers|plans?|included|includes|upgrade|premium|unlock|unlocks)\b/i;
    for (const f of html.concat(js).filter((x) => path.basename(x) !== "api.js")) {   // js/api.js is only call wrappers and shape validators (field names such as analyticsByPosting), it holds no user-facing text
      const t = f.endsWith(".html") ? read(f).replace(/<!--[\s\S]*?-->/g, "") : stripJsComments(read(f));
      for (const line of t.split("\n")) { const text = line.replace(/<[^>]+>/g, " "); if (TOPIC.test(text) && TIER.test(text) && !/^\s*(import|export)\b/.test(line)) add("S35", f, "text must not say analytics or reporting is free, paid or in a tier (temporary rule, until the gate is built): " + text.trim().slice(0, 80)); }
    }
  }

  // S36: comments (2026-09-30). Comments are free on every tier. An employer can read the comments on their own postings (My postings links each posting's comments); nothing lets an employer contest, dispute or answer a comment, and there is no view across postings. No text may claim either.
  {
    const CLAIMS = [
      [/\b(contest|dispute|challenge|rebut|appeal)\w*\b[^.\n<]{0,50}\bcomments?\b|\bcomments?\b[^.\n<]{0,60}\b(contest|dispute|challenge|rebut|appeal)\w*\b/i, "no text may say an employer can contest, dispute or challenge a comment"],
      [/(have|get) (a|one|the|that) (comment )?looked at|ask us to (remove|review|look at) (a|the) comment/i, "no text may point an employer to a way of having a comment looked at (not built)"],
      [/\b(respond|reply|answer) to (a|the|any) comments?\b/i, "no text may say an employer can reply to a comment"],
      [/\bcomments?\b[^.\n<]{0,60}\b(across|all|every one of|each of) (of )?(your|their|the) postings\b|\b(roll-?up|company-wide)\b[^.\n<]{0,40}\bcomments?\b/i, "no text may say an employer sees comments across all their postings (there is no such view)"],
    ];
    for (const f of html.concat(js)) {
      const t = f.endsWith(".html") ? read(f).replace(/<!--[\s\S]*?-->/g, "") : stripJsComments(read(f));
      for (const [re, why] of CLAIMS) if (re.test(t)) add("S36", f, why);
    }
    const chtml = path.join(root, "comments.html");
    if (fs.existsSync(chtml) && !read(chtml).includes("This page shows the comments on this one posting.")) add("S36", chtml, "the employer's note must say the page shows the comments on this one posting (and nothing about contesting or looking at one)");
  }

  const vendor = path.join(root, "vendor", "auth-js.min.mjs"), rec =path.join(root, "tests", "vendor-hash.txt");
  if (!fs.existsSync(vendor) || !fs.existsSync(rec)) add("S10", vendor, "vendored Auth client or its recorded hash is missing");
  else if (crypto.createHash("sha256").update(fs.readFileSync(vendor)).digest("hex") !== fs.readFileSync(rec, "utf8").trim()) add("S10", vendor, "the vendored Auth client does not match tests/vendor-hash.txt");
  return findings;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
  const f = checkSite(root);
  const pages = walk(root).filter((x) => x.endsWith(".html")).length;
  for (const x of f) console.log("FINDING " + x.rule + " " + x.file + ": " + x.msg);
  console.log("site-check: " + pages + " pages, " + f.length + " findings");
  process.exit(f.length ? 1 : 0);
}
