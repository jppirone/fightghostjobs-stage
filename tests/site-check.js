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
//   S36 comments and contests: the exact contest notice (defined once, shown to candidates and the owner while a contest is open), the six reasons, a contest control only in the owner view and only when no contest exists, the plain already-contested sentence for the owner after a decision, no editing, hide or delete wording or control, no promised response time, no view across postings, the privacy sentence
//   S37 the comments page for a posting that is not open: paused has its own heading and short sentence (once each), closed and expired keep the long wording (once), the unapproved "links not listed" sentence is nowhere, the Which link? picker hides when there are no links, the comment button does not tick
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
//   S38 the destination links rows panel (item 4): the panel and its two approved sentences are on edit.html once each; an address is never on the page (the edit form's address box is created empty, never given a value, autocomplete off; no row reads an address field; the ticket link is only ever a navigation target); the blank tab is opened before the request and its opener cut; no new network host, no storage, no logging; the plan's words exist once; no em dash in the new text
//   S40 the candidate search screen: one specific job, company AND one lookup value; req number first, then postID / title (title is the labelled fallback); the guidance sentences are on the page and referenced by aria-describedby; no browse input; a short title is not refused locally; the too-short answer and the empty-result note use the approved wording
//   S45 the edit page keeps unsaved work safe: the bar (sticky, last in main, a polite status region, Save changes and Discard), the leave dialog (alertdialog, Save and leave / Discard and leave / Stay on this page), the guard code (beforeunload, Escape is Stay, focus into the dialog and back), the exact words, no em dash in them; the recruiter toggle is free, above Save changes, with its approved sentence, and the recruiter firms panel sits in the Destination links card below Save changes
//   S46 the signed-in header: the initials circle is the control (a real button, the full "Signed in as <name>, <organization>" as its accessible name, a label on mouse-over for real pointers, on keyboard focus and on tap / Enter / Space, closed by Escape with focus returned, or a click elsewhere); app.js no longer prints the text beside it; the area wraps and the bar stacks at narrow widths
//   S47 the top bar at phone widths: the viewport meta on every page, text-size-adjust 100%, the phone layout block (three short rows, 44 pixel targets, small logo, label anchored inside the window), no fixed widths in the bar, and the browser test tests/header-layout.test.js
//   S48 the pages at phone widths: the phone block in app.css (all of it inside the 640 and 360 pixel media blocks), the classes, the table roles and data-labels, the labelled scroll areas, and the browser test tests/phone-layout.test.js
//   S49 the sign-in link opens in a new tab: pending search and landing page in localStorage (one hour, removed when used, never sent), a watch for a sign-in in another tab, the two notices pinned until John approves new wording, and tests/signin-tabs.test.js
//   S50 the stage recheck round: landing wording by page, the home page wording (Look up a posting), Report a wrong link only for a posting with links, the search fields' visible line, the details window's scroll lock, and the tests that prove them
//   S54 the edit page's skip link to the unsaved bar
//   S55 the landing note clears on the person's first real action (Part E3), with no close button, no timer and no announcement
//   S56 after a successful search the recap scrolls to the top of the window (Part E4): smooth, no focus move, not with reduced motion, not for a replayed search
//   S57 candidate sign-in wording, the confirm family (Part E5): search card heading, paragraph, button, the flash after the link and the top bar word; employer side stays sign-in link
//   S58 the one comments switch, js/config.js COMMENTS_VISIBLE, shipped true, read by every comment surface (Part E6)
//   S59 no verify, verified or verification in candidate-facing text (Part E7): the word is confirm; exceptions are the destination link wording, data and class names, and privacy.html
//   S64 no database script in the repository: no .sql file anywhere and no top-level db folder (the whole repository is served by Pages)
//   S65 the staff-only search scope (scope=all): the database decides who is staff, the page starts staff mode only on a clear true, the staff branch calls no candidate function and stores nothing, noindex, never cached, nothing in search.html, only the search page uses the staff functions
//   S63 back from Comments or Report a wrong link: the Auth client is created WITHOUT its cross-tab channel (the channel evicts the search page from the browser's back/forward cache), no other script opens one, no unload handler, and the search page has the pageshow guard
//   S62 the search page opened with the company and one other value in the URL fragment (extension hand-off): only c, p, r, t, the site's limits, plain text, refuse on doubt, fragment removed at once, never an automatic search
//   S61 the emailed one-time code typed in the same tab (Phase 4): EMAIL_CODE_ENTRY, the Auth call as type email, the field on the search page and the employer sign-in page, no landing note after a typed code, the test runs
//   S60 search engines (Phase 3): the flag ALLOW_INDEXING in js/config.js (false on stage) agrees with every page's robots tag and with robots.txt; sign-in pages are noindex in every environment; the tool and the test exist and run
//   S53 the search recap (Part C): sentence, never the req number or postID, Edit this search, memory only, one spoken message
//   S52 the accessibility round: header Tab order, one polite search status, the details window's focus handling, the unsaved bar's closing message, 24 pixel hit areas, and the four tests that prove them
//   S51 the home page's step 3 (Candidates look up), the search form's three boxes (Company required, Then one of these, a visible or, the approved sentence) and the callback without the flash on employer pages
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
  const idxCfg = path.join(root, "js", "config.js"), idxOn = fs.existsSync(idxCfg) && /^export const ALLOW_INDEXING = true;/m.test(stripJsComments(read(idxCfg)));   // ALLOW_INDEXING (2026-10-06, S60): false on stage

  for (const f of html) {
    const s = read(f); const name = path.basename(f);
    const csps = [...s.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/g)].map((m) => m[1]);
    if (csps.length !== 1) add("S1", f, "expected exactly one Content-Security-Policy meta, found " + csps.length);
    else if (csps[0] !== (name === "404.html" ? EXPECTED_CSP_404 : EXPECTED_CSP)) add("S1", f, "the Content-Security-Policy is not the expected one");
    if (!/<meta name="robots" content="noindex, nofollow">/.test(s) && !(idxOn && ["index.html", "privacy.html"].includes(name) && s.includes('<meta name="robots" content="index, follow">'))) add("S2", f, "missing noindex, nofollow");   // only a PUBLIC page may say index, follow, and only while ALLOW_INDEXING is true (S60 checks the rest)
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
    if (!note.endsWith("A title search finds only openings that are live: closed or expired openings are found only by Opening ID or req number.")) add("S14", si, "NO_MATCH_NOTE must end with the closed-or-expired-by-postID-or-req sentence");
    if (!note.includes("Check the company name, and check the ID exactly as it is printed in the job ad. If you searched by title, try a different part of the title.")) add("S14", si, "NO_MATCH_NOTE must tell the person to check the ID and to try a different part of the title");
    const src = read(si);
    const fn = (src.match(/export function noMatchMessage\([^)]*\)\s*\{([\s\S]*?)\n\}/) || [])[1] || "";
    if (!/\+\s*NO_MATCH_NOTE;\s*$/.test(fn.trim())) add("S14", si, "noMatchMessage must end with NO_MATCH_NOTE");
    if (!/No openings found for/.test(fn)) add("S14", si, "noMatchMessage must echo what was searched (\"No openings found for ...\")");
    const page = read(sp);
    if (!/import\s*\{[^}]*\bnoMatchMessage\b[^}]*\}\s*from\s*"\.\.\/search-input\.js"/.test(page) || !/empty-note[^\n]*noMatchMessage\(searched\.company, searched\.query, searched\.kind\)\)/.test(page)) add("S14", sp, "the empty-result message must be noMatchMessage(company, query, kind)");
    if (/No openings? (found|matched)/.test(page)) add("S14", sp, "a second, hand-written empty-result message");
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
    if (!/<input id="reqq" (class="srch-input" )?type="password"/.test(shtml)) add("S18", sh, "the candidate's req number box (id=reqq) must be a masked input (type=password)");
    if (!/<button type="button" id="reqToggle"/.test(shtml)) add("S18", sh, "the req box needs its show/hide toggle (id=reqToggle)");
    const hint = "Required. Your own reference, such as your ATS number. Once the opening is live, candidates can find it by company name plus this number. They see it masked (for example FGJ****45), and these lookups are rate-limited. You always see the full number in My openings.";
    if (!rhtml2.includes(hint)) add("S18", rh, "the register form's req number hint must carry the approved wording, word for word");
    if (/Req number (optional)/.test(rhtml2)) add("S18", rh, "the req number is required: its label must not say optional");
  }

  // S19: the approved requirements-text hint and the change-note label (slice C)
  const eh = path.join(root, "edit.html");
  if (fs.existsSync(rh) && fs.existsSync(eh)) {
    const REQ_TEXT_HINT = "This text is compared with any later changes to it. Small corrections (a typo, a tightened sentence, a dropped line) save straight away and are never flagged or held up. If a change would rewrite most of it, we'll ask you to add it as a new opening with its own req number, so candidates can tell which role they're looking at. Each change is saved with a short note.";
    for (const f of [rh, eh]) if (!read(f).includes('<div id="reqTextHint" class="field-hint">' + REQ_TEXT_HINT + "</div>")) add("S19", f, "the requirements-text hint (#reqTextHint) must carry the approved wording, word for word");
    if (!read(eh).includes("What changed, and why? (required; kept with the opening).")) add("S19", eh, "the change-note label must be the approved wording");
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
    const HINT = "Choose a time between 1 hour and 90 days from now. Your opening goes live within 15 minutes after that time, and its closing date is counted from the moment it actually goes live, not from now. Until then it is a scheduled draft that candidates cannot see; you can change the time, remove it or publish it now from My openings.";
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
      for (const need of ["If you look up openings", "If you add openings", "Cookies", "Who processes the data", "How long", "<code>__cf_bm</code>", "We set no cookies of our own", "privacy@fightghostjobs.com", "for as long as FightGhostJobs exists", "FightGhostJobs is a place to check job openings that employers disclose", "FightGhostJobs runs on Supabase", 'id="privacyEmails"', "five days and one day from closing", "at most one email in each six-hour period", "you confirm an email address", "the email-confirmed identity that asked", "until you sign out or your email confirmation expires", "Rate-limit counters are deleted within a day; the daily tally of refused requests is kept 30 days", "never its description, a comment's text or an apply link", "no unsubscribe for these operational messages yet"]) if (!t.includes(need)) add("S22", ph, "privacy.html must say: " + need);
      // the contest email sentences (owner approved text) must sit INSIDE the emails paragraph, not elsewhere on the page
      const em = /<p class="privacy-p" id="privacyEmails">([\s\S]*?)<\/p>/.exec(t);
      for (const need of ["and when a comment you contested is decided (we email the outcome to the account that filed the contest).", "When a contest is filed, we may email our own staff the organization, opening and reason category.", "That email does not include the comment or your explanation."]) if (!em || !em[1].includes(need)) add("S22", ph, "the privacyEmails paragraph must say: " + need);
    }
    // the contest-decided email is named ONCE on the page (October 9, 2026: it was said twice in the emails paragraph)
    if (fs.existsSync(ph) && (read(ph).split("contested is decided").length - 1 !== 1 || read(ph).split("we email the outcome").length - 1 !== 1)) add("S22", ph, "the contest-decided email must be named exactly once on the privacy page");
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
  // links section (locked panel, rows, add button) and register.js saves them through api.setDestinationLinks after the opening is created; both pages use the shared row component.
  {
    const TIP1 = "Resume screening or keyword/ATS-style matching used to prioritize applications before a human reviews them.", TIP2 = "Any AI that interacts with a candidate directly, such as an AI-conducted interview or a chatbot screening call.";
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
    if (fs.existsSync(sh2)) { const t = read(sh2); if (!t.includes('id="modalLinksNote"')) add("S26", sh2, "search.html is missing #modalLinksNote"); for (const need of ["look unusual on purpose", "one-time link through FightGhostJobs", "protected from scraping", "wherever the employer told us to send you", "we could not check it", "If a link does not lead to this job", "Report a wrong link"]) if (!t.includes(need)) add("S26", sh2, "the links note must say: " + need); }
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
      if (!c.includes('"Candidate ' + String.fromCharCode(183) + ' "')) add("S29", cj, "a comment must be attributed as Candidate, never by name");
      if (!read(cm).includes("Comments are public and anonymous; anyone can report one.")) add("S29", cm, "the rules text must say comments are public, anonymous and reportable");
    }
    for (const f of files.filter((x) => (x.endsWith(".html") || x.endsWith(".js")) && !x.includes(path.sep + "tests" + path.sep) && !x.includes(path.sep + "vendor" + path.sep))) {
      const t = read(f);
      for (const m of t.matchAll(/comments\.html([^"'`\s)]*)/g)) if (!/^\?(ref|id)=/.test(m[1]) && !(path.basename(f) === "comments.js" && m[1] === "")) add("S29", f, "a link to comments.html must carry ?ref= or ?id= (no listing): " + m[0].slice(0, 60));
    }
    const sj2 = path.join(root, "js", "pages", "search.js"); if (fs.existsSync(sj2)) { const c = read(sj2); if (!c.includes('"comments.html?ref=" + encodeURIComponent(row.posting_ref)')) add("S29", sj2, "the details dialog must link to the opening's comments by its reference"); if (!c.includes("Report a wrong link")) add("S29", sj2, "the details dialog must offer Report a wrong link"); }
    const dj = path.join(root, "js", "pages", "dashboard.js"); if (fs.existsSync(dj) && !read(dj).includes('"comments.html?id=" + encodeURIComponent(p.id)')) add("S29", dj, "the dashboard must link each opening's comments");
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
      if (!body.startsWith('<body>\n' + (name === "edit.html" ? '<a id="skipToUnsaved" class="skip-link" href="#unsavedSave" hidden>Skip to unsaved changes</a>\n' : '') + '<a class="skip-link" href="#main">Skip to content</a>\n')) add("S31", f, "the skip link must be the first thing in the body");
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
      [/\u2713 Verified/, "the opening badge must say Registered, not Verified"],
      [/This listing is verified/i, "the details dialog must not say the listing is verified"],
      [/a real employer|real employer/i, "no text may say a real employer registered or disclosed an opening"],
      [/(has|have) confirmed (it|the (posting|opening))/i, "no text may say an employer confirmed an opening"],
      [/any less real/i, "no text may talk about an opening being real or less real"],
      [/Prove your listing/i, "no text may promise to prove a listing is real"],
      [/free public registry/i, "the registry is described as a registry of job openings disclosed by employers, not a free public registry"],
      [/Free, always|(register|add) and disclose, always|always free/i, "no always-free promise"],
      [/tier, permanently|free, forever|free forever|never pay for anything|ever paywalled/i, "no forever or permanent price promise"],
      [/costs? nothing|no cost/i, "no cost promise (say Free for job seekers where it is decided)"],
      [/Company and title always works/i, "no always promise about search"],
      [/specific verified (posting|opening)/i, "an Opening ID belongs to a specific opening, not a verified one"],
      [/\bpaid\b/i, "the paid tier's user-facing name is Destination links tier: no page, script text or attribute says paid (pass 5)"],
      [/verified[- ](plan|tier)/i, "the paid tier's user-facing name is Destination links tier (the database value and function names keep their names, but no page, script text or attribute says verified plan or verified tier)"],
      [/itself worth knowing/i, "a missing opening must not be presented as meaningful about the job"],
    ];
    for (const f of html.concat(js)) {
      const t = f.endsWith(".html") ? read(f).replace(/<!--[\s\S]*?-->/g, "") : stripJsComments(read(f));
      for (const [re, why] of RETIRED) if (re.test(t)) add("S32", f, why);
    }
    const need = (rel, str, why) => { const p = path.join(root, rel); if (!fs.existsSync(p) || !read(p).includes(str)) add("S32", p, why); };
    need("js/pages/search.js", '"\u2713 Registered"', "the badge on every search result must say Registered");
    need("js/pages/search.js", "This opening was added through FightGhostJobs by the employer. The dates and disclosures are the employer's own. FightGhostJobs has not confirmed that the job exists, that the employer representative works for the company named, or that the employer will respond.", "the details dialog must carry the approved sentence, including what FightGhostJobs has not confirmed");
    need("index.html", '<div class="pill badge-verified">\u2713 Registered</div>', "the sample card badge must say Registered");
    need("index.html", ">A place to check job openings that employers disclose</div>", "the home pill must describe the site as a place to check job openings that employers disclose (never a registry)");
    need("index.html", "The facts candidates see are free for employers to publish on every tier, and free for job seekers to search. The destination links tier adds destination links.", "the home page tier sentence must be the approved one (it matches the marketing site: the destination links tier adds the destination links)");
    need("register.html", ">Free on every tier</div>", "the register page price label must be Free on every tier");
    need("js/chips.js", "The employer has paused it, so it is not accepting applicants right now.", "the paused message must say the employer paused it");
    need("js/search-input.js", "A missing opening may simply not be added; it says nothing about whether the job exists.", "the empty-search note must say a missing opening says nothing about whether the job exists");
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

  // S38 (item 4, 2026-10-03): the "Destination links" rows panel on the edit page (Check link, Edit, Remove on one stored link). The WRITE-ONLY rule holds on the page: no address is ever received, shown or stored here.
  //   * edit.html carries #linksPanel, #linksPanelHint, #linksList, #linksCheckNote, each once; the plan's panel sentence and the address-bar note exist exactly once in the site; the old "not shown back to you" sentence is gone;
  //   * js/link-panel.js: the address box is made by one h("input", ...) call with no value and autocomplete off, and only ever assigned the empty string; the ticket link (go_url) is used only as a tab's location and a link's href, never as text;
  //     the blank tab is opened BEFORE the request and its opener is cut BEFORE it is pointed anywhere; window.open takes about:blank only; no storage, no logging, no network address, no "Add" control (a new link is added through the whole-set form);
  //   * a labelled row is titled "Link N: LABEL" (an unlabelled one "Link N"), the same form in the row title and in the edit and remove dialog texts (pinned in the model and in the panel's calls);
//   * js/link-panel-model.js: a row is built from position, label, shown_as and the check result only (no field that could hold an address is read); recruiter firms are not rows; the plan's wording is defined once each;
  //   * js/api.js: the check answer is exactly two keys; the edit and remove answers accept only the link fields; the three calls go to the right functions; js/pages/edit.js mounts the panel.
  {
    const P = (...a) => path.join(root, ...a);
    const htmlF = P("edit.html"), panelF = P("js", "link-panel.js"), modelF = P("js", "link-panel-model.js"), apiF = P("js", "api.js"), editF = P("js", "pages", "edit.js"), cssF = P("app.css");
    const appFiles = html.concat(js);
    const count38 = (str) => appFiles.reduce((n, f) => n + read(f).split(str).length - 1, 0);
    const once38 = (str, why, where) => { const k = count38(str); if (k !== 1) add("S38", where, why + " (found " + k + " times, expected once): " + str.slice(0, 70)); };
    const EMDASH = "\u2014";
    const HINT = "These addresses are not shown on this page. Use Check link to open one in a new tab, Edit to replace one address, or Remove to take one out. The other links are not touched.";
    const NOTE = "The page you are taken to may show its address in the new tab. That is normal.";
    if (fs.existsSync(htmlF)) {
      const t = read(htmlF);
      for (const id of ["linksPanel", "linksPanelHint", "linksList", "linksCheckNote"]) if (t.split('id="' + id + '"').length !== 2) add("S38", htmlF, "edit.html must carry #" + id + " exactly once");
      if (!t.includes('<div id="linksPanelHint" class="field-hint" style="margin-top:0;" hidden>' + HINT + "</div>")) add("S38", htmlF, "#linksPanelHint must carry the approved panel sentence, word for word");
      if (!t.includes('<div id="linksCheckNote" class="field-hint" style="margin-top:0;" hidden>' + NOTE + "</div>")) add("S38", htmlF, "#linksCheckNote must carry the address-bar note, word for word");
      if (/id="linksStored"/.test(t) || /not shown back to you/.test(t)) add("S38", htmlF, "the old stored-links sentence block and the sentence 'not shown back to you' are replaced by the panel");
      const panelHtml = (t.match(/<div id="linksPanel"[\s\S]*?<form id="linksForm"/) || [""])[0];
      if (panelHtml.includes(EMDASH)) add("S38", htmlF, "no em dash in the panel's text");
    }
    once38(HINT, "the panel sentence must exist exactly once in the site", htmlF); once38(NOTE, "the address-bar note must exist exactly once in the site", htmlF);
    if (fs.existsSync(modelF)) {
      const m = stripJsComments(read(modelF));
      for (const need of ['CHECK: "Check link", EDIT: "Edit", REMOVE: "Remove",', 'checkAria = (n) => "Check Link " + n, editAria = (n) => "Edit Link " + n, removeAria = (n) => "Remove Link " + n;', "applyLinks("]) if (!m.includes(need)) add("S38", modelF, "the model must keep: " + need);
      // one title form (owner decision October 3, 2026 for the number; the form itself is for review): "Link N: LABEL" for a labelled row, "Link N" for an unlabelled one, used by the row title and the edit and remove dialog texts
      for (const need of ['export const linkTitle = (position, label) => linkName(position) + (typeof label === "string" && label.trim() !== "" ? ": " + label.trim() : "");', "title: linkTitle(x.position, label),",
        'removeConfirm: (n, label) => "Remove " + linkTitle(n, label) + "? Candidates', 'confirmReplace: (n, alsoLabel, label) => "Replace the address for " + linkTitle(n, label) + "? Candidates', 'confirmLabel: (n, label) => "Change the label for " + linkTitle(n, label) + "? The']) if (!m.includes(need)) add("S38", modelF, "a labelled row keeps its number: the title form must stay: " + need.slice(0, 80));
      for (const str of ['OPENED: "Opened in a new tab. This one-time check link is used up; press Check link again to open it again."', 'BLOCKED: "Your browser blocked the new tab. Open the link here (it works for one minute): "', 'EXPIRED: "That check expired before it opened. Press Check link again."',
        '"You are checking links too fast. Try again in "', 'editTitle: (n, label) => "Replace the address for " + linkTitle(n, label),', 'EDIT_HELP: "The current address is not shown. Enter the full new address, or leave the box empty to keep it. You can change the label too."',
        '"? Candidates will no longer see it. Your other links are not changed."', '" was replaced."', '" was removed."', 'SAME_ADDRESS: "That is the address already stored, so nothing was changed."']) once38(str, "the plan's wording must be defined exactly once", modelF);
      if (/\bx\.(url|href|host|address|link|url_enc|link_id|id)\b/.test(m) || /\burl_enc\b|\blink_id\b/.test(m)) add("S38", modelF, "a row must be built from position, label, shown_as and the check result only: no field that could hold an address is read");
      if (!/for \(const x of applyLinks\(/.test(m)) add("S38", modelF, "rows come from the application links only (recruiter firms are not rows)");
      if (/https?:\/\/[^\s"'`)<>]+/.test(m)) add("S38", modelF, "no web address in the panel model");
      if (/["'][^"']*\b(Add a|Add another|Add link|Add new)\b/.test(m)) add("S38", modelF, "the panel has no Add control (a new link goes through the whole-set form)");
      if (read(modelF).includes(EMDASH)) add("S38", modelF, "no em dash in the panel's text");
    }
    if (fs.existsSync(panelF)) {
      const raw = read(panelF), c = stripJsComments(raw);
      const addrCall = (c.match(/const addr = h\("input", \{[^\n]*\}\);/) || [""])[0];
      if (!addrCall) add("S38", panelF, "the address box must be made by one h(\"input\", ...) call named addr");
      else {
        if (/\bvalue\s*:/.test(addrCall)) add("S38", panelF, "the address box must never be given a value");
        if (!/autocomplete: "off"/.test(addrCall)) add("S38", panelF, "the address box must have autocomplete off");
      }
      for (const m of c.matchAll(/\baddr\.value\s*=(?!=)\s*([^;]*);/g)) if (m[1].trim() !== '""') add("S38", panelF, "the address box may only be assigned the empty string, found: addr.value = " + m[1].trim().slice(0, 40));
      if (/\baddr\.defaultValue/.test(c) || /\baddr\.setAttribute\(\s*["']value/.test(c)) add("S38", panelF, "the address box must never be given a value");
      for (const line of c.split("\n")) if (/\bgo_url\b/.test(line) && !/w\.location = r\.data\.go_url;|link = r\.data\.go_url;/.test(line)) add("S38", panelF, "the ticket link (go_url) may only be used as a tab's location or a link's href: " + line.trim().slice(0, 80));
      if (!/href: note\.link, target: "_blank", rel: "noopener noreferrer"/.test(c)) add("S38", panelF, "the fallback link must open a new tab with rel noopener noreferrer");
      if (/\b(textContent|innerText)\s*=\s*[^;]*\b(link|go_url)\b/.test(c) || /alertBox\([^)]*\b(link|go_url)\b/.test(c) || (c.match(/note\.link/g) || []).length !== (c.match(/href: note\.link/g) || []).length + (c.match(/if \(note\.link\)/g) || []).length) add("S38", panelF, "the ticket link must never be shown as text (it is only a link's href)");
      const iOpen = c.indexOf("= openBlank();"), iCall = c.indexOf("api.checkDestinationLink("), iOpener = c.indexOf("w.opener = null"), iLoc = c.indexOf("w.location = r.data.go_url");
      if (iOpen < 0 || iCall < 0 || iOpen > iCall) add("S38", panelF, "the blank tab must be opened (openBlank) BEFORE the check request is sent, inside the click");
      if (iOpener < 0 || iLoc < 0 || iOpener > iLoc) add("S38", panelF, "the new tab's opener must be cut BEFORE it is pointed at the ticket link");
      for (const m of c.matchAll(/window\.open\(([^)]*)\)/g)) if (m[1].trim() !== '"about:blank", "_blank"') add("S38", panelF, "window.open may open about:blank only (the address goes in afterwards): " + m[0].slice(0, 60));
      if (/\b(localStorage|sessionStorage|indexedDB|navigator\.clipboard|document\.cookie|console\.)/.test(c)) add("S38", panelF, "the panel keeps nothing in storage, copies nothing and logs nothing");
      if (/https?:\/\/[^\s"'`)<>]+/.test(c)) add("S38", panelF, "no web address in the panel code");
      if (/["'][^"']*\b(Add a|Add another|Add link|Add new)\b/.test(c)) add("S38", panelF, "the panel has no Add control (a new link goes through the whole-set form)");
      if (raw.includes(EMDASH)) add("S38", panelF, "no em dash in the panel's text");
      for (const need of ["LP.removeConfirm(row.position, row.label)", "LP.editTitle(row.position, row.label)", "confirmText(row.position, plan, row.label)"]) if (!c.includes(need)) add("S38", panelF, "the dialog texts must be given the row's label so a labelled row keeps its number in one title form: " + need);
      if (!/api\.checkDestinationLink\(ctx\.getPostingId\(\), row\.position\)/.test(c) || !/api\.editDestinationLink\(ctx\.getPostingId\(\), row\.position, plan\.change\)/.test(c) || !/api\.removeDestinationLink\(ctx\.getPostingId\(\), row\.position\)/.test(c)) add("S38", panelF, "the three row actions must call the three api functions with the opening id and the row's stored position");
    }
    if (fs.existsSync(apiF)) {
      const a = stripJsComments(read(apiF));
      if (!/checkIssue: \(d\) => isObj\(d\) && Object\.keys\(d\)\.length === 2 && isStr\(d\.go_url\) && isHttpsTicket\(d\.go_url\)/.test(a)) add("S38", apiF, "the check answer must be exactly two keys, with an https ticket link");
      if (!/const LINK_ROW_KEYS = \["position", "kind", "firm", "label", "shown_as", "check_status", "check_http"\];/.test(a)) add("S38", apiF, "an answer about stored links may carry only position, kind, firm, label, shown_as, check_status, check_http");
      if (!/const LINK_OP_KEYS = \["posting_id", "kind", "op", "position", "changed", "active_links", "links"\];/.test(a)) add("S38", apiF, "an edit or remove answer may carry only posting_id, kind, op, position, changed, active_links, links");
      if (!/linkRow: \(l\) => isObj\(l\) && Object\.keys\(l\)\.every\(\(k\) => LINK_ROW_KEYS\.includes\(k\)\)/.test(a) || !/linkOpAnswer: \(d\) => isObj\(d\) && Object\.keys\(d\)\.every\(\(k\) => LINK_OP_KEYS\.includes\(k\)\)/.test(a)) add("S38", apiF, "the edit and remove answers must be checked against the key lists");
      for (const need of ['call("check-destination-link", { posting_id: postingId, position }', 'call("set-destination-links", body,', 'call("set-destination-links", { posting_id: postingId, kind: "apply", op: "remove", position }']) if (!a.includes(need)) add("S38", apiF, "api.js must make the call: " + need);
      const i0 = a.indexOf("checkDestinationLink:"), i1 = a.indexOf("listMyPostings:");
      if (i0 < 0 || i1 < i0 || /poster_id|organization_id/.test(a.slice(i0, i1))) add("S38", apiF, "the panel's calls never send who is asking");
    }
    if (fs.existsSync(editF)) {
      const e = stripJsComments(read(editF));
      if (!e.includes("mountLinkPanel({") || !e.includes("linkPanel.render(doc.destination_links)")) add("S38", editF, "edit.js must mount the rows panel and draw it from the stored links");
      if (/linksStored/.test(e)) add("S38", editF, "edit.js must not draw the old stored-links sentence");
      if (/\.(url|url_enc|link_id)\b/.test(e.slice(e.indexOf("const linkPanel = mountLinkPanel"), e.indexOf("function renderLinks")))) add("S38", editF, "the panel wiring never reads an address field");
    }
    if (fs.existsSync(cssF) && !read(cssF).includes(".link-row{display:flex;")) add("S38", cssF, "the panel's row style is missing from app.css");
  }

  // S36: comments and contests (2026-09-30, rewritten 2026-10-02 for item A). Comments are free on every tier. The owner of a posting can read its comments and contest one comment, once; that is the ONLY action on a comment.
  // A contested comment stays visible with ONE notice, shown to candidates and to the owner. There is no editing of a comment anywhere, no hide or delete for an employer, no promised response time,
  // no contest control for a candidate, and no view across postings. The server decides everything that matters; these rules keep the page from saying or offering anything else.
  {
    const NOTICE = "This comment has been contested by the employer and is under review. It may be removed after additional investigation, at the sole discretion of FightGhostJobs.com.";
    const CATEGORIES = [["inaccurate", "Factually inaccurate about this opening"], ["closed_or_outdated", "Opening closed or comment outdated"], ["confidential_or_personal", "Contains confidential or personal information"], ["not_about_posting", "Not about this opening"], ["abusive", "Abusive language"], ["other", "Other"]];
    const text = (f) => (f.endsWith(".html") ? read(f).replace(/<!--[\s\S]*?-->/g, "") : stripJsComments(read(f)));
    const literals = (f) => (f.endsWith(".html") ? text(f) : [...text(f).matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] || m[2] || m[3] || "").join("\n"));
    const P = (r) => path.join(root, r);
    const model = P("js/comments-model.js"), ui = P("js/contest-ui.js"), page = P("js/pages/comments.js"), chtml = P("comments.html"), api = P("js/api.js"), priv = P("privacy.html");
    const COMMENT_FILES = [chtml, page, model, ui];                 // the comments page and everything it is made of
    const MAY_SAY_CONTEST = [chtml, page, model, ui, api, priv];   // the only files that may talk about contesting (api.js is call wrappers; privacy.html says what is kept)
    const CLAIMS = [
      [/\b(dispute|challenge|rebut|appeal)\w*\b[^.\n<]{0,50}\bcomments?\b|\bcomments?\b[^.\n<]{0,60}\b(dispute|challenge|rebut|appeal)\w*\b/i, "no text may say an employer can dispute, challenge or appeal a comment (the one action is the contest)"],
      [/\b(respond|reply|answer) to (a|the|any) comments?\b/i, "no text may say an employer can reply to a comment"],
      [/\bcomments?\b[^.\n<]{0,60}\b(across|all|every one of|each of) (of )?(your|their|the) (postings|openings)\b|\b(roll-?up|company-wide)\b[^.\n<]{0,40}\bcomments?\b/i, "no text may say an employer sees comments across all their openings (there is no such view)"],
      [/\bedit(ed|ing)? (by|your|this|the|a|my) (author|comment)|\b(modified|edited|amended)\b[^.\n<]{0,40}\bcomments?\b|\bcomments?\b[^.\n<]{0,40}\b(modified|edited|amended)\b/i, "no text may say a comment can be or was edited or modified (comments are never edited)"],
    ];
    for (const f of html.concat(js)) {
      const t = text(f);
      for (const [re, why] of CLAIMS) if (re.test(t)) add("S36", f, why);
      if (!MAY_SAY_CONTEST.includes(f) && /\bcontest\w*\b[^.\n<]{0,50}\bcomments?\b|\bcomments?\b[^.\n<]{0,60}\bcontest\w*\b/i.test(t)) add("S36", f, "only the comments page, its scripts and the privacy page may talk about contesting a comment");
    }
    if (fs.existsSync(chtml) && !read(chtml).includes("This page shows the comments on this one opening.")) add("S36", chtml, "the employer's note must say the page shows the comments on this one opening");

    // the notice: this exact text, defined once (js/comments-model.js), used for candidates AND the owner
    for (const f of html.concat(js)) {
      const raw = read(f), n = raw.split(NOTICE).length - 1, loose = /sole discretion of FightGhostJobs\.com/.test(raw);
      if (f === model) { if (n !== 1 || !raw.includes('export const CONTEST_NOTICE = "' + NOTICE + '";')) add("S36", f, "the notice must be defined once, word for word, as export const CONTEST_NOTICE"); }
      else if (n > 0 || loose) add("S36", f, "a copy or reworded copy of the contest notice: it is defined only in js/comments-model.js");
    }
    if (fs.existsSync(ui)) {
      const u = read(ui);
      if (!u.includes('tag, h("p", { class: "contest-notice-text" }, CONTEST_NOTICE));') || !/import \{[^}]*\bCONTEST_NOTICE\b[^}]*\} from "\.\/comments-model\.js";/.test(u)) add("S36", ui, "the notice block must show CONTEST_NOTICE to everyone (the owner's extra label is separate)");
    }
    if (fs.existsSync(page)) {
      // the page hands every comment, with the view it is in, to ONE function (js/contest-ui.js) that decides from contest_state; it does not decide anything about contests itself
      const c = read(page), part = 'addContestPart({ mode: state.mode, comment: c, api, card, after: body, meta, limits: state.contestLimits, onAuthFailure: employerSessionEnded });', cand = 'if (state.mode === "candidate") {';
      if (c.split(part).length !== 2 || c.indexOf(part) > c.indexOf(cand)) add("S36", page, "every comment must go through addContestPart once, with its view, before any view-only branch (the notice for an open contest in both views, the control and the decided sentence for the owner only)");
      if (/\b(mountContest|contestNotice|contestDecided)\b/.test(stripJsComments(c))) add("S36", page, "the page must not show or mount contest parts itself: js/contest-ui.js (addContestPart) does");
      if (/contestComment\(/.test(stripJsComments(c))) add("S36", page, "the page must not call contestComment itself: the control (js/contest-ui.js) does");
    }
    if (fs.existsSync(ui)) {
      // by view and by contest_state: candidate view = the notice for 'open' only; owner view = control for 'none', notice (with the filing date) for 'open', the plain already-contested sentence for 'left' and 'removed' (no control, no notice)
      const u = read(ui), pinned = [
        'const employer = mode === "employer";',
        'if (comment.contested) card.append(contestNotice({ employer, since: employer ? comment.contest_filed_at : null }));',
        'if (employer && comment.contest_state === "none") mountContest({ api, comment, card, after, meta, limits, onAuthFailure });',
        'if (employer && (comment.contest_state === "left" || comment.contest_state === "removed")) card.append(contestDecided());',
        'export function contestDecided() { return alertBox("notice", CONTEST_ALREADY); }',
      ];
      for (const line of pinned) if (u.split(line).length !== 2) add("S36", ui, "the contest parts by view and state must be exactly: " + line);
      if ((stripJsComments(u).match(/\bmountContest\(/g) || []).length !== 2) add("S36", ui, "the contest control must be mounted from addContestPart only (one definition, one call)");
      const us = stripJsComments(u);
      if ((us.match(/\bcontestDecided\(/g) || []).length !== 2 || (us.match(/\bCONTEST_ALREADY\b/g) || []).length !== 2) add("S36", ui, "the already-contested sentence may be shown only for a decided contest (left or removed) in the owner view; the server's already_contested answer is worded in comments-model.js");
    }
    for (const f of js) if (f !== ui && f !== page && /\b(mountContest|contestDecided|contestNotice|addContestPart)\b/.test(stripJsComments(read(f)))) add("S36", f, "only js/contest-ui.js may show or mount the contest parts (the comments page calls addContestPart)");
    for (const f of html.concat(js)) if (f !== model && /has already been contested/.test(read(f))) add("S36", f, "the already-contested sentence is defined only in js/comments-model.js (CONTEST_ALREADY)");
    for (const f of js) if (f !== ui && f !== api && /\.contestComment\(/.test(stripJsComments(read(f)))) add("S36", f, "only the contest control may call api.contestComment");

    // the six reasons, in order, word for word; the dropdown is built from that list and sends the code
    if (fs.existsSync(model)) {
      const m = read(model), list = (m.match(/export const CONTEST_CATEGORIES = \[([\s\S]*?)\n\];/) || [])[1] || "", got = [...list.matchAll(/\{ code: "([a-z_]+)", label: "([^"]*)" \}/g)].map((x) => [x[1], x[2]]);
      if (JSON.stringify(got) !== JSON.stringify(CATEGORIES)) add("S36", model, "the reasons must be exactly the six approved ones, with their approved labels, in order");
      if (!m.includes("export const DEFAULT_CONTEST_LIMITS = Object.freeze({ min: 30, max: 1000 });")) add("S36", model, "the first-display limits must be 30 to 1,000 (the server's answer replaces them)");
      if (!m.includes('export const CONTEST_ALREADY = "This comment has already been contested and cannot be contested again.";')) add("S36", model, "the already-contested message must be the approved one");
    }
    if (fs.existsSync(ui)) {
      const u = read(ui);
      if (!u.includes('CONTEST_CATEGORIES.map((c) => h("option", { value: c.code }, c.label))')) add("S36", ui, "the reason dropdown must be built from CONTEST_CATEGORIES, sending the code and showing the label");
      if (!u.includes("Object.assign(limits, contestLimits(r.error, limits))")) add("S36", ui, "the form must take its limits from the server's answer");
      if (!u.includes("api.contestComment(comment.id, pending.category, pending.text)")) add("S36", ui, "the control must file through api.contestComment with the comment, the reason code and the explanation");
      if (!/h\("label", \{ for: uid \+ "-cat" \}, "Reason"\)[\s\S]*h\("label", \{ for: uid \+ "-why" \}, "Explanation"\)/.test(u)) add("S36", ui, "the reason and the explanation need visible labels");
    }
    if (fs.existsSync(api)) {
      const a = read(api);
      if (!a.includes('call("contest-comment", { comment_id: commentId, category, explanation }, { validate: shapes.contestAnswer })')) add("S36", api, "contestComment must send exactly comment_id, category and explanation (who is asking comes from the session only)");
      if (!a.includes("isStr(c.created_at) && shapes.contestFields(c)")) add("S36", api, "a comment item must carry the contest fields (a missing flag is a broken answer, never false)");
      for (const pin of ['export const CONTEST_STATES = ["none", "open", "left", "removed"];', "isBool(c.contested) && CONTEST_STATES.includes(c.contest_state)", "isNullable(c.contest_filed_at, (v) => isStr(v) && Number.isFinite(Date.parse(v)))", '(c.contest_state === "none") === (c.contest_filed_at === null)', 'c.contested === (c.contest_state === "open")']) if (!a.includes(pin)) add("S36", api, "a comment item's contest fields must be checked (fail closed): " + pin);
      if (/\b(hide|delete|remove|edit|modify|amend)\w*Comment/i.test(stripJsComments(a))) add("S36", api, "no call may hide, delete, remove, edit or modify a comment from the browser");
    }
    for (const f of [page, ui, model]) if (fs.existsSync(f) && /poster_id|organization_id|contest_id/.test(stripJsComments(read(f)))) add("S36", f, "the browser never names a poster, organization or contest id: the server reads who is asking from the session");

    // no editing language, no hide or delete control, no response time, on the comments page and everything it is made of
    const EDIT = /\bedit(ed|ing|s)?\b|\bmodif(y|ies|ied|ication|ications)\b|\bamend\w*|\brevis(e|ed|ion)\b|\boriginal (text|comment|wording|version)\b/i;
    const HIDE = /\b(hide|hides|hiding|delete|deletes|deleted|remove|removes|removal|disable|disables)\b/i;
    const TIME = /\b(review|reviews|reviewed|reviewing|decide|decides|decided|decision|respond|responds|response|answer|answers|outcome|investigation)\b[^.\n<]{0,100}\b(within|in (a|an|one|two|three|four|five|\d+) |\d+ ?(minutes?|hours?|days?|weeks?)|business days?|promptly|quickly|shortly|immediately|right away|soon|same day|next day)\b|\b(within|promptly|quickly|shortly|immediately|right away|soon|same day|next day)\b[^.\n<]{0,100}\b(review|reviews|reviewed|decide|decides|decision|respond|responds|response|answer|outcome)\b/i;
    const privSentence = fs.existsSync(priv) ? (read(priv).match(/<p class="privacy-p" id="privacyContests">([\s\S]*?)<\/p>/) || [])[1] : null;
    for (const f of COMMENT_FILES) {
      if (!fs.existsSync(f)) continue;
      const lit = literals(f).split(NOTICE).join("");
      if (EDIT.test(lit)) add("S36", f, "no editing language on the comments page (no edit, edited, modified, amended, original text): comments are never edited");
      if (HIDE.test(lit)) add("S36", f, "no hide, delete, remove or disable wording on the comments page: an employer has no such control");
      if (TIME.test(lit)) add("S36", f, "no promised response time for a contest");
    }
    if (privSentence && TIME.test(privSentence)) add("S36", priv, "the privacy page must not promise a response time for a contest");
    if (fs.existsSync(chtml) && /<(button|a|input)\b[^>]*>[^<]*\b(hide|delete|remove|edit)\b/i.test(read(chtml))) add("S36", chtml, "comments.html offers a hide, delete, remove or edit control");
    // the privacy page says what a contest keeps, plainly
    if (fs.existsSync(priv)) for (const need of ['id="privacyContests"', "contest a comment on it, once", "stays visible with a notice while it is under review", "FightGhostJobs.com decides", "kept in the review record", "not shown to candidates"]) if (!read(priv).includes(need)) add("S36", priv, "privacy.html must say: " + need);
    // the notice block is bordered (it must be unmissable, and still visible when colors are forced)
    const ac = P("app.css"); if (fs.existsSync(ac) && !read(ac).includes(".contest-notice{border:2px solid var(--ember-dark);")) add("S36", ac, "the contest notice must have a solid, visible border");
  }

  // S37 (item 1 bundle, 2026-10-03): the comments page for a posting that is not open. A PAUSED posting has its own heading and the short sentence, each defined once (js/chips.js); closed, expired and every other status keep the
  // long wording, once; the "links are not listed" sentence (option B) was NOT approved and exists nowhere; the "Which link?" label and dropdown are hidden when the posting has no links (the #reportLink element itself stays, S29);
  // a rate-limited comment button shows no ticking "Wait Ns" text (the wait is said once, in words, in the message).
  {
    const chipsF = path.join(root, "js", "chips.js"), pageF = path.join(root, "js", "pages", "comments.js"), htmlF = path.join(root, "comments.html");
    const appFiles = html.concat(js);
    const count = (str) => appFiles.reduce((n, f) => n + read(f).split(str).length - 1, 0);
    const once = (str, why) => { const k = count(str); if (k !== 1) add("S37", chipsF, why + " (found " + k + " times, expected once): " + str.slice(0, 70)); };
    once('"This opening is paused"', "the paused opening's heading must exist exactly once");
    once('"Comments stay open."', "the paused opening's comments sentence must exist exactly once");
    once('"This opening is no longer open"', "the closed and expired heading must be unchanged and exist exactly once");
    once('"Comments stay open: what happened after it closed is exactly what other candidates want to know."', "the closed and expired comments sentence must be unchanged and exist exactly once");
    for (const b of ["so its links are not listed", "You can still tell us about a link you followed", "The employer's links are not listed here for this opening"]) if (count(b) > 0) add("S37", chipsF, "this sentence was not approved and must not be used: " + b);
    if (fs.existsSync(chipsF)) {
      const c = read(chipsF);
      if (!c.includes('return status === "paused" ? "This opening is paused" : "This opening is no longer open";') || !c.includes('return status === "paused" ? "Comments stay open." : "Comments stay open: what happened after it closed')) add("S37", chipsF, "the heading and the comments sentence must be chosen by status === \"paused\" only, so closed, expired and every other status keep the long wording");
    }
    if (fs.existsSync(pageF)) {
      const p = stripJsComments(read(pageF));
      if (!p.includes("notOpenRecap(d.data.status")) add("S37", pageF, "the not-open branch must take its heading and note from notOpenRecap (js/chips.js), not from literals");
      if (/"Opening"|no longer open|Comments stay open/.test(p)) add("S37", pageF, "the not-open wording is defined in js/chips.js only");
      if (!p.includes("showLinkPicker(state.links)") || !p.includes('$("#reportLinkLabel").hidden = !picker') || !p.includes("sel.hidden = !picker")) add("S37", pageF, "the Which link? label and dropdown must be hidden when the opening has no links (showLinkPicker)");
      if (/"Wait "|setInterval/.test(p)) add("S37", pageF, "the comment button must not tick down (no \"Wait Ns\" text, no one-second timer): the wait is said once, in words, in the message");
    }
    if (fs.existsSync(htmlF) && !read(htmlF).includes('<label id="reportLinkLabel" for="reportLink"')) add("S37", htmlF, "the Which link? label must carry id=reportLinkLabel (the page hides it when there are no links)");
  }

  // S40: the candidate search screen (2026-10-03). This is NOT a browse or free search: the person looks for ONE job they already know about, with the company AND one lookup value.
  // The exact IDs come first (req number, then postID); the title is the labelled fallback; the guidance is real text referenced from the inputs; a short title is not refused locally (the backend decides, from its list of short forms).
  {
    const sh = path.join(root, "search.html"), si = path.join(root, "js", "search-input.js"), sp = path.join(root, "js", "pages", "search.js");
    if (fs.existsSync(sh) && fs.existsSync(si) && fs.existsSync(sp)) {
      const t = read(sh).replace(/<!--[\s\S]*?-->/g, ""), src = read(si), page = read(sp);
      for (const s of [
        "Search for one specific job you already know about.",
        "Easiest and most exact: the company name plus the requisition (req) number or the Opening ID from the employer's job ad.",
        "No ID? Use the company name plus part of the job title, copied from the job ad if you can.",
        "Must match the employer's name. We ignore endings like Inc., Co. and LLC.",
        "A title search will not list all of a company's jobs, and it will not show openings that are not live. Closed or expired openings are found only by Opening ID or req number.",
        "Company is required. Then fill in one of the other two boxes: the req number, or the Opening ID / title box, not both. The req number is hidden as you type; press Show to check it.",
      ]) if (!t.includes(s)) add("S40", sh, "the search guidance must say: " + s);
      const form = (t.match(/<form id="searchForm"[\s\S]*?<\/form>/) || [""])[0];
      const inputs = [...form.matchAll(/<input\b[^>]*\bid="([^"]*)"/g)].map((m) => m[1]);
      if (inputs.join(",") !== "company,reqq,titleq") add("S40", sh, "the search form must have exactly three inputs, in this order: company, req number, Opening ID / title (the exact IDs come first, and there is no way to browse); found: " + inputs.join(","));
      if (!/<label for="titleq"[^>]*>Opening ID, or part of the title/.test(form)) add("S40", sh, "the title box label must say \"Opening ID, or part of the title\" (the title is the fallback, named as such)");
      for (const id of ["company", "reqq", "titleq"]) if (!new RegExp('<label for="' + id + '"').test(form)) add("S40", sh, "the " + id + " input has no label");
      const ids = new Set([...t.matchAll(/\bid="([^"]*)"/g)].map((m) => m[1]));
      const describedBy = (id) => ((form.match(new RegExp('<input id="' + id + '"[^>]*aria-describedby="([^"]*)"')) || [])[1] || "").split(/\s+/).filter(Boolean);
      for (const id of ["company", "reqq", "titleq"]) { const d = describedBy(id); if (!d.length) add("S40", sh, "the " + id + " input must point at its guidance with aria-describedby"); for (const x of d) if (!ids.has(x)) add("S40", sh, "the " + id + " input is described by #" + x + ", which is not on the page"); }
      if (!describedBy("titleq").includes("titleNote")) add("S40", sh, "the title box must be described by #titleNote (a title search does not list every job and finds only live openings)");
      if (!describedBy("company").includes("companyHint")) add("S40", sh, "the company box must be described by #companyHint");
      if (!/<div id="formError"[^>]*role="alert"/.test(t)) add("S40", sh, "the form error (#formError) must be an alert so it is announced");
      const cq = (src.match(/export function classifyQuery\([^)]*\)\s*\{([\s\S]*?)\n\}/) || [])[1] || "";
      if (/alnumCount\([^)]*\)\s*<\s*[2-9]/.test(cq.replace(/\/\/[^\n]*/g, ""))) add("S40", si, "classifyQuery must not refuse a title of 1 or 2 letters or digits locally: the backend allows the short forms in its own list (VP, SR, JR)");
      if (!/alnumCount\(t\)\s*<\s*1/.test(cq) || !/t\.length\s*>\s*80\b/.test(cq)) add("S40", si, "classifyQuery must still refuse a title with no letter or digit, and one over 80 characters");
      if (!src.includes('export const PHRASE_TOO_SHORT_MESSAGE = "That part of the title is too short to search on its own. Use at least 3 letters or digits, or a short form like VP, SR or JR if the employer used one.";')) add("S40", si, "the too-short-title message must be the approved wording");
      if (!/searchErrorMessage\(r\.error\)/.test(page)) add("S40", sp, "the page must show the backend's refusal through searchErrorMessage (the calm too-short wording)");
      const dh = path.join(root, "dashboard.html");
      if (fs.existsSync(dh) && !read(dh).includes('<div id="postIdNote" class="field-hint">You may place an opening\'s Opening ID on your own site: it lets candidates find the opening exactly.</div>')) add("S40", dh, "the dashboard must tell employers they may place the Opening ID on their own site (it lets candidates find the opening exactly)");
    } else add("S40", root, "search.html, js/search-input.js or js/pages/search.js is missing");
  }

  // S45 (2026-10-03): the edit page's unsaved-changes protection and the recruiter wording/layout.
  //   * edit.html: a polite status region (#unsavedLive), the sticky bar (#unsavedBar: the last thing in <main>, so it ends above the footer), its two buttons, the leave dialog (an alertdialog with three choices), the heading that can take focus,
  //     the two rules shown early (#noteNeeded, #titleRule); the recruiter toggle is above Save changes with its approved sentence, and the recruiter firms panel is inside the Destination links card, below Save changes.
  //   * js/dirty-state.js holds the words (pinned word for word) and no em dash; js/unsaved-guard.js asks the browser before the page is left (beforeunload), makes Escape mean Stay, moves focus into the dialog and back, and holds back links and buttons that leave;
  //     js/pages/edit.js mounts it and compares the form with the snapshot taken when it was loaded or saved; app.css gives the bar position:sticky at the bottom, a narrow-screen layout, and keeps a focused field clear of it.
  {
    const P = (...a) => path.join(root, ...a);
    const htmlF = P("edit.html"), dsF = P("js", "dirty-state.js"), gF = P("js", "unsaved-guard.js"), eF = P("js", "pages", "edit.js"), cF = P("app.css");
    const EMDASH = "—";
    if (fs.existsSync(htmlF)) {
      const t = read(htmlF);
      if (!/<div id="unsavedLive" class="unsaved-sr" role="status" aria-live="polite" aria-atomic="true"><\/div>/.test(t)) add("S45", htmlF, "#unsavedLive must be a polite status region (role=status, aria-live=polite) that is always in the page");
      if (!/<div id="unsavedBar" class="unsaved-bar" role="region" aria-label="Unsaved changes" hidden>/.test(t)) add("S45", htmlF, "#unsavedBar must exist, hidden until something is unsaved, labelled Unsaved changes");
      if (!/<button type="button" id="unsavedSave" class="btn btn-dark btn-sm">Save changes<\/button>\s*<button type="button" id="unsavedDiscard" class="btn btn-outline btn-sm">Discard<\/button>/.test(t)) add("S45", htmlF, "the bar must carry a Save changes button and a Discard button");
      const iBar = t.indexOf('id="unsavedBar"'), iMainEnd = t.indexOf("</main>"), iCard = t.indexOf('id="linksCard"');
      if (iBar < 0 || iMainEnd < 0 || iBar < iCard || iBar > iMainEnd || t.slice(iBar, iMainEnd).includes("<footer")) add("S45", htmlF, "the bar must be the last thing inside <main> (after the page content, before the footer), so it never covers the footer or the last field");
      if (!/<div id="leaveOverlay" class="unsaved-overlay" hidden>\s*<div id="leaveDialog" class="unsaved-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leaveTitle" aria-describedby="leaveText">/.test(t)) add("S45", htmlF, "the leave dialog must be an alertdialog (aria-modal, labelled and described), hidden until needed");
      if (!/id="leaveSave"[^>]*>Save and leave<\/button>\s*<button type="button" id="leaveDiscard"[^>]*>Discard and leave<\/button>\s*<button type="button" id="leaveStay"[^>]*>Stay on this page<\/button>/.test(t)) add("S45", htmlF, "the leave dialog must offer Save and leave, Discard and leave, Stay on this page");
      if (!/<h1 id="editHeading" tabindex="-1"/.test(t)) add("S45", htmlF, "the page heading must be able to take focus (#editHeading, tabindex -1): focus goes there when the bar closes under it");
      if (!t.includes('<div id="noteNeeded" class="field-hint" hidden></div>') || !t.includes('<div id="titleRule" class="field-hint" hidden></div>') || !t.includes('aria-describedby="noteNeeded"') || !t.includes('aria-describedby="titleRule"')) add("S45", htmlF, "the change-note rule and the title rule must have their places (#noteNeeded, #titleRule), read with their inputs");
      const SENT = "Free for every employer: just say yes or no. Naming the recruiter firm and adding its links is optional. It belongs to the Destination links section below, which is part of the destination links tier.";
      if (!t.includes('<div id="recruiterHint" style="font-size:13px;color:var(--muted);margin-top:2px;">' + SENT + "</div>")) add("S45", htmlF, "the recruiter toggle's sentence must be the approved one, word for word (free yes/no; naming a firm and its links is optional and belongs to the Destination links section below)");
      if (!t.includes('aria-label="Third-party recruiter involved" aria-describedby="recruiterHint"')) add("S45", htmlF, "the recruiter toggle must be read together with its sentence (aria-describedby=recruiterHint)");
      if (t.includes("The yes/no flag is free. Naming the firm is a destination links tier feature.")) add("S45", htmlF, "the old recruiter sentence (which implied the firm is named up here) must be gone from the edit page");
      const iTog = t.indexOf('id="recruiterToggle"'), iSave = t.indexOf('id="saveBtn"'), iFirms = t.indexOf('id="firmsPanel"'), iEnd = t.indexOf('id="readonlyNote"');
      if (iTog < 0 || iSave < 0 || iTog > iSave) add("S45", htmlF, "the recruiter toggle (free, for every employer) must be ABOVE Save changes");
      if (iFirms < 0 || iCard < 0 || iFirms < iSave || iFirms < iCard || iFirms > iEnd) add("S45", htmlF, "the recruiter firms panel (destination links tier) must sit inside the Destination links card, BELOW Save changes: nothing paid goes above the Save button except what the main save itself covers");
      const region = t.slice(t.indexOf('id="unsavedLive"'), t.indexOf("<footer")) + t.slice(t.indexOf('id="recruiterHint"'), t.indexOf('id="recruiterHint"') + 400);
      if (region.includes(EMDASH)) add("S45", htmlF, "no em dash in the bar, the dialog or the recruiter sentence");
    } else add("S45", htmlF, "edit.html is missing");
    if (fs.existsSync(dsF)) {
      const raw = read(dsF), c = stripJsComments(raw);
      for (const need of ['HEAD: "You have unsaved changes",', 'FORM_DETAIL: "They take effect only when you press Save changes.",', 'SAVE: "Save changes", DISCARD: "Discard",',
        'titleRule: (status) => "On a " + status + " opening, a new title must keep at least 60% of the wording of the current one. A bigger change needs a new opening.",',
        'noteRequired: (status) => "This opening is " + status + ", so a change to it needs a note. Say what changed and why.",',
        'LEAVE_SAVE_AND_LEAVE: "Save and leave", LEAVE_SAVE: "Save changes", LEAVE_DISCARD: "Discard and leave", LEAVE_STAY: "Stay on this page",',
        'export const PANEL = { LINKS: "destination links", FIRMS: "recruiter firms", GOLIVE: "go-live time" };', 'out.headline = cap(named) + " not saved yet";',
        '" not saved yet. Save changes does not save " + itThem + ": use the button in " + section + "."']) if (!c.includes(need)) add("S45", dsF, "dirty-state.js must keep: " + need.slice(0, 90));
      if (raw.includes(EMDASH)) add("S45", dsF, "no em dash in the unsaved-changes words");
    } else add("S45", dsF, "js/dirty-state.js is missing");
    if (fs.existsSync(gF)) {
      const raw = read(gF), c = stripJsComments(raw);
      if (!c.includes('win.addEventListener("beforeunload", onBeforeUnload)') || !c.includes('win.removeEventListener("beforeunload", onBeforeUnload)') || !/ev\.preventDefault\(\); ev\.returnValue = "";/.test(c)) add("S45", gF, "the guard must ask the browser before the page is left (beforeunload) while something is unsaved, and stop asking when nothing is");
      if (!/ev\.key === "Escape"\) \{ ev\.preventDefault\(\); if \(!busy\) closeDialog\(true\); return; \}/.test(c)) add("S45", gF, "Escape in the leave dialog must mean Stay");
      if (!c.includes("dlg.stay.focus();") || !c.includes("d.returnTo.focus()")) add("S45", gF, "focus must move into the leave dialog (on Stay) and return to what opened it");
      if (!/ev\.key === "Tab"/.test(c)) add("S45", gF, "Tab must stay inside the leave dialog");
      if (!c.includes('root.classList.toggle("unsaved-on", s.any)')) add("S45", gF, "the guard must mark the page while the bar shows (a focused field is kept clear of it)");
      if (/\b(localStorage|sessionStorage|indexedDB|document\.cookie|fetch\s*\(|console\.)/.test(c) || /https?:\/\/[^\s"'`)<>]+/.test(c)) add("S45", gF, "the guard keeps nothing, sends nothing and logs nothing");
      if (raw.includes(EMDASH)) add("S45", gF, "no em dash in the guard");
    } else add("S45", gF, "js/unsaved-guard.js is missing");
    if (fs.existsSync(eF)) {
      const e = stripJsComments(read(eF));
      if (!e.includes("guard = mountUnsavedGuard({") || !e.includes('guard.interceptClick(ev, { kind: "link"') || !e.includes('"#navAccount button:not(.avatar-btn)"')) add("S45", eF, "edit.js must mount the unsaved-changes guard and hold back links and Sign out that leave the page");
      if (!e.includes("state.baseline = snapshotOf(collect());") || !e.includes("snapshotOf(collect()) !== state.baseline")) add("S45", eF, "edit.js must compare the form with the snapshot taken when it was loaded or saved");
      if (!e.includes("async function submit() {\n  if (state.busy || !state.orig) return false;")) add("S45", eF, "submit() must say whether it saved (the leave dialog and the bar need to know)");
      if ((e.split("populate(reload.data, { keepForm: true, saved: PANEL.LINKS })").length - 1) !== 3 || !e.includes("populate(reload.data, { keepForm: true, saved: PANEL.FIRMS })") || !e.includes("populate(reload.data, { keepForm: true, saved: PANEL.GOLIVE })")) add("S45", eF, "saving a section (links, firms, go-live) must not throw away what was typed in the rest of the page (populate keepForm)");
    }
    if (fs.existsSync(cF)) {
      const c = read(cF);
      if (!/\.unsaved-bar\{position:sticky;bottom:0;z-index:30;/.test(c)) add("S45", cF, ".unsaved-bar must be position:sticky at the bottom, above the page");
      if (!/html\.unsaved-on\{scroll-padding-bottom:\d+px\}/.test(c)) add("S45", cF, "a field that takes focus must be kept clear of the bar (html.unsaved-on scroll-padding-bottom)");
      if (!/\.unsaved-inner\{[^}]*flex-wrap:wrap\}/.test(c) || !/@media \(max-width:720px\)\{\.unsaved-inner\{padding:10px 16px\}\.unsaved-actions\{width:100%\}/.test(c)) add("S45", cF, "the bar must wrap and stack on a narrow screen");
      if (!/\.unsaved-sr\{position:absolute;width:1px;height:1px;/.test(c)) add("S45", cF, "the status region must be hidden visually, not with display:none (a screen reader would not announce it)");
    }
  }

  // S46 (2026-10-04): the signed-in header. The initials circle is the control (js/account-menu.js): a real button whose accessible name is "Signed in as <name>, <organization>", with aria-expanded and aria-controls, a label
  // (hidden from screen readers: it mirrors the accessible name) shown on mouse-over (real pointers only), on keyboard focus and on tap / Enter / Space, closed by Escape (focus returns to the circle) or a click elsewhere.
  // js/app.js builds the signed-in area from it and no longer prints the name beside the circle; app.css has the label, the hover and focus rules, the wrap and the narrow layouts.
  {
    const P = (...a) => path.join(root, ...a);
    const mF = P("js", "account-menu.js"), aF = P("js", "app.js"), cF = P("app.css");
    const EMDASH = "—";
    if (fs.existsSync(mF)) {
      const raw = read(mF), c = stripJsComments(raw);
      if (!c.includes('const button = h("button", { type: "button", class: "avatar avatar-btn", "aria-label": t.label, "aria-expanded": "false", "aria-controls": ACCOUNT.POP_ID }, initials(t.name));')) add("S46", mF, "the circle must be a real button (type button) with the initials, an aria-label that is the full accessible name, aria-expanded and aria-controls");
      if (!c.includes('PREFIX: "Signed in as "') || !c.includes('label: ACCOUNT.PREFIX + n + (o ? ", " + o : "")')) add("S46", mF, "the accessible name must be \"Signed in as <name>, <organization>\": no information may be lost when the text leaves the bar");
      if (!c.includes('class: "account-pop", "aria-hidden": "true"')) add("S46", mF, "the label is a visual mirror of the accessible name: aria-hidden, so a screen reader does not read it twice");
      if (!c.includes('if (ev.key !== "Escape") return;') || !c.includes("if (!on && giveFocus) button.focus();") || !c.includes("set(false, true)")) add("S46", mF, "Escape must close the label and put focus back on the circle");
      if (!c.includes("if (isOpen && !contains(root, ev.target)) set(false, false);")) add("S46", mF, "a click elsewhere must close the label");
      if (!c.includes('root.addEventListener("focusout", onFocusOut);') || !c.includes("!contains(root, ev.relatedTarget)")) add("S46", mF, "focus leaving the control must close the label");
      if (!c.includes('button.setAttribute("aria-expanded", on ? "true" : "false");')) add("S46", mF, "aria-expanded must follow the label");
      if (!c.includes("if (previous) { previous(); previous = null; }")) add("S46", mF, "wiring the control twice must remove the first wiring (no stacked listeners)");
      if (/\b(localStorage|sessionStorage|indexedDB|document\.cookie|fetch\s*\(|console\.)/.test(c) || /https?:\/\/[^\s"'`)<>]+/.test(c)) add("S46", mF, "the account control keeps nothing, sends nothing and logs nothing");
      if (raw.includes(EMDASH)) add("S46", mF, "no em dash in the account control");
    } else add("S46", mF, "js/account-menu.js is missing");
    if (fs.existsSync(aF)) {
      const a = stripJsComments(read(aF));
      if (!a.includes('import { buildAccount, wireAccountMenu } from "./account-menu.js";') || !a.includes("const account = buildAccount(h, initials, name, org);") || !a.includes("wireAccountMenu(account, document);")) add("S46", aF, "app.js must build the signed-in area from the account control and wire it");
      if (a.includes('" · "') || /class: "nav-account"/.test(a)) add("S46", aF, "the name and organization must not be printed beside the circle any more (they wrapped into a tall narrow stack): they are the circle's accessible name and its label");
      if ((a.match(/container\.classList\.add\("nav-acct-area"\)/g) || []).length !== 2) add("S46", aF, "both signed-in areas (employer and candidate) must carry nav-acct-area so they wrap instead of squeezing the navigation");
      if (/margin-right:14px|margin-left:14px/.test(a)) add("S46", aF, "spacing in the signed-in area comes from the stylesheet gap, not inline margins");
      if (!a.includes('"Sign out"') || !a.includes('"Email confirmed"')) add("S46", aF, "Sign out and Email confirmed must stay in the header");
    }
    if (fs.existsSync(cF)) {
      const c = read(cF);
      if (!/\.account-pop\{display:none;position:absolute;top:calc\(100% \+ 10px\);right:0;z-index:30;/.test(c)) add("S46", cF, "the account label must be a small absolutely placed box under the circle, hidden until shown");
      if (!/\.account-pop\.open,\.avatar-btn:focus-visible\+\.account-pop\{display:block\}/.test(c)) add("S46", cF, "the label must show when opened and when the circle has keyboard focus");
      if (!/@media \(hover:hover\)\{\.nav-account:hover \.account-pop\{display:block\}\}/.test(c)) add("S46", cF, "mouse-over must show the label, for real pointers only (a touch screen would keep it stuck open)");
      if (!/\.account-pop\.dismissed\{display:none!important\}/.test(c)) add("S46", cF, "Escape must be able to dismiss the label that mouse-over or focus shows");
      if (!/\.avatar-btn::before\{content:"";position:absolute;inset:-6px\}/.test(c)) add("S46", cF, "the circle's touch target must be bigger than the drawn circle");
      if (!/\.nav-acct-area\{[^}]*flex-wrap:wrap[^}]*\}/.test(c)) add("S46", cF, "the signed-in area must be allowed to wrap");
      if (!/@media \(max-width:1300px\)\{\.nav\{padding:0 24px\}/.test(c) || !/@media \(max-width:1080px\)\{\.nav\{height:auto;min-height:72px;flex-wrap:wrap;/.test(c)) add("S46", cF, "the top bar must relax at medium widths and stack (links on their own row) below 1080 pixels, so nothing wraps into a tall narrow stack");
      if (!/a:focus-visible,button:focus-visible/.test(c)) add("S46", cF, "every button, the circle included, keeps a visible focus outline");
      if (/\.nav-account\+\.btn\{margin-left/.test(c)) add("S46", cF, "the old margin rule that depended on the printed text must stay gone");
    }
  }

  // S47 (2026-10-04): the top bar at phone widths. A static rule cannot see a header that runs off a phone's right edge, so the browser test tests/header-layout.test.js measures it (320 to 414, every page type);
  // this rule keeps the things that test depends on from being edited away: the viewport meta on every page (people must be able to zoom), text-size-adjust 100% (no text inflation), the phone layout block in app.css
  // (three short rows, 44 pixel targets, a smaller logo, the initials label anchored inside the window), no fixed width on the logo, links or account buttons, and the test itself with its five widths and its negative controls.
  {
    const cssF = path.join(root, "app.css"), baseF = path.join(root, "styles.css"), testF = path.join(root, "tests", "header-layout.test.js");
    for (const f of fs.readdirSync(root).filter((n) => n.endsWith(".html"))) {
      const t = read(path.join(root, f)), v = t.match(/<meta name="viewport" content="([^"]*)">/);
      if (!v || v[1] !== "width=device-width, initial-scale=1") add("S47", path.join(root, f), 'the viewport meta must be exactly "width=device-width, initial-scale=1" (no maximum-scale, no user-scalable=no: people must be able to zoom)');
    }
    if (fs.existsSync(cssF)) {
      const c = read(cssF);
      if (!c.includes("html{-webkit-text-size-adjust:100%;text-size-adjust:100%}")) add("S47", cssF, "html must carry text-size-adjust 100%: a phone browser must not inflate the header text");
      const i = c.indexOf("@media (max-width:640px){"), ph = i < 0 ? "" : c.slice(i);
      if (i < 0) add("S47", cssF, "the phone layout block (@media (max-width:640px)) is missing");
      const pins = [
        [".nav{padding:6px 12px;gap:0 10px;justify-content:flex-start;align-items:center;min-height:0}", "the phone bar: small padding, left aligned rows"],
        [".nav-logo{order:1;min-height:44px;gap:6px;margin-right:auto;min-width:0}", "the logo is the first item, 44 pixels tall, and pushes the account controls to the right"],
        [".nav-mark{width:32px;height:32px}", "the logo mark is 32 pixels on a phone"],
        [".nav-wordmark{font-size:16px;white-space:nowrap}", "the wordmark is 16 pixels and never wraps, so the logo stays whole at 320"],
        [".nav-links{order:5;width:100%;gap:0 6px;flex-wrap:wrap;justify-content:space-between}", "the three links are the last row, full width"],
        [".nav-links a{display:inline-flex;align-items:center;min-height:44px;font-size:14px}", "each link is a 44 pixel target"],
        ["#navAccount .btn-sm{position:relative;min-height:36px;margin:4px 0;padding:8px 12px;justify-content:center}", "the account buttons: 36 pixels drawn, 4 pixel margins"],
        ['#navAccount .btn-sm::before{content:"";position:absolute;inset:-6px 0}', "the account buttons have an invisible margin so the touch target is 44 pixels"],
        ["#navAccount.nav-acct-area{display:contents!important}", "the signed-in account items join the bar's rows"],
        ["#navAccount.nav-acct-area>*{order:4}", "the account buttons are the second row"],
        ["#navAccount.nav-acct-area>span{order:2}", "the initials circle (or Email confirmed) sits beside the logo"],
        ["#navAccount.nav-acct-area>.btn-ghost{order:3}", "Sign out sits beside the circle"],
        ['#navAccount.nav-acct-area::after{content:"";order:3;flex:0 0 100%;height:0}', "a row break after Sign out"],
        [".nav{position:relative}", "the bar anchors the initials label"],
        [".nav-account{position:static}", "the label is not anchored to the circle on a phone"],
        [".account-pop{top:50px;right:12px;max-width:calc(100vw - 24px)}", "the initials label opens under the first row and stays inside the window"],
        ["@media (max-width:360px){.nav{padding:6px 8px}.nav-links a{font-size:13px}}", "at 360 pixels and below the padding and link size shrink so the three links fit on one row at 320"],
      ];
      for (const [s, why] of pins) if (!ph.includes(s)) add("S47", cssF, "the phone layout must keep: " + why);
    }
    // nothing in the top bar's own rules may have a fixed minimum width or a wide fixed width (that is what pushes a bar off a phone screen)
    for (const f of [cssF, baseF]) {
      if (!fs.existsSync(f)) continue;
      const c = read(f).replace(/\/\*[\s\S]*?\*\//g, "");
      for (const m of c.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sel = m[1].trim(), body = m[2];
        if (!/(^|[\s,>])(\.nav(-logo|-mark|-wordmark|-links|-account|-acct-area)?|#navAccount|header\.nav)([\s.,:>#\[]|$)/.test(sel)) continue;
        const mw = body.match(/min-width:\s*(\d+(\.\d+)?)px/), w = body.match(/(^|[;\s])width:\s*(\d+(\.\d+)?)px/);
        if (mw && Number(mw[1]) > 0) add("S47", f, "a top bar rule must not set a fixed minimum width: " + sel.replace(/\s+/g, " ").slice(0, 60));
        if (w && Number(w[2]) > 100) add("S47", f, "a top bar rule must not set a fixed width over 100 pixels: " + sel.replace(/\s+/g, " ").slice(0, 60));
      }
    }
    if (!fs.existsSync(testF)) add("S47", testF, "tests/header-layout.test.js (the browser test of the header at phone widths) is missing");
    else {
      const t = read(testF);
      if (!t.includes("const WIDTHS = [320, 360, 375, 390, 414];")) add("S47", testF, "the header test must cover the widths 320, 360, 375, 390 and 414");
      if (!t.includes("negative controls: the header rule catches each deliberate defect")) add("S47", testF, "the header test must keep its negative controls");
    }
  }

  // S48 (2026-10-04): the pages at phone widths. tests/phone-layout.test.js measures every page in a real browser; this rule keeps what it depends on: the phone block in app.css (and that EVERYTHING after its marker sits inside
  // @media (max-width:640px) or (max-width:360px), so no desktop layout can change), the classes the pages carry for it, the table roles and data-labels on the rows, and the labelled scroll areas of the three tables.
  {
    const cssF = path.join(root, "app.css"), testF = path.join(root, "tests", "phone-layout.test.js");
    if (fs.existsSync(cssF)) {
      const c = read(cssF), mark = "/* phone layout for the pages themselves (October 4, 2026).", i = c.indexOf(mark);
      if (i < 0) add("S48", cssF, "the phone layout block for the pages (marker comment) is missing");
      else {
        const ph = c.slice(i);
        // everything after the marker must be inside the two phone media blocks: strip them (they contain only simple rules, no nested braces other than their own) and nothing but comments and space may remain
        const rest = ph.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@media \(max-width:(640|360)px\)\{(?:[^{}]*\{[^{}]*\})*\s*\}/g, "").trim();
        if (rest !== "") add("S48", cssF, "everything in the phone block must sit inside @media (max-width:640px) or (max-width:360px): desktop layouts must not change. Found outside: " + rest.slice(0, 80));
        const pins = [
          [".pg{padding-left:16px!important;padding-right:16px!important}", "pages use 16 pixel sides"],
          [".pg-top{padding-top:28px!important;padding-bottom:36px!important}", "shorter top and bottom space"],
          [".cols{flex-direction:column!important;gap:24px!important;align-items:stretch!important}", "two columns stack"],
          [".cols>*{flex:none!important;width:100%!important;max-width:none!important;min-width:0}", "stacked columns fill the row"],
          [".grid2,.grid3{grid-template-columns:minmax(0,1fr)!important}", "side-by-side fields and tiles go one per row"],
          [".card{padding:16px!important}", "cards have 16 pixel padding"],
          [".card.flush{padding:0!important}", "table cards keep no padding"],
          ["main .btn,main button.btn,main a.btn{min-height:44px;justify-content:center}", "buttons are 44 pixel targets"],
          ["input[type=\"text\"],input[type=\"email\"],input[type=\"number\"],input[type=\"password\"],select,textarea{font-size:16px!important}", "form text is 16 pixels (no zoom when a field is focused)"],
          [".toggle{flex:none}", "switches do not shrink"],
          [".info-tooltip,.info-tooltip-wide{position:fixed!important;left:16px!important;right:16px!important;width:auto!important;top:auto!important;bottom:16px!important}", "help text opens inside the window"],
          [".signin-row{flex-direction:column;align-items:stretch}", "the verify card's email box and button stack"],
          [".signin-row .btn{width:100%}", "the verify card's button fills the row"],
          [".site-footer{flex-wrap:wrap;gap:0 20px;padding:12px 16px}", "the footer wraps"],
          [".modal{width:calc(100vw - 24px);max-width:none;max-height:88vh;padding:20px 16px}", "the details window fits the screen"],
          [".source-row{flex-direction:column;align-items:flex-start;gap:6px;min-height:44px}", "a link's text and its Continue stack"],
          [".rtable,.rtable thead,.rtable tbody,.rtable tr,.rtable th,.rtable td{display:block}", "a table row becomes a card"],
          [".rtable td::before{content:attr(data-label);", "each cell shows its label"],
          [".res-head{flex-wrap:wrap;gap:10px}", "a result card's heading row wraps"],
        ];
        for (const [s, why] of pins) if (!ph.includes(s)) add("S48", cssF, "the phone layout must keep: " + why);
      }
    }
    const classes = {
      "index.html": ['class="pg pg-top cols" style="padding:96px', 'class="h-hero"', 'class="btn-row"', 'id="candidates" class="pg pg-top"', 'class="grid3"', 'id="employers" class="pg pg-top cols"', 'footer class="pg wrapflex"'],
      "employer-signin.html": ['class="pg pg-top cols"', 'class="h-big"'],
      "register.html": ['class="pg pg-top cols"', 'class="grid2"'], "edit.html": ['class="pg pg-top cols"', 'class="grid2"'],
      "search.html": ['<div class="pg" style="padding:56px 64px 32px 64px;">', 'id="signinWrap" class="pg"', 'id="roleNotice" class="pg"', 'id="landedNotice" class="pg"'],
      "dashboard.html": ['class="pg"', 'class="fill"', 'class="card flush" data-scroll-area="My openings table"', 'class="dash-table rtable" role="table"', 'role="columnheader">Title<'],
      "team.html": ['class="pg"', 'class="grid2"', 'class="card flush" data-scroll-area="Team table"', 'class="dash-table rtable" role="table"', '<th role="columnheader">Name</th><th role="columnheader">Work email</th><th role="columnheader">Role</th><th role="columnheader">Status</th><th role="columnheader">Actions</th>'],
      "analytics.html": ['class="pg"', 'class="grid2"', 'class="card flush" data-scroll-area="Traffic by opening table"', 'id="postingTable" class="rtable" role="table"', '<th role="columnheader">Opening</th><th role="columnheader">Searches</th><th role="columnheader">Detail views</th><th role="columnheader">Link clicks</th><th role="columnheader">Click-through</th>'],
      "comments.html": ['class="pg"'], "privacy.html": ['class="pg"'], "404.html": ['class="pg pg-top"'], "auth-callback.html": ['class="pg pg-top"'],
    };
    for (const [f, needles] of Object.entries(classes)) { const p = path.join(root, f); if (!fs.existsSync(p)) continue; const t = read(p); for (const n of needles) if (!t.includes(n)) add("S48", p, "the phone layout needs " + n + " on this page"); }
    const labels = { "dashboard.js": 9, "analytics.js": 5, "team.js": 5 };
    for (const [f, n] of Object.entries(labels)) { const p = path.join(root, "js", "pages", f); if (!fs.existsSync(p)) continue; const t = read(p); if ((t.match(/"data-label":/g) || []).length !== n || !t.includes('h("tr", { role: "row" }') || (t.match(/role: "cell"/g) || []).length !== n) add("S48", p, "each table row must carry role row, and each of its " + n + " cells role cell and a data-label (the visible label of the cell on a phone)"); }
    const sp = path.join(root, "js", "pages", "search.js"); if (fs.existsSync(sp) && read(sp).split('class: "res-head"').length - 1 !== 2) add("S48", sp, "a result card's heading row carries res-head (the candidate card and the staff card: exactly two)");
    if (!fs.existsSync(testF)) add("S48", testF, "tests/phone-layout.test.js (the browser test of every page at phone widths) is missing");
    else { const t = read(testF); if (!t.includes("const WIDTHS = [320, 360, 375, 390, 414];")) add("S48", testF, "the phone layout test must cover 320, 360, 375, 390 and 414"); if (!t.includes("negative controls: each phone fix undone makes the layout rule fail")) add("S48", testF, "the phone layout test must keep its negative controls"); }
  }

  // S49 (2026-10-04): the sign-in link opens in a NEW tab. The pending search and the landing page are kept in localStorage (all tabs of this browser, one hour, removed when used or on sign-out, never sent anywhere), and the
  // pages that ask for a sign-in link watch for a sign-in completed in another tab. The two promises on the verify card and after "Check your email" are PINNED as they are until John approves new wording.
  {
    const hF = path.join(root, "js", "signin-handoff.js"), sF = path.join(root, "js", "session.js"), pF = path.join(root, "js", "pages", "search.js"), eF = path.join(root, "js", "pages", "employer-signin.js"), cF = path.join(root, "js", "pages", "comments.js"), aF = path.join(root, "js", "pages", "auth-callback.js"), lF = path.join(root, "js", "landing-notice.js"), tF = path.join(root, "tests", "signin-tabs.test.js");
    if (fs.existsSync(hF)) {
      const h = stripJsComments(read(hF));
      if (!h.includes("export const HANDOFF_TTL_MS = 60 * 60 * 1000;")) add("S49", hF, "the saved search and landing page expire after one hour");
      if (/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|navigator|document\.cookie|sessionStorage|console\.)\b/.test(h) || /https?:\/\//.test(h)) add("S49", hF, "the hand-off keeps things in the injected storage only: nothing is sent, logged or kept elsewhere");
      if (!/store\.getItem\(key\);\s*if \(raw === null[^\n]*\n\s*store\.removeItem\(key\);\s*const o = JSON\.parse\(raw\);/.test(h) || !h.includes("!(o.exp > now)")) add("S49", hF, "a saved value is removed when it is read and refused after its expiry");
      if (!h.includes('win.addEventListener("storage", onStorage)') || !h.includes("ev.key === null || ev.key === storageKey")) add("S49", hF, "a sign-in in another tab is noticed through the storage event for the session key");
    } else add("S49", hF, "js/signin-handoff.js is missing");
    if (fs.existsSync(sF)) {
      const s = stripJsComments(read(sF));
      if (!s.includes("saveLanding(localStorage, next || \"\")") || !s.includes("takeLanding(localStorage)") || !s.includes("clearHandoff(localStorage)") || !s.includes("export function watchOtherTabSignIn")) add("S49", sF, "session.js keeps the landing page in localStorage, consumes it, clears the hand-off on sign-out and offers watchOtherTabSignIn");
    }
    if (fs.existsSync(pF)) {
      const s = stripJsComments(read(pF));
      if (!s.includes("savePending(localStorage,") || !s.includes("takePending(localStorage)") || /sessionStorage\.(get|set)Item\(PENDING|fgj-pending-search/.test(s)) add("S49", pF, "the pending search lives in localStorage (signin-handoff.js), never in tab-local storage");
      if (!s.includes("watchOtherTabSignIn(") || !s.includes("function runWhenInFront()")) add("S49", pF, "the search page watches for a sign-in in another tab and lets the tab in front run the saved search");
      if (!s.includes('"Confirm your email first. We keep your search in this browser for one hour and run it when you open the link in this browser. If the link opens somewhere else, enter your search again."') || !s.includes('"Check your email. Open the link in this same browser and your search will be waiting. If it opens in another browser or app, enter your search again there."')) add("S49", pF, "the two notices carry the wording John approved on October 4, 2026, exactly (true in every browser case: the saved search lives in this browser only)");
      if (!s.includes('roleNoteKind(session) === "both"') || !s.includes("BOTH_ROLES_TEXT")) add("S49", pF, "the search page shows the both-roles note for a session with both claims (and only through roleNoteKind)");
    }
    if (fs.existsSync(eF) && (!stripJsComments(read(eF)).includes("watchOtherTabSignIn(") || (stripJsComments(read(eF)).split('rememberedNext() || "register.html"').length - 1) !== 2)) add("S49", eF, "the employer sign-in page watches for a sign-in in another tab and returns to the page that sent the person to sign in");
    if (fs.existsSync(cF) && !stripJsComments(read(cF)).includes("watchOtherTabSignIn(")) add("S49", cF, "the comments page watches for a sign-in in another tab");
    if (fs.existsSync(aF) && (!stripJsComments(read(aF)).includes('markLanded(sessionStorage, "candidate")') || !stripJsComments(read(aF)).includes('markLanded(sessionStorage, "poster")'))) add("S49", aF, "the sign-in link page leaves the one-time landing flag");
    if (fs.existsSync(lF)) {
      const l = read(lF);
      if (!l.includes("export const LANDING_NOTICE_ENABLED = true;") || !l.includes("WORDING APPROVED by John on October 4, 2026")) add("S49", lF, "the landing note is switched on and carries its approval marker");
      for (const t of ["You are signed in. You can close this tab and go back to the one you started from, or keep searching here.", "You are signed in. You can close this tab and go back to the one you started from, or keep working here.", "This address is also an employer address, so the employer buttons show above. Searching here works as a candidate."]) if (!l.includes('"' + t + '"')) add("S49", lF, "the landing and both-roles notes carry the approved wording exactly: " + t.slice(0, 40));
      if (!l.includes('if (session.isPoster && session.isCandidate) return "both";') || !l.includes('if (session.isPoster) return "employer";')) add("S49", lF, "the both-roles note is chosen for a session with BOTH claims only (not candidate-only, not employer-only)");
      if (l.includes("\u2014")) add("S49", lF, "no em dash in the landing note");
    }
    if (fs.existsSync(path.join(root, "js", "app.js")) && (!stripJsComments(read(path.join(root, "js", "app.js"))).includes("showLandingNote(session);") || !read(path.join(root, "js", "app.js")).includes("takeLanded(sessionStorage)"))) add("S49", path.join(root, "js", "app.js"), "the top bar builder shows the one-time landing note");
    if (!fs.existsSync(tF)) add("S49", tF, "tests/signin-tabs.test.js (two real tabs) is missing");
    else { const t = read(tF); if (!t.includes("negative controls: each deliberate defect makes a sign-in tab scenario fail")) add("S49", tF, "the two-tab test must keep its negative controls"); }
  }

  // S50 (2026-10-04, after the stage recheck): (1) the landing note wording follows the PAGE (landingKindForPage), never a guess from the session; (2) the home page asks people to "Look up a posting" (the two approved sentences) and nothing in the
  // app says a company is what is searched; (3) the comments page shows "Report a wrong link" only for a posting that has links, decided once from the posting; (4) the three search fields keep their visible line and focus line; (5) the details
  // window locks the page behind it (js/scroll-lock.js) and unlocks exactly; (6) the browser tests of all of this exist.
  {
    const lnF = path.join(root, "js", "landing-notice.js"), apF = path.join(root, "js", "app.js"), cmF = path.join(root, "js", "pages", "comments.js"), cssF = path.join(root, "app.css"), shF = path.join(root, "search.html"), seF = path.join(root, "js", "pages", "search.js"), slF = path.join(root, "js", "scroll-lock.js"), ixF = path.join(root, "index.html");
    if (fs.existsSync(lnF)) {
      const l = read(lnF);
      if (!l.includes('export const EMPLOYER_PAGES = ["dashboard.html", "analytics.html", "team.html", "edit.html", "register.html"];') || !l.includes('export const CANDIDATE_PAGES = ["search.html"];') || !l.includes("export function landingKindForPage(pathname, search)")) add("S50", lnF, "the landing wording is chosen by page: the employer pages (My openings, Analytics, Team, Edit, Register) and the candidate page (Search) must be listed, with landingKindForPage");
    }
    if (fs.existsSync(apF)) {
      const a = stripJsComments(read(apF));
      if (!a.includes("landingKindForPage(location.pathname, location.search) || flag") || !a.includes('kind === "candidate" && session.isCandidate ? landingText("candidate") : kind === "poster" && session.isPoster ? landingText("poster") : null')) add("S50", apF, "the landing note takes its kind from the page (landingKindForPage) and shows only when the session really has that role");
    }
    if (fs.existsSync(ixF)) {
      const t = read(ixF);
      if (!t.includes('<a class="btn btn-dark" href="search.html">Look up an opening</a>') || !t.includes("Look up an opening by company and req number, or by company and Opening ID or title, before applying. No account or password, just a quick email check.")) add("S50", ixF, "the home page must carry the approved wording: the button Look up an opening and the sentence " + "Look up an opening by company and req number, or by company and Opening ID or title, before applying. No account or password, just a quick email check.");
    }
    for (const f of html.concat(js)) { const t = read(f); if (/Search a company|Search by company and title before applying/.test(t)) add("S50", f, "the old wording that says a company is what is searched (Search a company; Search by company and title before applying) must not come back"); }
    if (fs.existsSync(cmF)) {
      const p = stripJsComments(read(cmF));
      if (!p.includes('$("#reportWrap").hidden = !picker;') || /\$\("#reportWrap"\)\.hidden = false/.test(p)) add("S50", cmF, "Report a wrong link is shown only when the opening has links: #reportWrap.hidden = !picker, set once, and never set to false anywhere");
    }
    if (fs.existsSync(cssF)) {
      const c = read(cssF);
      for (const [needle, why] of [
        [".srch-input{border-bottom:2px solid #8A8379!important;border-radius:0!important;padding-bottom:6px!important}", "the three search fields keep a bottom line at rest (#8A8379 on white, 3.7 to 1)"],
        [".srch-input:focus{border-bottom-color:var(--ember-dark)!important;box-shadow:0 1px 0 0 var(--ember-dark)}", "the search fields get a heavier line when focused (the ring comes from the global focus rule)"],
        [".modal-backdrop{touch-action:none;overscroll-behavior:contain}", "a swipe on the dark backdrop does not scroll the page behind the details window"],
        [".modal{touch-action:pan-y;overscroll-behavior:contain}", "the details window scrolls itself and does not chain to the page"],
      ]) if (!c.includes(needle)) add("S50", cssF, "app.css must keep: " + why);
    }
    if (fs.existsSync(shF)) { const t = read(shF); for (const id of ["company", "reqq", "titleq"]) if (!new RegExp('<input id="' + id + '" class="srch-input" type="(text|password)"').test(t)) add("S50", shF, "the search field #" + id + " must carry class srch-input (its visible line)"); }
    if (fs.existsSync(seF)) {
      const s = stripJsComments(read(seF));
      if (!s.includes('import { lockScroll } from "../scroll-lock.js";') || !s.includes("if (!unlockScroll) unlockScroll = lockScroll(document, window);") || !s.includes("if (unlockScroll) { unlockScroll(); unlockScroll = null; }")) add("S50", seF, "opening the details window locks the page behind it (lockScroll) and closing it unlocks it (unlockScroll)");
    }
    if (fs.existsSync(slF)) {
      const s = stripJsComments(read(slF));
      if (!s.includes('html.style.overflow = "hidden"; body.style.overflow = "hidden";') || !s.includes("html.style.overflow = prev.html; body.style.overflow = prev.body; body.style.paddingRight = prev.pad;") || !s.includes("const bar = Math.max(0, win.innerWidth - html.clientWidth);")) add("S50", slF, "the lock hides html and body overflow, compensates a classic scrollbar, and unlock restores the exact values that were there");
      if (/\b(fetch|XMLHttpRequest|localStorage|sessionStorage|document\.cookie|console\.)\b/.test(s) || /position\s*=\s*["']fixed/.test(s)) add("S50", slF, "the scroll lock keeps nothing, sends nothing and does not use position fixed on the body");
    } else add("S50", slF, "js/scroll-lock.js is missing");
    for (const [tf, nm] of [["comments-report.test.js", "negative controls: each defect in the report section makes a scenario fail"], ["search-ui.test.js", "negative controls: each defect in the search fields or the scroll lock makes a check fail"]]) { const p = path.join(root, "tests", tf); if (!fs.existsSync(p)) add("S50", p, "the browser test " + tf + " is missing"); else if (!read(p).includes("test(\"" + nm + "\"")) add("S50", p, tf + " must keep its negative controls test: " + nm); }
  }

  // S51 (2026-10-05): the home page's step 3 and the search form's three boxes. Step 3 reads "Candidates look up" and its approved sentence; the search form says Company is REQUIRED (real text in the ember red), puts the req number and the
  // postID / title box under the heading "Then one of these" in a labelled group with a visible "or" between them, and carries the approved sentence under the form; the old sentence and the old heading must not come back. The callback
  // does not flash "Email confirmed / You can search now." on the way to an employer page.
  {
    const ixF = path.join(root, "index.html"), shF = path.join(root, "search.html"), cssF = path.join(root, "app.css"), cbF = path.join(root, "js", "pages", "auth-callback.js"), uiF = path.join(root, "tests", "search-ui.test.js");
    if (fs.existsSync(ixF)) { const t = read(ixF); if (!t.includes('<h3 style="font-size:19px;font-weight:700;">Candidates look up</h3>') || !t.includes("Look up an opening by company and req number, or by company and Opening ID or title, before applying. No account or password, just a quick email check." + "</p>")) add("S51", ixF, "home step 3 must read Candidates look up, with the approved sentence"); }
    for (const f of html.concat(js)) { if (/Candidates verify/.test(read(f))) add("S51", f, "the old heading Candidates verify must not come back on an app page"); }
    if (fs.existsSync(shF)) {
      const t = read(shF);
      if (!t.includes('>Company <span class="srch-req">(required)</span></label>') || !/<input id="company" class="srch-input" type="text" aria-required="true"/.test(t)) add("S51", shF, "the Company label must say (required) as real text, and the company box must be aria-required");
      const g = t.indexOf('<div class="srch-group" role="group" aria-labelledby="oneOfHead"'), h = t.indexOf('<div id="oneOfHead" class="srch-then">Then one of these</div>'), a = t.indexOf('<input id="reqq"'), o = t.indexOf('<div class="srch-or">or</div>'), b = t.indexOf('<input id="titleq"'), c = t.indexOf('<input id="company"');
      if (!(c >= 0 && c < g && g < h && h < a && a < o && o < b)) add("S51", shF, "the req number box and the Opening ID / title box must sit in a labelled group (role=group, aria-labelledby=oneOfHead) under the heading Then one of these, with a visible or between them, after the company box");
      if (!t.includes("Company is required. Then fill in one of the other two boxes: the req number, or the Opening ID / title box, not both. The req number is hidden as you type; press Show to check it.")) add("S51", shF, "the sentence under the form must be the approved one: " + "Company is required. Then fill in one of the other two boxes: the req number, or the Opening ID / title box, not both. The req number is hidden as you type; press Show to check it.");
      if (t.includes("Fill in only one of the two lookup boxes")) add("S51", shF, "the old sentence (Fill in only one of the two lookup boxes) must not come back");
    }
    if (fs.existsSync(cssF)) {
      const c = read(cssF);
      for (const [needle, why] of [[".srch-req{text-transform:none;letter-spacing:0;font-weight:700;color:var(--ember)}", "the word (required) is ember red real text"], [".srch-or{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:700;color:var(--muted)}", "the visible or between the two boxes"], [".srch-then{font-size:13px;font-weight:700;line-height:20px;color:var(--ink);padding:8px 12px 0 12px}", "the heading Then one of these"]]) if (!c.includes(needle)) add("S51", cssF, "app.css must keep: " + why);
    }
    if (fs.existsSync(cbF)) { const s = stripJsComments(read(cbF)); if (!s.includes('landingKindForPage("/" + destPage[0], destPage[1] ? "?" + destPage[1] : "") !== "poster") say("Email confirmed", "You can search now.", []);')) add("S51", cbF, "the callback must skip the Email confirmed flash when the destination is an employer page"); }
    if (fs.existsSync(uiF) && !read(uiF).includes("Then one of these")) add("S51", uiF, "tests/search-ui.test.js must test the search form's grouping");
  }

  // S52 (2026-10-05): accessibility round from John's keyboard-only pass (October 4, 2026). The top bar's Tab order follows what is drawn (js/header-order.js, breakpoints equal the stylesheet's 640 and 1080); the search page has ONE polite
  // status message per search (#searchStatus, js/search-status.js) and the visible count is not read a second time; the details window takes focus, traps Tab, makes the page inert and gives focus back (js/dialog-focus.js); the unsaved
  // bar says once that it is gone; every link and control has a 24 pixel hit area without a look change (the hit-area rules in app.css, class hit on the two links the audit named); and the four tests that prove it exist and are in run-all.
  {
    const hoF = path.join(root, "js", "header-order.js"), appF = path.join(root, "js", "app.js"), cssF = path.join(root, "app.css"), shF = path.join(root, "search.html"), srF = path.join(root, "js", "pages", "search.js");
    const ssF = path.join(root, "js", "search-status.js"), dfF = path.join(root, "js", "dialog-focus.js"), dsF = path.join(root, "js", "dirty-state.js"), ugF = path.join(root, "js", "unsaved-guard.js"), ixF = path.join(root, "index.html"), rgF = path.join(root, "register.html"), raF = path.join(root, "tests", "run-all.js");
    if (!fs.existsSync(hoF)) add("S52", hoF, "js/header-order.js must exist (the top bar's Tab order follows what is drawn)");
    else {
      const t = stripJsComments(read(hoF));
      if (!t.includes('PHONE_QUERY = "(max-width:640px)"') || !t.includes('MIDDLE_QUERY = "(max-width:1080px)"')) add("S52", hoF, "header-order.js must use the stylesheet's own breakpoints: (max-width:640px) and (max-width:1080px)");
      if (fs.existsSync(cssF)) { const c = read(cssF); if (!c.includes("@media (max-width:640px){") || !c.includes("@media (max-width:1080px){")) add("S52", cssF, "app.css must keep the 640 and 1080 pixel breakpoints that js/header-order.js mirrors"); }
    }
    if (fs.existsSync(appF)) {
      const t = stripJsComments(read(appF));
      if (!t.includes('import { orderHeader, watchHeaderOrder } from "./header-order.js";') || !t.includes("watchHeaderOrder(document, window)") || (t.match(/orderHeader\(document, window\);/g) || []).length < 3) add("S52", appF, "app.js must watch the header order and re-apply it after every kind of account area (signed in as an employer, as a candidate, signed out)");
    }
    if (fs.existsSync(shF)) {
      const t = read(shF);
      if (!t.includes('<div id="searchStatus" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>')) add("S52", shF, "the search page must carry the polite search status message (#searchStatus, role=status, aria-live=polite, aria-atomic=true)");
      if (!t.includes('<div id="resultCount" class="result-count" aria-hidden="true" hidden></div>')) add("S52", shF, "the visible result count must be aria-hidden so it is not read a second time");
    }
    if (fs.existsSync(srF)) {
      const t = stripJsComments(read(srF));
      for (const [needle, why] of [['import { makeAnnouncer } from "../search-status.js";', "the search status announcer"], ['import { trapFocus } from "../dialog-focus.js";', "the details window's focus handling"], ["status.announce(spoken);", "announce the recap sentence and the count as the one spoken message of a search"], ['const spoken = text + " " + countEl.textContent + ".";', "build the spoken message from the recap sentence and the count"], ["status.clear();", "clear the status when a search starts"], ["releaseFocus = trapFocus({", "trap focus in the details window"], ["releaseFocus();", "give focus back when it closes"], ["openModal(row, button)", "the exact opener button"], ["hadFocus", "give the Search button its focus back"]]) if (!t.includes(needle)) add("S52", srF, "search.js must use " + why); if (/status\.announce\(countEl/.test(t)) add("S52", srF, "search.js must not speak the count as well as the recap sentence (one spoken message per search)");
    }
    if (!fs.existsSync(ssF)) add("S52", ssF, "js/search-status.js must exist");
    if (!fs.existsSync(dfF)) add("S52", dfF, "js/dialog-focus.js must exist");
    else { const t = stripJsComments(read(dfF)); for (const [needle, why] of [['setAttribute("inert", "")', "make the page behind inert"], ['removeAttribute("inert")', "make it live again"], ['addEventListener("keydown", onKey, true)', "trap Tab"], ["dialog.focus(", "move focus into the window"], ["target.focus(", "give focus back"]]) if (!t.includes(needle)) add("S52", dfF, "dialog-focus.js must " + why); }
    if (fs.existsSync(cssF)) {
      const c = read(cssF);
      for (const [needle, why] of [[".sr-only{position:absolute;width:1px;height:1px;", "the screen-reader-only class"], [".nav-links a::before,.site-footer a::before,footer.wrapflex a::before,.hit::before,#modalMore a::before,.row-action::before,.check-row::before{content:\"\";position:absolute;left:0;right:0;top:50%;height:24px;transform:translateY(-50%)}", "the 24 pixel hit area of links and row actions"], [".loc-remove::before{content:\"\";position:absolute;inset:-1px}", "the hit area of the location chip's remove cross"], [".info-icon::before{content:\"\";position:absolute;inset:-5px}", "the hit area of the little i icons"], ["select{min-height:24px}", "the minimum height of a drop-down list"], [".modal:focus{outline:none}", "no ring around the whole details window when focus moves into it"]]) if (!c.includes(needle)) add("S52", cssF, "app.css must keep: " + why);
    }
    if (fs.existsSync(dsF) && !read(dsF).includes('CLEARED: "No unsaved changes."')) add("S52", dsF, "dirty-state.js must carry the closing message CLEARED: No unsaved changes.");
    if (fs.existsSync(ugF)) { const t = stripJsComments(read(ugF)); if (!t.includes("UNSAVED.CLEARED") || !t.includes("hushed = !!on")) add("S52", ugF, "unsaved-guard.js must announce the bar going away (UNSAVED.CLEARED) and let a discard hush it"); }
    if (fs.existsSync(ixF) && !read(ixF).includes('<a class="hit" href="search.html"')) add("S52", ixF, "the 3 Comments link on the home page's example card must carry the hit class");
    if (fs.existsSync(rgF) && !read(rgF).includes('<a class="hit" href="https://www.fightghostjobs.com/plans.html"')) add("S52", rgF, "the See what's included link on the register page must carry the hit class");
    for (const f of ["header-tab-order.test.js", "search-a11y.test.js", "edit-a11y.test.js", "target-size.test.js"]) {
      if (!fs.existsSync(path.join(root, "tests", f))) add("S52", path.join(root, "tests", f), "the test " + f + " must exist");
      else if (fs.existsSync(raF) && !read(raF).includes(f)) add("S52", raF, "tests/run-all.js must run " + f);
    }
  }

  // S53 (2026-10-05, Part C): the search recap. After a search has run the boxes are emptied and a read-only recap ("You searched for: company X, title Y. Your results are below.") sits between the form and the results, with a real
  // Edit this search button. A req number and a postID are never printed (the recap says only that one was entered); the typed values live in memory only; the one spoken message of a search is the recap sentence.
  {
    const shF = path.join(root, "search.html"), srF = path.join(root, "js", "pages", "search.js"), rcF = path.join(root, "js", "search-recap.js"), cssF = path.join(root, "app.css"), raF = path.join(root, "tests", "run-all.js");
    if (fs.existsSync(shF)) {
      const t = read(shF);
      const f = t.indexOf('<form id="searchForm"'), r = t.indexOf('<div id="recap" class="recap" hidden>'), st = t.indexOf('<div id="searchStatus"'), c = t.indexOf('<div id="resultCount"'), res = t.indexOf('<div id="results"');
      if (!(f >= 0 && f < r && r < st && st < c && c < res)) add("S53", shF, "the recap must sit between the search form and the results (form, recap, status, count, results)");
      if (!t.includes('<p id="recapText" class="recap-text"></p>') || !t.includes('<button type="button" id="recapEdit" class="btn btn-outline btn-sm">Edit this search</button>')) add("S53", shF, "the recap must carry its sentence element and a real button reading Edit this search");
    }
    if (!fs.existsSync(rcF)) add("S53", rcF, "js/search-recap.js must exist");
    else {
      const t = stripJsComments(read(rcF));
      for (const [needle, why] of [['LEAD: "You searched for: company "', "the approved opening"], ['TAIL: " Your results are below."', "the approved ending"], ['REQ: "a req number was entered"', "the req number wording"], ['CODE: "an Opening ID was entered"', "the Opening ID wording"], ['search.kind === "req" ? RECAP.REQ : search.kind === "code" || search.alsoTryCode ? RECAP.CODE : "title " + oneLine(search.value)', "a req number and an Opening ID (and twelve plain letters) are never printed, only a plain title"]]) if (!t.includes(needle)) add("S53", rcF, "search-recap.js must keep " + why);
    }
    if (fs.existsSync(srF)) {
      const t = stripJsComments(read(srF));
      for (const [needle, why] of [['import { recapSentence } from "../search-recap.js";', "the recap sentence"], ["showRecap(typed, c.value, q, auto);", "show the recap after a search has run"], ['setFormError(""); hideRecap();', "hide the recap whenever a new search starts"], ['companyIn.value = ""; queryIn.value = ""; reqIn.value = "";', "empty the three boxes after a search"], ["lastSearch = null; hideRecap(); companyIn.focus();", "Edit this search: hide the recap and put the cursor in Company"], ["companyIn.value = lastSearch.company; queryIn.value = lastSearch.q; reqIn.value = lastSearch.r;", "Edit this search puts the typed values back"]]) if (!t.includes(needle)) add("S53", srF, "search.js must " + why);
      if (t.split("\n").some((l) => /(typed|lastSearch)/.test(l) && /(localStorage|sessionStorage|indexedDB|document\.cookie)/.test(l))) add("S53", srF, "the typed search must live in memory only (no storage of it)");
    }
    if (fs.existsSync(cssF) && !read(cssF).includes(".recap[hidden]{display:none}")) add("S53", cssF, "app.css must keep .recap[hidden]{display:none} (a hidden recap must not show)");
    const tf = path.join(root, "tests", "search-recap.test.js");
    if (!fs.existsSync(tf)) add("S53", tf, "the test search-recap.test.js must exist");
    else if (fs.existsSync(raF) && !read(raF).includes("search-recap.test.js")) add("S53", raF, "tests/run-all.js must run search-recap.test.js");
  }

  // S54 (2026-10-05): the edit page's skip link. "Skip to unsaved changes" is the FIRST thing in the body of edit.html (so first in the Tab order), hidden until the unsaved bar shows, goes to Save changes, and is hidden again with the bar.
  {
    const edF = path.join(root, "edit.html"), ugF = path.join(root, "js", "unsaved-guard.js"), epF = path.join(root, "js", "pages", "edit.js"), cssF = path.join(root, "app.css"), raF = path.join(root, "tests", "run-all.js");
    if (fs.existsSync(edF)) { const t = read(edF); if (!t.includes('<body>\n<a id="skipToUnsaved" class="skip-link" href="#unsavedSave" hidden>Skip to unsaved changes</a>\n<a class="skip-link" href="#main">')) add("S54", edF, "edit.html must start with the hidden link Skip to unsaved changes (href #unsavedSave), before Skip to content"); }
    if (fs.existsSync(ugF)) { const t = stripJsComments(read(ugF)); for (const [needle, why] of [["if (skip) skip.hidden = !s.any;", "show the link exactly as long as the bar shows"], ["skip.addEventListener(\"click\"", "move focus when the link is used"], ["(saveBtn.hidden || saveBtn.disabled ? discardBtn : saveBtn).focus()", "go to Save changes, or Discard when Save is not offered"]]) if (!t.includes(needle)) add("S54", ugF, "unsaved-guard.js must " + why); }
    if (fs.existsSync(epF) && !stripJsComments(read(epF)).includes('skip: $("#skipToUnsaved")')) add("S54", epF, "edit.js must hand the skip link to the unsaved guard");
    if (fs.existsSync(raF) && !read(raF).includes("edit-a11y.test.js")) add("S54", raF, "tests/run-all.js must run edit-a11y.test.js");
    const tf = path.join(root, "tests", "edit-a11y.test.js");
    if (fs.existsSync(tf) && !read(tf).includes("Skip to unsaved changes")) add("S54", tf, "edit-a11y.test.js must test the skip link");
  }

  // S55 (2026-10-05, E3): the green "You are signed in" note clears on the first real action: typing in a search box or a finished search the person started (search page), the first click or key press in the page content (every other page).
  {
    const appF = path.join(root, "js", "app.js"), srF = path.join(root, "js", "pages", "search.js"), raF = path.join(root, "tests", "run-all.js"), tf = path.join(root, "tests", "landing-clear.test.js");
    if (fs.existsSync(appF)) { const t = stripJsComments(read(appF)); for (const [needle, why] of [["export function clearLandingNote()", "export clearLandingNote"], ['for (const t of ["click", "keydown"]) document.addEventListener(t, onAct, true);', "clear on a click or key press in the page content (pages other than search)"], ["main.contains(t) && !box.contains(t)", "ignore the top bar and the note itself"]]) if (!t.includes(needle)) add("S55", appF, "app.js must " + why); if (/setTimeout\(clearLandingNote|setTimeout\([^)]*landing/i.test(t)) add("S55", appF, "the landing note must have no timer"); }
    if (fs.existsSync(srF)) { const t = stripJsComments(read(srF)); for (const [needle, why] of [["if (!auto) clearLandingNote();", "clear the note when a search the person started has finished (and not for a replayed one)"], ["runSearch(true);", "mark the replayed search as automatic"], ['el.addEventListener("input", clearLandingNote)', "clear the note when the person types in a search box"]]) if (!t.includes(needle)) add("S55", srF, "search.js must " + why); }
    if (!fs.existsSync(tf)) add("S55", tf, "the test landing-clear.test.js must exist"); else if (fs.existsSync(raF) && !read(raF).includes("landing-clear.test.js")) add("S55", raF, "tests/run-all.js must run landing-clear.test.js");
  }

  // S56 (2026-10-05, E4): after a successful search the recap scrolls to the top of the window. A scroll, not a focus move; smooth; no scroll for a person who prefers reduced motion; none for a replayed search; none for a failed search.
  {
    const srF = path.join(root, "js", "pages", "search.js"), cssF = path.join(root, "app.css"), raF = path.join(root, "tests", "run-all.js"), tf = path.join(root, "tests", "search-scroll.test.js");
    if (fs.existsSync(srF)) { const t = stripJsComments(read(srF)); for (const [needle, why] of [['if (!auto && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) recapEl.scrollIntoView({ block: "start", behavior: "smooth" });', "scroll the recap to the top, smoothly, only for a search the person started and not with reduced motion"], ["showRecap(typed, c.value, q, auto);", "pass the replay flag to the recap"]]) if (!t.includes(needle)) add("S56", srF, "search.js must " + why); if (/recapEl\.focus\(|recapEl\.setAttribute\("tabindex"/.test(t)) add("S56", srF, "the recap must not take the focus"); }
    if (fs.existsSync(cssF) && !read(cssF).includes(".recap{scroll-margin-top:16px}")) add("S56", cssF, "app.css must keep .recap{scroll-margin-top:16px}");
    if (!fs.existsSync(tf)) add("S56", tf, "the test search-scroll.test.js must exist"); else if (fs.existsSync(raF) && !read(raF).includes("search-scroll.test.js")) add("S56", raF, "tests/run-all.js must run search-scroll.test.js");
  }

  // S57 (2026-10-05, E5): the candidate side says "confirm your email". Search card: heading "Confirm your email to search", paragraph "...that keeps your email confirmed for 90 days.", button "Email me a link"; after the link the flash
  // "Email confirmed / You can search now." and the top bar word "Email confirmed". The employer side keeps "sign-in link" (employer-signin.html). No privacy or terms text is part of this rule.
  {
    const shF = path.join(root, "search.html"), appF = path.join(root, "js", "app.js"), cbF = path.join(root, "js", "pages", "auth-callback.js"), esF = path.join(root, "employer-signin.html");
    if (fs.existsSync(shF)) {
      const t = read(shF);
      for (const [needle, why] of [["<h2>Confirm your email to search</h2>", "the heading Confirm your email to search"], ["One quick step: we email you a link, and that keeps your email confirmed for 90 days.", "the paragraph that keeps your email confirmed for 90 days"], ['id="candSend" class="btn btn-dark">Email me a link</button>', "the button Email me a link"]]) if (!t.includes(needle)) add("S57", shF, "the search card must have " + why);
      if (/Verify your email to search|keeps you verified|>Send link</.test(t)) add("S57", shF, "the old candidate wording (Verify your email to search, keeps you verified, Send link) must not come back on the search card");
    }
    if (fs.existsSync(appF) && !stripJsComments(read(appF)).includes('"Email confirmed"')) add("S57", appF, "the top bar must say Email confirmed for a candidate");
    if (fs.existsSync(cbF) && !stripJsComments(read(cbF)).includes('say("Email confirmed", "You can search now.", [])')) add("S57", cbF, "the flash after the link must be Email confirmed / You can search now.");
    if (fs.existsSync(esF)) { const t = read(esF); if (!t.includes("<h2>Email me a sign-in link</h2>") || !t.includes("Send sign-in link</button>")) add("S57", esF, "the employer sign-in page keeps its sign-in link wording"); }
  }

  // S58 (2026-10-05, E6): COMMENTS_VISIBLE in js/config.js is the one switch for the comment surfaces. It ships TRUE (changed from false on 2026-10-06, John's decision). Every surface reads it: the home page card link, the details window's Comments link (Report a wrong link stays), the comments page
  // (only the wrong-link report while off, and no thread request), the employer's comments page, the My postings column header and cells. The test comments-switch.test.js checks both states.
  {
    const cfF = path.join(root, "js", "config.js"), ixF = path.join(root, "js", "pages", "index.js"), srF = path.join(root, "js", "pages", "search.js"), cmF = path.join(root, "js", "pages", "comments.js"), dbF = path.join(root, "js", "pages", "dashboard.js"), raF = path.join(root, "tests", "run-all.js"), tf = path.join(root, "tests", "comments-switch.test.js");
    if (fs.existsSync(cfF) && !stripJsComments(read(cfF)).includes("export const COMMENTS_VISIBLE = true;")) add("S58", cfF, "js/config.js must export COMMENTS_VISIBLE = true (the comments switch ships ON)");
    const need = (f, list) => { if (!fs.existsSync(f)) return; const t = stripJsComments(read(f)); for (const [needle, why] of list) if (!t.includes(needle)) add("S58", f, "this page must follow the comments switch: " + why); };
    need(ixF, [["if (!COMMENTS_VISIBLE) { const c = $(\"#cardComments\"); if (c) c.hidden = true; }", "hide the example card's Comments link"]]);
    need(srF, [["if (COMMENTS_VISIBLE) more.append(", "the details window's Comments link"], ["if (withReport) more.append(", "keep Report a wrong link"], ["more.hidden = more.children.length === 0;", "hide an empty links line"]]);
    need(cmF, [["if (COMMENTS_VISIBLE) { $(\"#threadWrap\").hidden = false;", "show the thread and the form only when on"], ["if (COMMENTS_VISIBLE) await loadThread(0);", "ask for the thread only when on"], ["notOpenRecap(d.data.status, d.data.closed_reason || null, COMMENTS_VISIBLE)", "the Comments stay open line"], ["if (!COMMENTS_VISIBLE) return;", "the employer's thread"]]);
    need(dbF, [["if (!COMMENTS_VISIBLE) { const th", "remove the column header"], ["COMMENTS_VISIBLE ? h(\"td\"", "the Comments cell and row link"]]);
    if (!fs.existsSync(tf)) add("S58", tf, "the test comments-switch.test.js must exist"); else if (fs.existsSync(raF) && !read(raF).includes("comments-switch.test.js")) add("S58", raF, "tests/run-all.js must run comments-switch.test.js");
  }

  // S60 (2026-10-06, Phase 3): search engines. ALLOW_INDEXING in js/config.js is the one flag (false on stage). While false every page says noindex, nofollow and robots.txt disallows everything. While true only the PUBLIC pages (index.html,
  // privacy.html) say index, follow and robots.txt allows crawling; every other page (anything that needs a sign-in or shows a person's own data) says noindex, nofollow in every environment. tests/apply-indexing.js makes the files agree with the flag;
  // tests/indexing.test.js reads the pages and robots.txt over HTTP and tests the tool. This rule checks the files agree with the flag and that the tool, the test and the run-all step exist.
  {
    const cfF = path.join(root, "js", "config.js"), toolF = path.join(root, "tests", "apply-indexing.js"), rbF = path.join(root, "robots.txt"), raF = path.join(root, "tests", "run-all.js"), tf = path.join(root, "tests", "indexing.test.js");
    const PUB = ["index.html", "privacy.html"], NO = '<meta name="robots" content="noindex, nofollow">', YES = '<meta name="robots" content="index, follow">';
    const m = fs.existsSync(cfF) ? stripJsComments(read(cfF)).match(/^export const ALLOW_INDEXING = (true|false);/m) : null;
    if (!m) add("S60", cfF, "js/config.js must export ALLOW_INDEXING = false; (or true)");
    else {
      const on = m[1] === "true";
      for (const f of html) {
        const name = path.basename(f), tags = read(f).match(/<meta name="robots" content="[^"]*">/g) || [], want = PUB.includes(name) && on ? YES : NO;
        if (tags.length !== 1 || tags[0] !== want) add("S60", f, "this page must carry exactly " + want + " while ALLOW_INDEXING is " + m[1] + (PUB.includes(name) ? "" : " (it needs a sign-in or shows a person's own data: noindex in every environment)"));
      }
      const robots = fs.existsSync(rbF) ? read(rbF).replace(/\r\n/g, "\n") : null;
      if (robots === null) add("S60", rbF, "robots.txt is missing");
      else if (robots !== (on ? "User-agent: *\nAllow: /\n" : "User-agent: *\nDisallow: /\n")) add("S60", rbF, "robots.txt must be exactly " + (on ? "User-agent: *, Allow: /" : "User-agent: *, Disallow: /") + " while ALLOW_INDEXING is " + m[1]);
    }
    if (!fs.existsSync(toolF)) add("S60", toolF, "tests/apply-indexing.js must exist");
    if (!fs.existsSync(tf)) add("S60", tf, "the test indexing.test.js must exist"); else if (fs.existsSync(raF) && !read(raF).includes("indexing.test.js")) add("S60", raF, "tests/run-all.js must run indexing.test.js");
  }

  // S61 (2026-10-06, Phase 4): the emailed one-time code typed in the SAME tab. EMAIL_CODE_ENTRY in js/config.js is its switch; js/session.js confirms the code with the Auth service as type "email"; the search page and the employer sign-in page mount the code
  // field (js/code-entry.js, a one-time-code field with a label) when the switch is on; the callback page leaves out the "close this tab" landing note when the person typed the code (?via=code); tests/code-entry.test.js proves it in a real browser.
  {
    const cfF = path.join(root, "js", "config.js"), ceF = path.join(root, "js", "code-entry.js"), seF = path.join(root, "js", "session.js"), srF = path.join(root, "js", "pages", "search.js"), esF = path.join(root, "js", "pages", "employer-signin.js"), acF = path.join(root, "js", "pages", "auth-callback.js"), raF = path.join(root, "tests", "run-all.js"), tf = path.join(root, "tests", "code-entry.test.js");
    if (fs.existsSync(cfF) && !/^export const EMAIL_CODE_ENTRY = false;/m.test(stripJsComments(read(cfF)))) add("S61", cfF, "js/config.js must export EMAIL_CODE_ENTRY = false; (the emailed code field ships OFF until the owner has pasted the email template on stage and tested it; switching it on is a deliberate edit of this rule and of tests/code-entry.test.js)");
    const need = (f, list) => { if (!fs.existsSync(f)) { add("S61", f, "this file is part of the emailed code and must exist"); return; } const t = stripJsComments(read(f)); for (const [needle, why] of list) if (!t.includes(needle)) add("S61", f, "the emailed code needs: " + why); };
    need(ceF, [['autocomplete: "one-time-code"', "a one-time-code field"], ['h("label", { for: "codeInput" }, "Or type the code from the email")', "a label on the field"], ["export const CODE_ENABLED = EMAIL_CODE_ENTRY === true;", "the switch"]]);
    need(seF, [["authClient().verifyOtp({ email, token, type })", "the Auth service call that confirms the code"], ['call("email")', "the code confirmed as type email"]]);
    need(srF, [["if (CODE_ENABLED) {", "the code field only while the switch is on"], ["confirm: confirmEmailCode", "the code confirmed through session.js"]]);
    need(esF, [["if (CODE_ENABLED) {", "the code field only while the switch is on"], ["confirm: confirmEmailCode", "the code confirmed through session.js"], ['go("auth-callback.html?via=code")', "the way on after the code"]]);
    need(acF, [['if (!viaCode) markLanded(sessionStorage, "poster");', "no landing note after a typed code (employer)"], ['if (!viaCode) markLanded(sessionStorage, "candidate");', "no landing note after a typed code (candidate)"]]);
    if (!fs.existsSync(tf)) add("S61", tf, "the test code-entry.test.js must exist"); else if (fs.existsSync(raF) && !read(raF).includes("code-entry.test.js")) add("S61", raF, "tests/run-all.js must run code-entry.test.js");
  }

  // S62 (2026-10-06, extension hand-off): the search page can be opened with the company and ONE other value in the URL fragment (js/fragment-prefill.js). The fragment is untrusted input: only the keys c, p, r, t, the site's own length limits,
  // plain text only (.value, never markup), a key twice or more than one second value or a control character refuses the whole fragment, the fragment is taken out of the address bar at once, and the page NEVER runs the search by itself.
  // tests/fragment-prefill.unit.test.js and tests/fragment-prefill.test.js prove the behavior; this rule keeps the pieces in place.
  {
    const fpF = path.join(root, "js", "fragment-prefill.js"), srF = path.join(root, "js", "pages", "search.js"), raF = path.join(root, "tests", "run-all.js"), t1 = path.join(root, "tests", "fragment-prefill.unit.test.js"), t2 = path.join(root, "tests", "fragment-prefill.test.js");
    const need = (f, list) => { if (!fs.existsSync(f)) { add("S62", f, "this file is part of the fragment hand-off and must exist"); return; } const t = stripJsComments(read(f)); for (const [needle, why] of list) if (!t.includes(needle)) add("S62", f, "the fragment hand-off needs: " + why); };
    need(fpF, [['export const FRAGMENT_KEYS = { c: "company", p: "postid", r: "req", t: "title" };', "only the keys c, p, r, t"], ["export const FRAGMENT_MAX = { company: 200, postid: 14, req: 100, title: 80 };", "the site's own length limits"], ["MAX_TOTAL = 700, MAX_PARTS = 12", "a limit on the whole fragment"],
      ["Object.prototype.hasOwnProperty.call(FRAGMENT_KEYS, key)", "unknown keys ignored"], ["if (found.has(key)) { bad = true; continue; }", "a key given twice refuses the fragment"], ["if (hasControl(value)) { bad = true; continue; }", "a control character refuses the fragment"],
      ["catch { bad = true; continue; }", "a bad percent escape refuses the fragment"], ["seconds.length !== 1", "exactly one second value"], ["win.history.replaceState(", "the fragment taken out of the address bar"], ["companyEl.value = result.company;", "text into the box with .value"],
      ["if (result.kind === \"req\") reqEl.value = result.value; else queryEl.value = result.value;", "the req number into the req box only"]]);
    if (fs.existsSync(fpF)) { const t = stripJsComments(read(fpF)); if (/innerHTML|insertAdjacentHTML|outerHTML|document\.write|\beval\b|new Function|createContextualFragment/.test(t)) add("S62", fpF, "the fragment text must only ever go into a box with .value, never into the page as markup"); }
    need(srF, [["import { applyFragmentPrefill } from \"../fragment-prefill.js\";", "the import"], ["if (applyFragmentPrefill({ win: window, companyEl: companyIn, queryEl: queryIn, reqEl: reqIn })) takePending(localStorage);", "the fragment read once, at the start, dropping a saved search, with no search run by it"]]);
    for (const tf of [t1, t2]) { if (!fs.existsSync(tf)) add("S62", tf, "the test " + path.basename(tf) + " must exist"); else if (fs.existsSync(raF) && !read(raF).includes(path.basename(tf))) add("S62", raF, "tests/run-all.js must run " + path.basename(tf)); }
  }

  // S63 (2026-10-07): Back from Comments or Report a wrong link must give the search page back as it was. The browser keeps the page it is leaving (back/forward cache) and throws it away when a message reaches it on a BroadcastChannel; the Auth library
  // opens one on every page, so js/session.js creates the client with globalThis.BroadcastChannel hidden for that one synchronous moment and puts it back. No other script may open a channel, no script may register an unload handler (it also stops the cache),
  // and the search page checks the session when the browser hands the page back (results are cleared for a person who signed out meanwhile). tests/back-restore.test.js proves the behavior in a real browser; this rule keeps the pieces in place.
  {
    const ssF = path.join(root, "js", "session.js"), srF = path.join(root, "js", "pages", "search.js"), raF = path.join(root, "tests", "run-all.js"), btF = path.join(root, "tests", "back-restore.test.js");
    if (!fs.existsSync(ssF)) add("S63", ssF, "js/session.js must exist");
    else {
      const t = stripJsComments(read(ssF)), a = t.indexOf("const channel = globalThis.BroadcastChannel;"), b = t.indexOf("globalThis.BroadcastChannel = undefined;"), c = t.indexOf("new GoTrueClient("), d = t.indexOf("} finally { globalThis.BroadcastChannel = channel; }");
      if (a < 0 || b < 0 || c < 0 || d < 0 || !(a < b && b < c && c < d)) add("S63", ssF, "the Auth client must be created with the cross-tab channel hidden (const channel = ...; globalThis.BroadcastChannel = undefined; new GoTrueClient(...); finally put back)");
    }
    for (const f of js) {
      if (path.basename(f) === "session.js") continue;
      const t = stripJsComments(read(f));
      if (/BroadcastChannel/.test(t)) add("S63", f, "no script but js/session.js may touch BroadcastChannel (a message evicts a page from the back/forward cache)");
      if (/addEventListener\(\s*["']unload["']|\bonunload\b/.test(t)) add("S63", f, "no unload handler: it stops the browser from keeping the page for Back (use pagehide if something must run)");
    }
    if (!fs.existsSync(srF)) add("S63", srF, "js/pages/search.js must exist");
    else {
      const t = stripJsComments(read(srF));
      for (const [needle, why] of [['window.addEventListener("pageshow", async (ev) => {', "the pageshow guard"], ["if (!ev.persisted) return;", "the guard runs only for a page the browser hands back"], ["if (s && s.isCandidate) { session = s; return; }", "a person who is still signed in keeps the page as it is"],
        ["closeModal(); clear(resultsEl); countEl.hidden = true; hideRecap(); lastSearch = null; status.clear();", "results, recap and the details window are cleared for a person who is not signed in"], ['if (!session) showSignIn("Please confirm your email to search.");', "the sign-in card is shown"]]) if (!t.includes(needle)) add("S63", srF, "the page guard needs: " + why);
    }
    if (!fs.existsSync(btF)) add("S63", btF, "tests/back-restore.test.js must exist");
    else if (fs.existsSync(raF) && !read(raF).includes("back-restore.test.js")) add("S63", raF, "tests/run-all.js must run back-restore.test.js");
  }

  // S59 (2026-10-05, E7): candidate-facing text says "confirm", never "verify", "verified" or "verification" (about a candidate, an email or a comment). NO EXCEPTION FOR LINK WORDING ANY MORE (October 9, 2026: the stored label is "Employer-provided link, not checked by us", and the page sentences say "not checked by us" and "we could not check it"; rule S59b below pins them).
  // The only exceptions: data field and class names (verified_at, plan.verified, badge-verified, --verified, reverification_required: a word joined to a dot, dash, underscore or colon, or inside a longer word), and privacy.html (its wording waits for John).
  // The rule reads every page and script of the site, with comments and styles removed. The email template text is not in the repository (it lives in the Supabase dashboard), so it is not scanned here.
  {
    const WORD = /(^|[^\w.\-])(verify|verifies|verified|verifying|verification)(?![\w:\-])/i, ALLOWED = /$^/g;   // nothing is allowed any more
    for (const f of html.concat(js)) {
      if (path.basename(f) === "privacy.html") continue;
      const raw = read(f), t = f.endsWith(".html") ? raw.replace(/<!--[\s\S]*?-->/g, "").replace(/<style[\s\S]*?<\/style>/g, "") : stripJsComments(raw);
      const hit = t.split("\n").map((l) => l.replace(ALLOWED, "")).find((l) => WORD.test(l));
      if (hit) add("S59", f, "candidate-facing text must say confirm, not verify, verified or verification: " + hit.trim().slice(0, 100));
    }
  }

  // S59b (2026-10-09, prompt AZ): the destination link wording. The label a candidate sees for a link we have not recognised is "Employer-provided link, not checked by us" (public.dl_public_label, link-label-migration); the employer pages quote it in lower case
  // and the details window says "we could not check it". The new words are PINNED (so they cannot drift), the old ones are refused everywhere a person reads, and the two test fixtures that stand for the stored label carry the new exact label.
  {
    const must = [["edit.html", '"employer-provided link, not checked by us"'], ["register.html", '"employer-provided link, not checked by us"'], ["search.html", "we could not check it"]];
    for (const [rel, str] of must) { const p = path.join(root, rel); if (!fs.existsSync(p) || !read(p).includes(str)) add("S59", p, "the link wording must say: " + str); }
    for (const rel of ["tests/api.test.js", "tests/edit.test.js"]) { const p = path.join(root, rel); if (fs.existsSync(p)) { const s = read(p); if (!s.includes("Employer-provided link, not checked by us")) add("S59", p, "the stored label fixture must be exactly: Employer-provided link, not checked by us"); if (/not verified by us/.test(s)) add("S59", p, "the old stored label (not verified by us) must not be used any more"); } }
  }

  // S66 (2026-10-09, prompt AV): the words of the opening vocabulary. Anything a person reads (page text, titles, aria-label, alt, placeholder and other text attributes, and every string a script puts on screen) says "opening" for our record and "job ad" for what a board shows:
  // never "posting", "listing" or "registry" (the site is not called a registry), never "certified" or "compliant", "listed" only inside "listed opening" (the unpaid status), and no em or en dash. Code names are not text a person reads and stay as they are: a word joined to a dot,
  // dash or underscore, or inside a longer word (create-posting, posting_id, list-my-postings, share_of_registry_pct). "verified" is rule S59 (no exception any more; the link label says "not checked by us").
  {
    const BANNED = /(^|[^\w.\-])(listing|listings|posting|postings|registry|certified|certify|certification|compliant|compliance|complies|comply)(?![\w\-])|(^|[^\w.\-])listed(?! opening)(?![\w\-])|[\u2013\u2014]/i;
    const REG = /(^|[^\w.\-])regist(er|ers|ered|ering|ration)(?![\w\-]|\.html)/i;
    const strings = (code) => { const out = []; for (const m of code.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) out.push(m[1] ?? m[2] ?? m[3] ?? ""); return out; };
    const pageText = (raw) => raw.replace(/<!--[\s\S]*?-->/g, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]*>/g, (tag) => " " + [...tag.matchAll(/\b(?:aria-label|alt|title|placeholder|content|value)="([^"]*)"/g)].map((x) => x[1]).join(" | ") + " ");
    for (const f of html.concat(js)) {
      const raw = read(f), parts = f.endsWith(".html") ? [pageText(raw), ...[...raw.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1])] : strings(stripJsComments(raw));
      for (const p of parts) { const hit = p.split("\n").find((l) => BANNED.test(l)); if (hit) { add("S66", f, "people read this: it uses a word or a dash the opening vocabulary does not allow: " + hit.trim().slice(0, 110)); break; } }
      // "Registered" is the PAID status word (the check mark): the free employer action is "Add an opening" (prompt AZ, October 9, 2026). The register family is refused in anything a person reads, except the check mark's own label and a page file name (register.html).
      for (const p of parts) { const hit = p.replace(/✓ Registered/g, "").split("\n").find((l) => REG.test(l) && !/^[a-z0-9_\-./]+$/.test(l.trim())); if (hit) {   // a lower case single token with no space is a code name or a path (submit("register"), "../registered.js"), not text
 add("S66", f, "people read this: register, registered or registration is the paid status word only (the check mark); the free action is Add an opening: " + hit.trim().slice(0, 110)); break; } }
    }
  }

  // S67 (2026-10-09, prompt AZ): the page never sees a plan. The "Registered" check mark is ONE boolean per result row from the database (is_registered, an active paid plan); the search page, the staff wording, the chips and the search.html shell never name a plan,
  // a plan source, an expiry or an organization table, and no script or page string names the stored plan values (plan_source, plan_expires_at, promotional). The only reader of is_registered is js/registered.js, and it accepts a real boolean true only.
  {
    const rel = (p) => path.join(root, p);
    const NAMES = /\b(plan|plan_source|plan_expires_at|promotional|pilot|paid|org_is_registered|organizations?)\b/i;
    for (const p of ["js/pages/search.js", "js/staff-scope.js", "js/registered.js", "js/chips.js", "js/search-input.js", "search.html"]) {
      if (!fs.existsSync(rel(p))) { add("S67", rel(p), p + " must exist"); continue; }
      const t = p.endsWith(".html") ? read(rel(p)).replace(/<!--[\s\S]*?-->/g, "") : stripJsComments(read(rel(p)));
      const hit = t.split("\n").find((l) => NAMES.test(l));
      if (hit) add("S67", rel(p), "the page must not name a plan, a plan source, an expiry or the organizations table: " + hit.trim().slice(0, 100));
    }
    for (const f of html.concat(js)) {
      const t = f.endsWith(".html") ? read(f).replace(/<!--[\s\S]*?-->/g, "") : stripJsComments(read(f));
      if (/plan_source|plan_expires_at|\bpromotional\b/i.test(t)) add("S67", f, "no page or script may name the stored plan source or expiry (plan_source, plan_expires_at, promotional)");
    }
    const rf = rel("js/registered.js"), sf = rel("js/pages/search.js");
    if (fs.existsSync(rf) && !stripJsComments(read(rf)).includes("row.is_registered === true")) add("S67", rf, "the check mark rule must be a strict boolean true: row.is_registered === true");
    if (fs.existsSync(sf)) {
      const s = stripJsComments(read(sf));
      if (/\.is_registered\b/.test(s)) add("S67", sf, "the search page must read is_registered only through isRegistered (js/registered.js)");
      if (s.split("isRegistered(row) ?").length - 1 !== 2) add("S67", sf, "both the public card and the staff card must draw the check mark only through isRegistered(row)");
    }
  }

  // S64 (2026-10-08): the repository is what Pages serves, so no database script may live in it. No .sql file anywhere (tests/ is served too) and no top-level db folder. On October 8 the four email wording scripts were committed to db/ and were public for a day;
  // database scripts live outside the repositories (C:\Users\jpiro\fightghostjobs, next to the census and cleanup scripts). The promote tool also refuses to copy them to alpha (alpha-setup\promote\lib\frontend.js).
  {
    const sql = files.filter((f) => /\.sql$/i.test(f));
    for (const f of sql) add("S64", f, "no .sql file may be in this repository: the whole repository is served by Pages. Keep database scripts outside it.");
    for (const e of fs.readdirSync(root, { withFileTypes: true })) if (e.isDirectory() && /^db$/i.test(e.name)) add("S64", path.join(root, e.name), "no top-level db folder: the whole repository is served by Pages. Keep database scripts outside it.");
  }

  // S65 (2026-10-08): the staff-only search scope (search.html?scope=all). The decision is the database's (is_staff), never the page's: the staff mode starts ONLY on a clear true from api.isStaff; the staff branch of the search page calls no candidate function
  // (those count, record or email for candidates), stores nothing in the browser, and marks the page noindex (the database keeps its own private who-and-when record of each staff search: staff-audit-log-migration); its API calls are never cached; nothing about it is in search.html (the shell is the same for everybody); only the search page may call the two staff functions.
  {
    const sj = path.join(root, "js", "pages", "search.js"), ss = path.join(root, "js", "staff-scope.js"), shF = path.join(root, "search.html"), apiF = path.join(root, "js", "api.js");
    if (!fs.existsSync(ss)) add("S65", ss, "js/staff-scope.js must exist");
    else {
      const s = stripJsComments(read(ss));
      if (!s.includes('export const STAFF_BANNER = "Staff view: showing all openings, including ones that are not live.";')) add("S65", ss, "the staff banner must be exactly: Staff view: showing all openings, including ones that are not live.");
      if (!s.includes('all.length === 1 && all[0] === "all"')) add("S65", ss, "only exactly one scope parameter whose value is exactly all may ask for the staff scope");
      if (/\b(posting|listing|verified|certified|complian)/i.test(s)) add("S65", ss, "staff scope wording: opening and job ad, never posting, listing, verified, certified or compliant");
      // October 9, 2026 (prompt AZ): the staff view keeps a private who-and-when record, and the words staff read say so in plain words, with no search words kept
      if (!s.includes("A private record is kept of who searched and when, never the words searched for.")) add("S65", ss, "the line under the search boxes in the staff view must say: A private record is kept of who searched and when, never the words searched for.");
      if (/read only/i.test(s)) add("S65", ss, "staff scope text must not say the staff view is read only or writes nothing: it keeps a private who-and-when record");
    }
    if (fs.existsSync(sj)) {
      const c = stripJsComments(read(sj));
      if (!c.includes("if (r.ok && r.data === true) enterStaffMode();") || (c.match(/\benterStaffMode\(\)/g) || []).length !== 2) add("S65", sj, "the staff mode may start only on a clear true from the database (api.isStaff), in one place");
      const a = c.indexOf("function renderStaffCard"), b = c.indexOf('window.addEventListener("pagehide"');
      if (a < 0 || b < a) add("S65", sj, "the staff scope block (renderStaffCard to the pagehide handler) must exist");
      else {
        const region = c.slice(a, b);
        if (/api\.candidate|savePending|takePending|localStorage|sessionStorage|\.setItem\(|innerHTML|document\.cookie/.test(region)) add("S65", sj, "the staff scope block must call no candidate function and store nothing in the browser");
        if (!region.includes('"noindex, nofollow"')) add("S65", sj, "the staff page must be marked noindex, nofollow");
        if (!/api\.staffSearch\(/.test(region) || !/api\.isStaff\(/.test(region)) add("S65", sj, "the staff scope block must use api.isStaff and api.staffSearch");
      }
      if (!c.includes('window.addEventListener("pagehide", () => { if (staffMode) {')) add("S65", sj, "staff results must be cleared when the page is left (pagehide)");
    }
    if (fs.existsSync(shF) && /staff/i.test(read(shF))) add("S65", shF, "search.html must not mention staff: the shell is the same for everybody");
    for (const f of js) { const n = path.relative(root, f).replace(/\\/g, "/"); if (["js/pages/search.js", "js/api.js", "js/staff-scope.js"].includes(n)) continue; if (/\b(isStaff|staffSearch|staff_search_openings|is_staff)\b/.test(stripJsComments(read(f)))) add("S65", f, "only js/pages/search.js may use the staff functions"); }
    if (fs.existsSync(apiF)) {
      const c = read(apiF), i = c.indexOf("async function rpc("), j = c.indexOf("const postingAnswer");
      if (i < 0 || j < i || !c.slice(i, j).includes('cache: "no-store"') || !c.slice(i, j).includes('"/rest/v1/rpc/"')) add("S65", apiF, 'the rpc helper must never cache (cache: "no-store") and must call /rest/v1/rpc/');
      const names = [...c.matchAll(/\brpc\("([a-z_]+)"/g)].map((m) => m[1]).sort().join(",");
      if (names !== "is_staff,staff_search_openings") add("S65", apiF, "the only database functions api.js may call directly are is_staff and staff_search_openings (found: " + names + ")");
    }
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
