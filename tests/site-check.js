// site-check.js - static rules for the whole site. Run: node tests/site-check.js [rootDir]      (exit 1 on any finding)
// The site handles two kinds of session and shows text written by strangers (postings, comments), so these rules are enforced by a program, not by care:
//   S1  every page carries the one expected Content-Security-Policy (scripts only from this site; the only network destination is the project's own API)
//   S2  every page says noindex, nofollow
//   S3  no inline script, no inline event handler, no javascript: URL
//   S4  every <script> is a module from js/ and exists
//   S5  no way to turn text into HTML or code (innerHTML, outerHTML, insertAdjacentHTML, document.write, eval, new Function, string timers)
//   S6  every import resolves to a real file
//   S7  every local href / src / stylesheet exists
//   S8  no network address other than the project's API appears in code, markup or styles (no CDN, no analytics, no font host); the exceptions are the pricing card's link to https://www.fightghostjobs.com/plans.html and the SVG namespace NAME in js/open-link.js (a name that is never requested)
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
//   S70 the employer's AI and hiring policy link (prompt BA): one box in the Disclosures area of the editor under the two AI toggles, behind the destination links tier, its own save, never an application link, one line for candidates only when the server sent it, words that claim nothing about the page
//   S72 the recruiter firms and the AI and hiring policy link as rows (prompts BC and BC1): one shared rows panel (js/row-panel.js) for all three link areas; a firm without an address has no Check link; each row calls its own kind's calls only; the address never reaches a row; three firms at most; exact accessible names
//   S71 the stage SQL and edge function tools (prompt BF; they live in C:\Users\jpiro\fightghostjobs\tools, outside this repository): no token, key or password written anywhere, the stage ref only as one constant, the only host api.supabase.com
//   S69 test browsers: one launcher (tests/cdp-tabs.js) that records the pid at spawn, marks its profile folder, closes on a bound, removes the folder and prints when it cannot; a time limit per suite step; the leak check is the last step and fails with LEAK: <count>; the negative control that leaves a browser open
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
import { stripMarkers, problems as stampProblems } from "./stamp-versions.js";

export const API_ORIGIN = "https://tpmvkjuhbbwftqoodzcn.supabase.co";
export const EXPECTED_CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src " + API_ORIGIN + "; base-uri 'self'; form-action 'self'; object-src 'none'";
export const EXPECTED_CSP_404 = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'";   // prompt BQ: script-src 'self' added for the short link receiving script (js/kio-receive.js); still no connect-src, no image, nothing else

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};
const stripJsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, "$1")).join("\n");

// opts.toolsDir / opts.reportsDir: where rule S71 looks for the stage tools and the files they write (default: the main folder next to this repository)
export function checkSite(root, opts = {}) {
  const findings = []; const add = (rule, file, msg) => findings.push({ rule, file: path.relative(root, file).replace(/\\/g, "/"), msg });
  const files = walk(root);
  const html = files.filter((f) => f.endsWith(".html")), js = files.filter((f) => f.endsWith(".js") && !f.includes(path.sep + "tests" + path.sep) && !f.includes(path.sep + "vendor" + path.sep)), css = files.filter((f) => f.endsWith(".css"));
  const mjs = files.filter((f) => f.endsWith(".mjs"));
  // every rule reads a page or a script WITHOUT its version markers (?v=xxxxxxxx on local references, tests/stamp-versions.js), so each rule and pin sees the text it always saw; rule S75 reads the markers themselves
  const read = (f) => stripMarkers(fs.readFileSync(f, "utf8"));
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
        // prompt BQ: 404.html is served at ANY path, so its own references begin with a slash (its style sheets always did); the script is the same kind of file, a module of js/
        else if (!/\btype="module"/.test(attrs) || !/^js\/[a-z0-9\/-]+\.js$/i.test(name === "404.html" ? src.replace(/^\//, "") : src)) add("S4", f, "script must be a module from js/: " + src);
        else if (!fs.existsSync(path.join(root, name === "404.html" ? src.replace(/^\//, "") : src))) add("S4", f, "script does not exist: " + src);
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
    for (const m of s.matchAll(/https?:\/\/[^\s"'`)<>]+/g)) if (!m[0].startsWith(API_ORIGIN) && !(m[0] === "http://www.w3.org/2000/svg" && /js[\\/]open-link\.js$/.test(f))) add("S8", f, "network address in code: " + m[0]);   // the one XML namespace name of the external link icon (js/open-link.js): a name, never requested
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
    for (const rel of ["js/pages/register.js", "js/pages/edit.js"]) { const p = path.join(root, rel); if (!fs.existsSync(p) || !read(p).includes("mountLinkRowsById(")) add("S25", p, rel + " must mount the shared link rows"); }
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
    for (const rel of ["js/pages/register.js", "js/pages/edit.js"]) { const p = path.join(root, rel); if (!fs.existsSync(p)) continue; const c = read(p); const isEdit = rel.endsWith("edit.js"); if (!c.includes(isEdit ? 'mountLinkRows({ host: $("#firmRows"), addBtn: null, mode: "firmAdd" })' : "mountFirmRowsById(")) add("S27", p, rel + (isEdit ? " must mount the one-row add form for the firms" : " must mount the shared firm rows")); if (!c.includes("api.setRecruiterFirms(")) add("S27", p, rel + " must save the firms through api.setRecruiterFirms"); }
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
      if (!body.startsWith('<body>\n' + (name === "edit.html" || name === "register.html" ? '<a id="skipToUnsaved" class="skip-link" href="#unsavedSave" hidden>Skip to unsaved changes</a>\n' : '') + '<a class="skip-link" href="#main">Skip to content</a>\n')) add("S31", f, "the skip link must be the first thing in the body");
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
    const htmlF = P("edit.html"), panelF = P("js", "row-panel.js"), wrapF = P("js", "link-panel.js"), modelF = P("js", "link-panel-model.js"), apiF = P("js", "api.js"), editF = P("js", "pages", "edit.js"), cssF = P("app.css");
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
      const iOpen = c.indexOf("= openBlank();"), iCall = c.indexOf("P.runCheck("), iOpener = c.indexOf("w.opener = null"), iLoc = c.indexOf("w.location = r.data.go_url");
      if (iOpen < 0 || iCall < 0 || iOpen > iCall) add("S38", panelF, "the blank tab must be opened (openBlank) BEFORE the check request is sent, inside the click");
      if (iOpener < 0 || iLoc < 0 || iOpener > iLoc) add("S38", panelF, "the new tab's opener must be cut BEFORE it is pointed at the ticket link");
      for (const m of c.matchAll(/window\.open\(([^)]*)\)/g)) if (m[1].trim() !== '"about:blank", "_blank"') add("S38", panelF, "window.open may open about:blank only (the address goes in afterwards): " + m[0].slice(0, 60));
      if (/\b(localStorage|sessionStorage|indexedDB|navigator\.clipboard|document\.cookie|console\.)/.test(c)) add("S38", panelF, "the panel keeps nothing in storage, copies nothing and logs nothing");
      if (/https?:\/\/[^\s"'`)<>]+/.test(c)) add("S38", panelF, "no web address in the panel code");
      if (/["'][^"']*\b(Add a|Add another|Add link|Add new)\b/.test(c)) add("S38", panelF, "the panel has no Add control (a new link goes through the whole-set form)");
      if (raw.includes(EMDASH)) add("S38", panelF, "no em dash in the panel's text");
      if (!/const r = await P\.runCheck\(row\);/.test(c) || !/r = await P\.runEdit\(row, plan\.change\)/.test(c) || !/const r = await P\.runRemove\(row\);/.test(c)) add("S38", panelF, "the three row actions go through the profile's runCheck, runEdit and runRemove, once each");
    }
    // since prompt BC (October 10, 2026) the rows are the shared panel (js/row-panel.js, pinned above) and js/link-panel.js is the destination links PROFILE: its dialog texts and its three calls are pinned here
    if (fs.existsSync(wrapF)) {
      const wraw = read(wrapF), wc = stripJsComments(wraw);
      for (const need of ["LP.removeConfirm(row.position, row.label)", "LP.editTitle(row.position, row.label)", "confirmText(row.position, plan, row.label)"]) if (!wc.includes(need)) add("S38", wrapF, "the dialog texts must be given the row's label so a labelled row keeps its number in one title form: " + need);
      if (!/api\.checkDestinationLink\(ctx\.getPostingId\(\), row\.position\)/.test(wc) || !/api\.editDestinationLink\(ctx\.getPostingId\(\), row\.position, change\)/.test(wc) || !/api\.removeDestinationLink\(ctx\.getPostingId\(\), row\.position\)/.test(wc)) add("S38", wrapF, "the three row actions must call the three api functions with the opening id and the row's stored position");
      if (!wc.includes("mountRowPanel({ ...ctx, profile })")) add("S38", wrapF, "the destination links rows are the shared rows panel (js/row-panel.js)");
      if (/https?:\/\/[^\s"'`)<>]+/.test(wc)) add("S38", wrapF, "no web address in the panel code");
      if (wraw.includes(EMDASH)) add("S38", wrapF, "no em dash in the panel's text");
    } else add("S38", wrapF, "js/link-panel.js must exist");
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
        "Easiest and most exact: the Opening ID from the employer's job ad (no company name needed), or the company name plus the requisition (req) number.",
        "No ID? Use the company name plus part of the job title, copied from the job ad if you can.",
        "Must match the employer's name. We ignore endings like Inc., Co. and LLC.",
        "A title search will not list all of a company's jobs, and it will not show openings that are not live. Closed or expired openings are found only by Opening ID or req number.",
        "Company is required, unless you type an Opening ID. Then fill in one of the other two boxes: the req number, or the Opening ID / title box, not both. The req number is hidden as you type; press Show to check it.",
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
      // prompt BK (October 11, 2026): the main button is the one action area at the very bottom, after every section; the firms panel is inside the Destination links card, ABOVE it (rule S78 pins the bottom area itself)
      if (iFirms < 0 || iCard < 0 || iFirms < iCard || iFirms > iSave || iSave > iEnd) add("S45", htmlF, "the recruiter firms panel (destination links tier) must sit inside the Destination links card, which sits ABOVE the one action area with Save changes at the bottom");
      const region = t.slice(t.indexOf('id="unsavedLive"'), t.indexOf("<footer")) + t.slice(t.indexOf('id="recruiterHint"'), t.indexOf('id="recruiterHint"') + 400);
      if (region.includes(EMDASH)) add("S45", htmlF, "no em dash in the bar, the dialog or the recruiter sentence");
    } else add("S45", htmlF, "edit.html is missing");
    if (fs.existsSync(dsF)) {
      const raw = read(dsF), c = stripJsComments(raw);
      for (const need of ['HEAD: "You have unsaved changes",', 'FORM_DETAIL: "They take effect only when you press Save changes.",', 'SAVE: "Save changes", DISCARD: "Discard",',
        'titleRule: (status) => "On a " + status + " opening, a new title must keep at least 60% of the wording of the current one. A bigger change needs a new opening.",',
        'noteRequired: (status) => "This opening is " + status + ", so a change to it needs a note. Say what changed and why.",',
        'LEAVE_SAVE_AND_LEAVE: "Save and leave", LEAVE_SAVE: "Save changes", LEAVE_DISCARD: "Discard and leave", LEAVE_STAY: "Stay on this page",',
        'export const PANEL = { POLICY: "AI and hiring policy link", LINKS: "destination links", FIRMS: "recruiter firms", GOLIVE: "go-live time" };', 'out.headline = cap(named) + " not saved yet";',
        '" not saved yet. Save changes does not save " + itThem + ": use the button in " + section + "."']) if (!c.includes(need)) add("S45", dsF, "dirty-state.js must keep: " + need.slice(0, 90));
      if (raw.includes(EMDASH)) add("S45", dsF, "no em dash in the unsaved-changes words");
    } else add("S45", dsF, "js/dirty-state.js is missing");
    if (fs.existsSync(gF)) {
      const raw = read(gF), c = stripJsComments(raw);
      if (!c.includes('win.addEventListener("beforeunload", onBeforeUnload)') || !c.includes('win.removeEventListener("beforeunload", onBeforeUnload)') || !/ev\.preventDefault\(\); ev\.returnValue = "";/.test(c)) add("S45", gF, "the guard must ask the browser before the page is left (beforeunload) while something is unsaved, and stop asking when nothing is");
      if (!/ev\.key === "Escape"\) \{ ev\.preventDefault\(\); if \(!busy\) closeDialog\(true\); return; \}/.test(c)) add("S45", gF, "Escape in the leave dialog must mean Stay");
      if (!c.includes("focusWithRing(dlg.stay);") || !c.includes("d.returnTo.focus()")) add("S45", gF, "focus must move into the leave dialog (on Stay, with its ring drawn at once: js/focus-ring.js) and return to what opened it");
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
      if ((e.split("populate(reload.data, { keepForm: true, saved: PANEL.LINKS })").length - 1) !== 3 || (e.split("populate(reload.data, { keepForm: true, saved: PANEL.FIRMS })").length - 1) !== 4 || !e.includes("populate(reload.data, { keepForm: true, saved: PANEL.GOLIVE })")) add("S45", eF, "saving a section (links, firms, go-live) must not throw away what was typed in the rest of the page (populate keepForm)");
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
      "dashboard.html": ['class="pg"', 'class="fill"', 'class="card flush" data-scroll-area="My openings table"', 'class="dash-table rtable my-openings" role="table"', 'id="headRow"'],      // prompt BL: the class my-openings scopes the layout rules to this table; prompt BP: the headings are drawn by js/pages/dashboard.js (the Status column comes and goes)
      "team.html": ['class="pg"', 'class="grid2"', 'class="card flush" data-scroll-area="Team table"', 'class="dash-table rtable" role="table"', '<th role="columnheader">Name</th><th role="columnheader">Work email</th><th role="columnheader">Role</th><th role="columnheader">Status</th><th role="columnheader">Actions</th>'],
      "analytics.html": ['class="pg"', 'class="grid2"', 'class="card flush" data-scroll-area="Traffic by opening table"', 'id="postingTable" class="rtable" role="table"', '<th role="columnheader">Opening</th><th role="columnheader">Searches</th><th role="columnheader">Detail views</th><th role="columnheader">Link clicks</th><th role="columnheader">Click-through</th>'],
      "comments.html": ['class="pg"'], "privacy.html": ['class="pg"'], "404.html": ['class="pg pg-top"'], "auth-callback.html": ['class="pg pg-top"'],
    };
    for (const [f, needles] of Object.entries(classes)) { const p = path.join(root, f); if (!fs.existsSync(p)) continue; const t = read(p); for (const n of needles) if (!t.includes(n)) add("S48", p, "the phone layout needs " + n + " on this page"); }
    const labels = { "dashboard.js": 7, "analytics.js": 5, "team.js": 5 };      // prompt BP: My openings has seven columns at most (Title, Req #, Opening ID, Status, Actions, Closes, Comments)
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
      if (!t.includes("Company is required, unless you type an Opening ID. Then fill in one of the other two boxes: the req number, or the Opening ID / title box, not both. The req number is hidden as you type; press Show to check it.")) add("S51", shF, "the sentence under the form must be the approved one: " + "Company is required, unless you type an Opening ID. Then fill in one of the other two boxes: the req number, or the Opening ID / title box, not both. The req number is hidden as you type; press Show to check it.");   // prompt BQ: the ID alone is enough, so the sentence says so
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
      for (const [needle, why] of [['import { makeAnnouncer } from "../search-status.js";', "the search status announcer"], ['import { trapFocus } from "../dialog-focus.js";', "the details window's focus handling"], ["status.announce(spoken);", "announce the recap sentence and the count as the one spoken message of a search"], ['const spoken = text + " " + countEl.textContent + "." + (extra ? " " + extra : "");', "build the spoken message from the recap sentence and the count (and, prompt BQ, the mismatch notice when there is one)"], ["status.clear();", "clear the status when a search starts"], ["releaseFocus = trapFocus({", "trap focus in the details window"], ["releaseFocus();", "give focus back when it closes"], ["openModal(row, button)", "the exact opener button"], ["hadFocus", "give the Search button its focus back"]]) if (!t.includes(needle)) add("S52", srF, "search.js must use " + why); if (/status\.announce\(countEl/.test(t)) add("S52", srF, "search.js must not speak the count as well as the recap sentence (one spoken message per search)");
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
      for (const [needle, why] of [['LEAD: "You searched for: company "', "the approved opening"], ['TAIL: " Your results are below."', "the approved ending"], ['REQ: "a req number was entered"', "the req number wording"], ['CODE: "an Opening ID was entered"', "the Opening ID wording"], ['search.kind === "req" ? RECAP.REQ : search.kind === "kio" && typeof search.shown === "string" && search.shown !== "" ? RECAP.KIO + search.shown : search.kind === "code" || search.kind === "kio" || search.alsoTryCode ? RECAP.CODE : "title " + oneLine(search.value)', "a req number, an old code and twelve plain letters are never printed, only a plain title; a KIO ID (public by design, prompt BS) is shown in its shown form"],
        ['KIO: "Opening ID ",', "the words that go before a shown KIO ID"]]) if (!t.includes(needle)) add("S53", rcF, "search-recap.js must keep " + why);
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
    need(dbF, [['...(COMMENTS_VISIBLE ? ["Comments"] : [])', "remove the column header"], ["COMMENTS_VISIBLE ? h(\"td\"", "the Comments cell and row link"]]);
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
    need(fpF, [['export const FRAGMENT_KEYS = { c: "company", p: "postid", r: "req", t: "title", k: "kio" };', "only the keys c, p, r, t and (prompt BQ) k"], ["export const FRAGMENT_MAX = { company: 200, postid: 14, req: 100, title: 80, kio: 24 };", "the site's own length limits"],
      ['if (found.has("p") || found.has("r")) return { ours: true, result: null };', "a KIO ID never rides with a postID or a req number"], ["if (read.kind !== \"kio\") return { ours: true, result: null };", "a k that is not a KIO ID passing the check refuses the fragment"], ["MAX_TOTAL = 700, MAX_PARTS = 12", "a limit on the whole fragment"],
      ["Object.prototype.hasOwnProperty.call(FRAGMENT_KEYS, key)", "unknown keys ignored"], ["if (found.has(key)) { bad = true; continue; }", "a key given twice refuses the fragment"], ["if (hasControl(value)) { bad = true; continue; }", "a control character refuses the fragment"],
      ["catch { bad = true; continue; }", "a bad percent escape refuses the fragment"], ["seconds.length !== 1", "exactly one second value"], ["win.history.replaceState(", "the fragment taken out of the address bar"], ["companyEl.value = result.company;", "text into the box with .value"],
      ["if (result.kind === \"req\") reqEl.value = result.value; else queryEl.value = result.value;", "the req number into the req box only"]]);
    if (fs.existsSync(fpF)) { const t = stripJsComments(read(fpF)); if (/innerHTML|insertAdjacentHTML|outerHTML|document\.write|\beval\b|new Function|createContextualFragment/.test(t)) add("S62", fpF, "the fragment text must only ever go into a box with .value, never into the page as markup"); }
    need(srF, [["import { applyFragmentPrefill } from \"../fragment-prefill.js\";", "the import"], ["if (applyFragmentPrefill({ win: window, companyEl: companyIn, queryEl: queryIn, reqEl: reqIn, onKio: (k) => { heldKio = k.title ? { stored: k.stored, title: k.title } : null; } })) takePending(localStorage);", "the fragment read once, at the start, dropping a saved search, with no search run by it (the KIO title words kept in memory only)"]]);
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
      // prompt BQ (October 12, 2026): the two sentences John's KIO ID spec words with "registered" (an ID that no opening holds; an ID held by another company or title) are his own approved wording and are let through, exactly.
      // Prompt BS (October 12, 2026): the second one is now the notice John approved in direction ("This ID is not registered to the company you entered (...)") and its title and both variants in the same style.
      for (const p of parts) { const hit = p.replace(/✓ Registered/g, "").replace(/No opening is registered under that ID\./g, "").replace(/This ID is not registered to the (company or job title|job title|company) (you entered|in the job ad)/g, "").split("\n").find((l) => REG.test(l) && !/^[a-z0-9_\-./]+$/.test(l.trim())); if (hit) {   // a lower case single token with no space is a code name or a path (submit("register"), "../registered.js"), not text
 add("S66", f, "people read this: register, registered or registration is the paid status word only (the check mark); the free action is Add an opening: " + hit.trim().slice(0, 110)); break; } }
    }
  }

  // S67 (2026-10-09, prompt AZ): the page never sees a plan. The "Registered" check mark is ONE boolean per result row from the database (is_registered, an active paid plan or a pilot plan with an expiry date); the search page, the staff wording, the chips and the search.html shell never name a plan,
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

  // S68 (2026-10-09, prompt AZ3): the display-only place text. An opening staged from the employer's own job board may carry source_location_text, shown ONLY while it has no catalog place, always with the note, never used to search.
  // Only js/place.js reads the field (js/api.js only names it in the staff key list); no page names it; the note and the 200 character cap are pinned; the three places that show a place (the result card, the staff card and the details
  // window) go through placeNodes and never through locationLine; nothing makes markup from it; and no script names a place of the employer boards (a place is never invented by the page).
  {
    const rel = (f) => path.relative(root, f).split(path.sep).join("/");
    for (const f of js) {
      const t = stripJsComments(read(f)), r = rel(f);
      if (/source_location_text/.test(t) && r !== "js/place.js" && r !== "js/api.js" && r !== "js/place-text.js") add("S68", f, "only js/place.js and js/place-text.js may name source_location_text");
      if (r === "js/api.js") for (const l of t.split("\n")) if (/source_location_text/.test(l) && !/STAFF_ROW_OPTIONAL_KEYS/.test(l)) add("S68", f, "api.js may name source_location_text only in the staff optional key list: " + l.trim().slice(0, 80));
    }
    for (const f of html) if (/source_location_text/.test(read(f))) add("S68", f, "no page may name source_location_text");
    const pl = path.join(root, "js", "place.js"), sj = path.join(root, "js", "pages", "search.js");
    if (!fs.existsSync(pl)) add("S68", pl, "js/place.js must exist");
    else {
      const s = stripJsComments(read(pl));
      if (!s.includes('export const PLACE_NOTE = "as provided by the employer";')) add("S68", pl, "the note must be exactly: as provided by the employer");
      if (!s.includes("export const MAX_PLACE_CHARS = 200;") || !s.includes(".slice(0, MAX_PLACE_CHARS)")) add("S68", pl, "the place text is cut at 200 characters (MAX_PLACE_CHARS = 200 and .slice(0, MAX_PLACE_CHARS))");
      if (!/replace\(\/\[\\u0000-\\u001f\\u007f-\\u009f\]\/g, ""\)/.test(s)) add("S68", pl, "control characters must be removed from the place text");
      if (!s.includes('locs.length === 0 ? sourcePlaceText(row) : ""')) add("S68", pl, "the source text is used ONLY when the opening has no catalog place");
      if (/innerHTML|insertAdjacentHTML|document\.write/.test(s)) add("S68", pl, "no markup is made from the place text");
      if (/\b(listed|verified|registered|certified|compliant)\b/i.test(s.replace(/MAX_PLACE_CHARS/g, ""))) add("S68", pl, "the place wording must not say listed, verified, registered, certified or compliant");
    }
    if (fs.existsSync(sj)) {
      const s = stripJsComments(read(sj));
      if (/locationLine\(/.test(s)) add("S68", sj, "the search page shows a place only through placeNodes (js/place.js), never locationLine directly");
      if (s.split("placeNodesOf(row)").length - 1 < 3 || !s.includes("const placeNodesOf = (row) => placeNodes(h, row);")) add("S68", sj, "the result card, the staff card and the details window must all show the place through placeNodesOf(row), which is js/place.js placeNodes");
      if (/innerHTML|insertAdjacentHTML/.test(s)) add("S68", sj, "the search page makes no markup from data");
    }
    for (const f of html.concat(js)) {
      if (rel(f).startsWith("js/data/")) continue;   // the catalog itself (the picker's list of US places) is data the employer CHOOSES from, not a place the page invents
      const t = f.endsWith(".html") ? read(f).replace(/<!--[\s\S]*?-->/g, "") : stripJsComments(read(f));
      const hit = /São Paulo|Sao Paulo|Tokyo|Berlin|Melbourne|Bengaluru|Bangalore|Cheltenham|Cape Town|Clearwater/.exec(t);
      if (hit) add("S68", f, "no page or script may name a place of the employer boards (a place is never invented by the page): " + hit[0]);
    }
  }

  // S69 (2026-10-10, prompt BB2): every browser a test starts goes through ONE launcher that cleans up after itself. tests/cdp-tabs.js is the only file that starts a browser (no other test file names a browser flag or program); it records the
  // pid the moment the browser is spawned, names the profile folder with the test marker, closes on a bound (ask, then stop the recorded pid and its children, never by program name), waits for the exit, removes the folder with retries and
  // prints a line when it cannot; it has an exit handler and Ctrl+C / terminate handlers. tests/run-all.js gives every step a time limit (tests/step-runner.js stops the step and its browsers), sweeps stale marker folders first and ends with
  // the leak check (tests/leak-check.js), which prints LEAK: <count> and fails when a marker process or folder is left; tests/leak-check.test.js proves the check fires on a browser that is left open.
  {
    const rel = (f) => path.relative(root, f).split(path.sep).join("/");
    const tf = files.filter((f) => /^tests\/[^/]+\.js$/.test(rel(f)));
    const ALLOWED = ["tests/cdp-tabs.js", "tests/browser-clean.js", "tests/site-check.js", "tests/site-check.controls.js"];
    for (const f of tf) {
      const r = rel(f);
      if (ALLOWED.includes(r)) continue;
      const t = read(f);
      const hit = /--remote-debugging|--user-data-dir|--load-extension|--headless|chrome\.exe|msedge\.exe/.exec(t);
      if (hit) add("S69", f, "only tests/cdp-tabs.js may start a browser (found " + hit[0] + "); every test goes through launchBrowser");
    }
    const need = (r, msg) => { const f = path.join(root, r); if (!fs.existsSync(f)) { add("S69", f, r + " must exist: " + msg); return null; } return stripJsComments(read(f)); };
    const cd = need("tests/cdp-tabs.js", "the one launcher");
    if (cd !== null) {
      if (!cd.includes("fs.mkdtempSync(path.join(os.tmpdir(), markerPrefix()))")) add("S69", path.join(root, "tests", "cdp-tabs.js"), "the profile folder name must carry the test marker (markerPrefix())");
      const a = cd.indexOf("r.pid = proc.pid;"), b = cd.indexOf("const portFile");
      if (a < 0 || b < a) add("S69", path.join(root, "tests", "cdp-tabs.js"), "the process id must be recorded the moment the browser is spawned, before anything else can fail (r.pid = proc.pid; before the port wait)");
      if (!cd.includes('method: "Browser.close"')) add("S69", path.join(root, "tests", "cdp-tabs.js"), "close() must first ask the browser to close (Browser.close)");
      if (!cd.includes("stopPidTree(r.pid)")) add("S69", path.join(root, "tests", "cdp-tabs.js"), "a browser that does not close is stopped by its recorded pid and its children (stopPidTree(r.pid))");
      if (/\.kill\(/.test(cd)) add("S69", path.join(root, "tests", "cdp-tabs.js"), "no plain .kill(): only the recorded pid and its children are stopped, by stopPidTree");
      if (!cd.includes('console.error("browser cleanup: could not remove ')) add("S69", path.join(root, "tests", "cdp-tabs.js"), "a profile folder that cannot be removed must be printed, never swallowed");
      if (!cd.includes('process.on("exit", cleanAllSync)') || !cd.includes('"SIGINT"')) add("S69", path.join(root, "tests", "cdp-tabs.js"), "an exit handler and a Ctrl+C handler must clean up an open browser");
      if (!cd.includes("await closeAllBrowsers();")) add("S69", path.join(root, "tests", "cdp-tabs.js"), "a top level after hook must close any browser a test file left open");
    }
    const bc = need("tests/browser-clean.js", "the clean up helper");
    if (bc !== null) {
      if (/["']\/IM["']/i.test(bc)) add("S69", path.join(root, "tests", "browser-clean.js"), "never stop a process by program name (no taskkill /IM)");
      if (!bc.includes('["/PID", String(pid), "/T", "/F"]')) add("S69", path.join(root, "tests", "browser-clean.js"), "a process is stopped only by pid with its children (taskkill /PID <pid> /T /F)");
      if (!bc.includes("const NAME_RE = /^fgj-test-(\\d+)-(\\d+)-[A-Za-z0-9]+$/;")) add("S69", path.join(root, "tests", "browser-clean.js"), "only folders that match the marker pattern may be removed");
    }
    const sr = need("tests/step-runner.js", "the step time limit");
    if (sr !== null && (!sr.includes("stopPidTree(child.pid)") || !sr.includes("reapOrphans("))) add("S69", path.join(root, "tests", "step-runner.js"), "a step that exceeds its limit is stopped with the processes below it, and leftover test browsers are reaped");
    const lc = need("tests/leak-check.js", "the leak check");
    if (lc !== null && (!lc.includes("formatLeak(") || !lc.includes("process.exit(1);"))) add("S69", path.join(root, "tests", "leak-check.js"), "the leak check prints LEAK: <count> and fails");
    const ra = need("tests/run-all.js", "the suite");
    if (ra !== null) {
      if (/spawnSync/.test(ra)) add("S69", path.join(root, "tests", "run-all.js"), "every step runs through runStep with a time limit, never spawnSync without one");
      if (!ra.includes("limitMs: lim * 60000")) add("S69", path.join(root, "tests", "run-all.js"), "every step has a time limit (limitMs: lim * 60000)");
      if (!ra.includes("sweepStale()")) add("S69", path.join(root, "tests", "run-all.js"), "the suite starts with a sweep of stale marker folders");
      if (!ra.includes("stopCurrentStep();") || !ra.includes('"SIGINT"')) add("S69", path.join(root, "tests", "run-all.js"), "Ctrl+C must stop the running step and remove what it left (stopCurrentStep and a SIGINT handler)");
      const k = ra.indexOf('path.join(here, "leak-check.js")'), e = ra.indexOf("];", k);
      if (k < 0 || ra.indexOf('path.join(here, "', k + 10) >= 0 && ra.indexOf('path.join(here, "', k + 10) < e) add("S69", path.join(root, "tests", "run-all.js"), "the leak check must be the LAST step");
      if (!ra.includes('path.join(here, "leak-check.test.js")')) add("S69", path.join(root, "tests", "run-all.js"), "the leak check's own test (tests/leak-check.test.js) must run in the suite");
    }
    const hl = fs.existsSync(path.join(root, "tests", "header-layout.test.js")) ? stripJsComments(read(path.join(root, "tests", "header-layout.test.js"))) : "";
    if (hl && (!hl.includes('from "./cdp-tabs.js"') || !hl.includes("await launchBrowser()") || /\bspawn\(/.test(hl))) add("S69", path.join(root, "tests", "header-layout.test.js"), "the header test uses the shared launcher (cdp-tabs.js), not its own");
    const lt = need("tests/leak-check.test.js", "proves the leak check fires");
    if (lt !== null && !lt.includes("negative controls: a browser the test does not close makes the leak check fire")) add("S69", path.join(root, "tests", "leak-check.test.js"), "the negative control that leaves a browser open must exist");
  }

  // S70 (2026-10-10, prompt BA): the employer's AI and hiring policy link. One more destination link, in the Disclosures area of the opening editor, directly under the two AI toggles and their notes; its words are in js/policy-link.js and
  // are the opening vocabulary (rule S66 scans them like every other string) and make no claim about the page (never verified, approved, compliant or summarized). It is NOT an application link: only the editor writes it (api.setPolicyLink),
  // the application panel and the candidate's apply rows, the empty note and the wrong-link report never take it, and candidates are shown it only as the entry the server sent. The tests that prove it run in the suite.
  {
    const rel = (f) => path.relative(root, f).split(path.sep).join("/");
    const P = (...p) => path.join(root, ...p);
    const polF = P("js", "policy-link.js"), editF = P("js", "pages", "edit.js"), srchF = P("js", "pages", "search.js"), formF = P("js", "edit-form.js"), cmF = P("js", "comments-model.js"), apiF = P("js", "api.js"), htmlF = P("edit.html"), runF = P("tests", "run-all.js");
    if (!fs.existsSync(polF)) add("S70", polF, "js/policy-link.js must exist");
    else {
      const s = stripJsComments(read(polF));
      if (!s.includes('export const POLICY_LABEL = "Link to your AI and hiring policy (optional)";')) add("S70", polF, 'the box label must be exactly: Link to your AI and hiring policy (optional)');
      if (!s.includes('export const POLICY_LINE_LABEL = "AI and hiring policy:";')) add("S70", polF, "the candidate's line must start exactly: AI and hiring policy:");
      for (const m of s.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) if (/\b(verified|verify|approved|approval|complian\w*|certif\w*|endors\w*|guarantee\w*|summar\w*|vouch\w*)\b/i.test(m[1])) { add("S70", polF, "the policy link's words make no claim about the page (never verified, approved, compliant, certified or summarized): " + m[1].slice(0, 80)); break; }
      if (!s.includes('if (!l || typeof l.label !== "string" || l.label === "") return null;')) add("S70", polF, "a candidate is shown the policy line only for an entry the server sent, with a place");
      if (!s.includes('filter((x) => x && x.kind !== "policy")')) add("S70", polF, "applicationLinks must leave the policy link out");
      if (/innerHTML|insertAdjacentHTML|document\.write/.test(s)) add("S70", polF, "no markup is made from the policy link's words");
    }
    if (fs.existsSync(htmlF)) {
      const h = read(htmlF), i = h.indexOf('id="policyRow"'), a = h.indexOf('id="aiInterviewNoteRow"'), r2 = h.indexOf('id="recruiterToggle"');
      if (i < 0 || !(a >= 0 && a < i && r2 > i)) add("S70", htmlF, "the AI and hiring policy box must sit directly under the two AI toggles and their notes (after aiInterviewNoteRow, before the recruiter toggle)");
      if (!h.includes('<label for="policyUrl" id="policyLabel"') || !h.includes(">Link to your AI and hiring policy (optional)</label>")) add("S70", htmlF, "the box needs its visible label, tied to the input");
      if (!h.includes('id="policyLocked"') || !/id="policyLocked"[^>]*>[^<]*destination links tier[^<]*<a href="mailto:sales@fightghostjobs\.com/.test(h)) add("S70", htmlF, "the not-on-the-tier notice must name the destination links tier and carry the sales address");
      for (const id of ["policyUrl", "savePolicyBtn", "policyHint", "policyStored"]) if (!h.includes('id="' + id + '"')) add("S70", htmlF, "edit.html must keep #" + id);
      // prompt BC (October 10, 2026): a stored link is one ROW (Check link, Edit, Remove) in the same section; the old Remove policy link button is gone (the row's Remove does it)
      for (const id of ["policyPanel", "policyPanelHint", "policyList", "policyAlert"]) if (h.split('id="' + id + '"').length !== 2) add("S70", htmlF, "edit.html must carry #" + id + " exactly once");
      if (/id="removePolicyBtn"/.test(h)) add("S70", htmlF, "the stored policy link is removed from its row; there is no separate Remove policy link button");
    }
    // who may write it: only the editor calls the save; no other script names the policy link's save or its kind in a request
    for (const f of js) {
      const r = rel(f), t = stripJsComments(read(f));
      if (/setPolicyLink/.test(t) && r !== "js/api.js" && r !== "js/pages/edit.js" && r !== "js/policy-panel.js" && r !== "js/pages/register.js") add("S70", f, "only the editor (js/pages/edit.js, and its policy row js/policy-panel.js) and the register page (right after the opening is added, prompt BJ) may save the AI and hiring policy link");
      if (/kind:\s*"policy"/.test(t) && !["js/api.js", "js/pages/search.js"].includes(r)) add("S70", f, "only js/api.js (the save) and js/pages/search.js (the candidate's line) name the policy kind in a request or a row");
    }
    if (fs.existsSync(editF) && !stripJsComments(read(editF)).includes('$("#policyUrl").addEventListener("keydown"')) add("S70", editF, "Enter in the policy box must save the policy link, never the whole opening");
    if (fs.existsSync(srchF)) {
      const s = stripJsComments(read(srchF));
      if (!s.includes("applicationLinks(r.data.links)") || !s.includes("candidatePolicyLine(r.data.links)")) add("S70", srchF, "the details window takes its apply rows from applicationLinks and its policy line from candidatePolicyLine");
      if (/r\.data\.links\.(length|map|forEach)|for \(const l of r\.data\.links\)/.test(s)) add("S70", srchF, "the details window must not use the raw links list for the apply rows, the empty note or the report link");
    }
    if (fs.existsSync(formF) && !stripJsComments(read(formF)).includes('filter((x) => x.kind === undefined || x.kind === "apply")')) add("S70", formF, "the application links panel takes only application links (applyLinks must leave the policy link and the firms out)");
    if (fs.existsSync(cmF) && !stripJsComments(read(cmF)).includes('filter((l) => !(l && l.kind === "policy"))')) add("S70", cmF, "the wrong-link report's links must leave the policy link out (detailLinks)");
    if (fs.existsSync(apiF)) {
      const a = stripJsComments(read(apiF));
      if (!a.includes('kind: "policy", links: url === null ? [] : [{ url }]')) add("S70", apiF, "the policy link is saved as exactly { posting_id, kind policy, links: [] or [{ url }] }");
    }
    for (const need of ['path.join(here, "policy-link.unit.test.js")', 'path.join(here, "policy-link.test.js")']) if (fs.existsSync(runF) && !read(runF).includes(need)) add("S70", runF, "the policy link's tests must run in the suite: " + need);
    for (const t of ["policy-link.unit.test.js", "policy-link.test.js"]) if (!fs.existsSync(P("tests", t))) add("S70", P("tests", t), "the policy link's test must exist");
  }

  // S76 (2026-10-11, prompt BH): the place an employer TYPES for an opening outside the US list. A label only: nothing searches, sorts or filters by it; one or the other (a list place or a typed place, never both).
  // Pinned: the choice and the box on both forms (the exact choice words, 100 characters); the rule lives in js/place-text.js and REUSES the AI notes checks (characters and web addresses), adds the email and markup refusals and the
  // limit of 100; an edit sends the text with the list cleared and the list with the text cleared; a create sends the text and no list place; the form hides the list while the choice is on; the typed place is part of what is
  // "not saved yet"; My openings shows it through js/place.js; the two scripts that may name the field are place.js and place-text.js (S68); the two tests run in the suite.
  {
    const P = (...a) => path.join(root, ...a);
    const body = (f) => (fs.existsSync(f) ? stripJsComments(read(f)) : "");
    for (const rel of ["register.html", "edit.html"]) {
      const f = P(rel);
      if (!fs.existsSync(f)) continue;
      const h = read(f);
      for (const id of ["locCatalog", "locOutside", "locTyped", "loctext", "loctextHint"]) if (!h.includes('id="' + id + '"')) add("S76", f, "the location area is missing #" + id);
      if (!/<label class="check-row" for="locOutside"[^>]*><input id="locOutside" type="checkbox"> A place outside the US or not in the list<\/label>/.test(h)) add("S76", f, 'the choice must read "A place outside the US or not in the list"');
      if (!/<input id="loctext" type="text" maxlength="100" /.test(h)) add("S76", f, "the typed place box holds at most 100 characters");
      if (!h.includes('data-error-for="loctext"')) add("S76", f, "the typed place box needs its error line");
      if (/source_location_text/.test(h)) add("S76", f, "no page names the stored field (js/place-text.js does)");
    }
    const ptF = P("js", "place-text.js"), pcF = P("js", "place-choice.js"), efF = P("js", "edit-form.js"), rfF = P("js", "register-form.js"), edF = P("js", "pages", "edit.js"), rgF = P("js", "pages", "register.js"), dbF = P("js", "pages", "dashboard.js"), dsF = P("js", "dirty-state.js"), runF = P("tests", "run-all.js");
    if (fs.existsSync(ptF)) {
      const s = body(ptF);
      for (const [needle, why] of [['export const PLACE_FIELD = "source_location_text";', "the request field is source_location_text"], ["export const MAX_PLACE_TEXT = 100;", "the limit is 100 characters"],
        ['import { hasBadChars, looksLikeWebAddress } from "./ai-notes.js";', "the characters and web address checks are the AI notes' own"], ['CHOICE: "A place outside the US or not in the list",', "the choice words"],
        ['if (s.includes("@")) return PLACE_WORDS.EMAIL;', "an email address is refused"], ["if (/[<>]/.test(s)) return PLACE_WORDS.MARKUP;", "markup brackets are refused"], ["if (hasBadChars(s)) return PLACE_WORDS.CHARS;", "line breaks and control characters are refused"],
        ["if (looksLikeWebAddress(s)) return PLACE_WORDS.LINK;", "web addresses are refused"], ['.replace(/ {2,}/g, " ").replace(/^ +| +$/g, "")', "spaces are collapsed and trimmed (a line break is not)"]]) if (!s.includes(needle)) add("S76", ptF, "js/place-text.js: " + why);
      if (/innerHTML|insertAdjacentHTML|document\./.test(s)) add("S76", ptF, "js/place-text.js is pure: no DOM, no markup");
    }
    if (fs.existsSync(pcF)) {
      const s = body(pcF);
      if (!s.includes("typed.hidden = !choice.checked; catalog.hidden = choice.checked;")) add("S76", pcF, "with the choice on the list is hidden and the box shown");
      if (/innerHTML|insertAdjacentHTML/.test(s)) add("S76", pcF, "no markup from data");
    }
    if (fs.existsSync(efF)) {
      const s = body(efF);
      if (!s.includes("if (typed !== wasTyped) ch[PLACE_FIELD] = typed;")) add("S76", efF, "an edit sends the typed place when it changed (null clears it)");
      if (!s.includes('export const LOCATION_GROUP = ["location_ids", "is_remote", "locations_attested", PLACE_FIELD];')) add("S76", efF, "a change of the typed place is a location change (a new req number on a live opening)");
      if (!s.includes("if (PLACE_FIELD in changed) { const p = placeTextProblem(changed[PLACE_FIELD]); if (p) e.loctext = p; }")) add("S76", efF, "the typed place is judged when it changed, by the one rule");
      if (!s.includes("const typed = v.outside === true ? collapsePlaceText(v.locText) : null")) add("S76", efF, "the typed place is the collapsed text of the box while the choice is on, and nothing otherwise");
    }
    if (fs.existsSync(rfF)) {
      const s = body(rfF);
      if (!s.includes("if (v.outside === true) body[PLACE_FIELD] = collapsePlaceText(v.locText);")) add("S76", rfF, "a create sends the typed place");
      if (!/if \(v\.outside === true\) body\[PLACE_FIELD\] = collapsePlaceText\(v\.locText\);\s*else \{\s*if \(chosen\.length\) body\.location_ids/.test(s)) add("S76", rfF, "a create sends the list places only when no typed place is chosen");
      if (!s.includes("if (v.outside === true) { const p = placeTextProblem(collapsePlaceText(v.locText)); if (p) e.loctext = p; }")) add("S76", rfF, "the typed place is judged by the one rule");
    }
    for (const f of [edF, rgF]) if (fs.existsSync(f)) {
      const s = body(f);
      if (!s.includes("locEntries: place.outside() ? [] : picker.get().entries, attested: place.outside() ? false : picker.get().attested, outside: place.outside(), locText: place.text(),")) add("S76", f, "the form's answer carries no list place while the typed place is chosen");
      if (!/mountPlaceChoice\(/.test(s)) add("S76", f, "the page mounts the place choice");
    }
    if (fs.existsSync(rgF)) {
      const s = body(rgF);
      if (!s.includes("state.placeProblem = values.outside === true && storedPlaceText(created.data) !== collapsePlaceText(values.locText) ? PLACE_WORDS.NOT_SAVED : null;")) add("S76", rgF, "a create answered without the typed place is told to the person (an older server drops it silently)");
      if (!s.includes('alertBox("error", state.placeProblem)')) add("S76", rgF, "the result shows that the place was not saved");
    }
    if (fs.existsSync(edF)) {
      const s = body(edF);
      if (!s.includes('place.set((p.location_ids || []).length === 0 ? storedPlaceText(p) : "");')) add("S76", edF, "an opening's typed place is put in the box when the page loads");
    }
    if (fs.existsSync(dbF)) {
      const s = body(dbF);
      if (!s.includes("placeNodes(h, p, { note: false, hideNone: true })")) add("S76", dbF,"My openings shows the place through js/place.js (the typed place when there is no list place)");
      if (/locationLine\(/.test(s)) add("S76", dbF, "My openings never calls locationLine directly");
    }
    if (fs.existsSync(dsF)) {
      // the edit page's own snapshot (snapshotOf); the register page's snapshot (registerSnapshot, prompt BJ) repeats the line, so the pin is read from snapshotOf alone
      const ds = body(dsF), i0 = ds.indexOf("export function snapshotOf("), i1 = ds.indexOf("\nexport ", i0 + 1);
      if (i0 < 0 || !ds.slice(i0, i1 < 0 ? ds.length : i1).includes('place: v.outside === true ? trim(v.locText) : null,')) add("S76", dsF, "the typed place is part of the unsaved snapshot");
    }
    if (fs.existsSync(runF)) {
      const r = read(runF);
      for (const n of ["place-text.unit.test.js", "place-text.test.js"]) if (!r.includes('"' + n + '"')) add("S76", runF, n + " is not in the suite");
    }
  }
  // S77 (2026-10-11, prompt BJ): the register page ("Add an opening") and one place line. Pinned: the AI and hiring policy link row is on the page (its words, hidden until the plan is known) and is saved by the page
  // right AFTER the opening exists, through the one api call, never with the create; every address is judged as typed with the edit page's rule (addressProblem) and all problems of all sections are said in ONE list before
  // anything is created; Add opening and Save draft are the last two controls of the form, after every section, with no Cancel; the unsaved bar, Discard and the leave question are the edit page's own component
  // (js/unsaved-guard.js) with the register page's own summary; the typed place box says its limit and counts on both forms; every screen draws the place through js/place.js placeNodes (no page calls locationLine) and
  // the history of an opening goes through plainChangeNote (no stored note with a function or a column name is drawn). The two new tests run in the suite.
  {
    const P = (...a) => path.join(root, ...a);
    const body = (f) => (fs.existsSync(f) ? stripJsComments(read(f)) : "");
    const regH = P("register.html"), editH = P("edit.html"), rgF = P("js", "pages", "register.js"), rfF = P("js", "register-form.js"), lrF = P("js", "link-rows.js"), ugF = P("js", "unsaved-guard.js"), dsF = P("js", "dirty-state.js");
    const pcF = P("js", "place-choice.js"), ptF = P("js", "place-text.js"), efF = P("js", "edit-form.js"), edF = P("js", "pages", "edit.js"), runF = P("tests", "run-all.js");
    if (fs.existsSync(regH)) {
      const h = read(regH);
      for (const id of ["policyRow", "policyLabel", "policyHint", "policyLocked", "policyNote", "policyForm", "policyUrl", "policyError", "unsavedBar", "unsavedHead", "unsavedDetail", "unsavedSave", "unsavedDiscard", "unsavedLive", "leaveOverlay", "leaveSave", "leaveDiscard", "leaveStay", "loctextCount", "loctextLimit"]) {
        if (h.split('id="' + id + '"').length !== 2) add("S77", regH, "register.html must carry #" + id + " exactly once");
      }
      if (!h.includes(">Link to your AI and hiring policy (optional)</label>")) add("S77", regH, "the policy box needs its visible label: Link to your AI and hiring policy (optional)");
      if (!/id="policyHint"[^>]*>[^<]*It is saved right after the opening is added\./.test(h)) add("S77", regH, "the policy hint must say that it is saved right after the opening is added");
      const iRow = h.indexOf('id="policyRow"'), iRec = h.indexOf('id="recruiterToggle"'), iLinks = h.indexOf('id="linksSection"'), iBtn = h.indexOf('id="registerBtn"'), iDraft = h.indexOf('id="draftBtn"'), iEnd = h.indexOf("</form>");
      if (!(iRow >= 0 && iRow < iRec)) add("S77", regH, "the policy box sits above the recruiter switch");
      if (!(iBtn > iLinks && iBtn > iRow && iBtn > iRec && iDraft > iBtn && iEnd > iDraft)) add("S77", regH, "Add opening and Save draft must be the last controls of the form, after every section");
      const tail = iEnd > iDraft ? h.slice(iDraft, iEnd) : "";
      if (/<button|<a |<input|<select|<textarea/.test(tail.replace(/<button type="button" id="draftBtn"[^>]*>Save draft<\/button>/, ""))) add("S77", regH, "nothing may follow Save draft inside the form");
      const form = iEnd > 0 ? h.slice(h.indexOf('<form id="form"'), iEnd) : "";
      if (/>\s*Cancel\s*</i.test(form)) add("S77", regH, "the register form has no Cancel button");
      if (!h.includes('>Add opening</button>') || !h.includes('>Save draft</button>')) add("S77", regH, "the buttons keep their words: Add opening and Save draft");
      if (!/<input id="loctext" type="text" maxlength="100" /.test(h)) add("S77", regH, "the typed place box holds at most 100 characters");
    }
    if (fs.existsSync(editH)) { const h = read(editH); for (const id of ["loctextCount", "loctextLimit", "placeLine"]) if (h.split('id="' + id + '"').length !== 2) add("S77", editH, "edit.html must carry #" + id + " exactly once"); }
    for (const f of [regH, editH]) if (fs.existsSync(f) && !read(f).includes('<div id="loctextHint" class="field-hint">Up to 100 characters. ')) add("S77", f, "the hint under the typed place box starts with its limit: Up to 100 characters.");
    if (fs.existsSync(rgF)) {
      const s = body(rgF);
      if (!s.includes("mountLinkRowsById({ checkAddress: addressProblem })") || !s.includes("mountFirmRowsById({ checkAddress: addressProblem })")) add("S77", rgF, "the register page's rows judge each address as typed (checkAddress: addressProblem, the edit page's rule)");
      if (!s.includes("const lp = linkProblems({ links: lc, firms: fc, policy: pc });")) add("S77", rgF, "every section is judged together before anything is created (linkProblems)");
      const iCreate = s.indexOf("api.createPosting("), iPolicy = s.indexOf("savePolicy(pc)"), iLinks = s.indexOf("saveLinks(lc)"), iFirms = s.indexOf("saveFirms(fc)");
      if (!(iCreate > 0 && iLinks > iCreate && iFirms > iLinks && iPolicy > iFirms)) add("S77", rgF, "the policy link is saved after the opening exists, after the links and the firms");
      if (!s.includes("api.setPolicyLink(state.saved.id, pc.url)")) add("S77", rgF, "the policy link is saved with api.setPolicyLink on the created opening");
      if (!s.includes("summarize: summarizeRegister") || !s.includes("mountUnsavedGuard({")) add("S77", rgF, "the register page uses the shared unsaved component with its own summary");
      // prompt BK: a firm typed while the switch is off can no longer exist (turning it off clears the typed rows, S78), and the firms are still never saved while it is off (collectFirms takes the switch)
      if (!s.includes("const fc = state.firms ? collectFirms(state.firms.values(), state.recruiter) : none;")) add("S77", rgF, "firms are collected with the recruiter switch: they are never saved while it is off");
      if (/api\.createPosting\([^)]*policy/i.test(s)) add("S77", rgF, "the policy link is never part of the create call");
    }
    if (fs.existsSync(rfF)) {
      const s = body(rfF);
      if (!s.includes("export function linkProblems(")) add("S77", rfF, "linkProblems (all sections in one list) must exist");
      if (!s.includes('items.push("the AI and hiring policy link (" + ')) add("S77", rfF, "the one list names the policy link");
    }
    if (fs.existsSync(lrF)) {
      const s = body(lrF);
      if (!s.includes('row.addr.addEventListener("blur", () => judge(row));')) add("S77", lrF, "an address box is judged when the person leaves it");
      if (!s.includes("if (bad) { bad.addr.focus(); return; }")) add("S77", lrF, "a row is not added while an address above is malformed");
    }
    if (fs.existsSync(ugF) && !body(ugF).includes('typeof ctx.summarize === "function" ? ctx.summarize : summarize')) add("S77", ugF, "the shared unsaved component takes the page's own summary");
    if (fs.existsSync(dsF)) {
      const s = body(dsF);
      if (!s.includes("export function registerSnapshot(") || !s.includes("export function summarizeRegister(")) add("S77", dsF, "the register page's unsaved snapshot and summary must exist");
      if (!s.includes('HEAD: "This opening is not added yet"')) add("S77", dsF, "the bar's headline is: This opening is not added yet");
    }
    if (fs.existsSync(pcF)) {
      const s = body(pcF);
      if (!s.includes("PLACE_WORDS.COUNT(input.value.length)")) add("S77", pcF, "the typed place box counts its characters");
      if (!s.includes("if (incoming.length > room) say(incoming.length > 1 ? PLACE_WORDS.CUT : PLACE_WORDS.FULL);")) add("S77", pcF, "typing or pasting past the limit says so");
    }
    if (fs.existsSync(ptF)) {
      const s = body(ptF);
      if (!s.includes('HINT: "Up to " + MAX_PLACE_TEXT + " characters. ')) add("S77", ptF, "the hint under the typed place box starts with its limit");
      if (!s.includes("MAX_PLACE_TEXT = 100;")) add("S77", ptF, "the limit of the typed place is 100 characters");
    }
    // one place line: no page draws a place without js/place.js, and no page draws a stored history note raw
    for (const rel of ["comments.js", "search.js", "dashboard.js", "edit.js"]) {
      const f = P("js", "pages", rel);
      if (!fs.existsSync(f)) continue;
      const s = body(f);
      if (/locationLine\(/.test(s)) add("S77", f, "a screen draws the place only through js/place.js placeNodes, never locationLine directly");
      if (!/placeNodes\(h, (p|row)[,)]/.test(s)) add("S77", f, "this screen must draw the place through placeNodes (one place line everywhere)");
    }
    if (fs.existsSync(edF) && !body(edF).includes("plainChangeNote(c.note)")) add("S77", edF, "the history of an opening goes through plainChangeNote (no function or column name is drawn)");
    if (fs.existsSync(efF) && !body(efF).includes("export function plainChangeNote(")) add("S77", efF, "plainChangeNote must exist");
    if (fs.existsSync(runF)) {
      const r = read(runF);
      for (const n of ["register-bj.unit.test.js", "register-bj.test.js"]) if (!r.includes('"' + n + '"')) add("S77", runF, n + " is not in the suite");
    }
  }
  // S78 (2026-10-11, prompt BK): the opening editor's ONE action area at the very bottom, and the follow-ups. Pinned: the area is after the form, the go-live card, the destination links (with the recruiter firms)
  // and the policy link, and nothing but its own buttons follows the note and the messages inside it; the main button is outside the form, reads Close until something changes, and double checks the link sections before it
  // submits (one sentence naming them); Save as draft and Publish exist for a draft only and no code path of the page sets an opening back to draft; Publish asks first, with My openings' own words; the history ends with
  // an "Added" line; typed firms are cleared when the recruiter switch goes off, with one sentence next to the switch; "Checking address(es)" shows while the checks run; the boxes that stop typing at a limit say so;
  // the button a dialog gives the cursor to shows its ring at once; the search refusal for both boxes filled clears the old results. The two new tests run in the suite.
  {
    const P = (...a) => path.join(root, ...a);
    const body = (f) => (fs.existsSync(f) ? stripJsComments(read(f)) : "");
    const editH = P("edit.html"), regH = P("register.html"), edF = P("js", "pages", "edit.js"), rgF = P("js", "pages", "register.js"), dsF = P("js", "dirty-state.js"), lhF = P("js", "limit-hint.js"), frF = P("js", "focus-ring.js");
    const cssF = P("app.css"), daF = P("js", "dashboard-actions.js"), tmF = P("js", "pages", "team.js"), seF = P("js", "pages", "search.js"), siF = P("js", "search-input.js"), runF = P("tests", "run-all.js");
    if (fs.existsSync(editH)) {
      const h = read(editH);
      const at = (s) => h.indexOf(s);
      for (const id of ["actionArea", "saveBtn", "draftSaveBtn", "publishBtn", "actionButtons", "note", "formAlert"]) if (h.split('id="' + id + '"').length !== 2) add("S78", editH, "edit.html must carry #" + id + " exactly once");
      const iForm = at('<form id="form"'), iFormEnd = at("</form>"), iSched = at('id="scheduleCard"'), iLinks = at('id="linksCard"'), iFirms = at('id="firmsPanel"'), iPolicy = at('id="policyRow"'), iArea = at('id="actionArea"'), iRo = at('id="readonlyNote"');
      if (!(iForm >= 0 && iPolicy > iForm && iPolicy < iFormEnd && iSched > iFormEnd && iLinks > iSched && iFirms > iLinks && iArea > iFirms && iRo > iArea)) add("S78", editH, "the action area must come after the form, the go-live card, the destination links with the recruiter firms and the policy link, and before the read-only note");
      const form = h.slice(iForm, iFormEnd);
      if (form.includes('id="saveBtn"') || form.includes('id="note"') || form.includes('id="formAlert"') || /Back to My openings/.test(form)) add("S78", editH, "the main button, the note and the messages are not in the form: they are in the one action area at the bottom");
      const area = iArea >= 0 && iRo > iArea ? h.slice(iArea, iRo) : "";
      if (!/<button type="button" id="saveBtn" class="btn btn-dark" data-mode="back">Back to My openings<\/button>/.test(area)) add("S78", editH, "the main button is a plain button, outside the form, that starts as Back to My openings (prompt BM: it was Close)");
      if (!/<button type="button" id="draftSaveBtn" class="btn btn-outline" hidden>Save as draft<\/button>\s*<button type="button" id="publishBtn" class="btn btn-outline" hidden>Publish<\/button>\s*<\/div>\s*<\/div>/.test(area)) add("S78", editH, "Save as draft and Publish are hidden until the page shows them, and they end the action area: nothing follows them");
      if (/Cancel|<a /.test(area)) add("S78", editH, "no Cancel and no link in the action area (the bar's Discard is the way back without saving)");
      if (/id="saveBtn"[^>]*type="submit"|type="submit"[^>]*id="saveBtn"/.test(h)) add("S78", editH, "the main button must not be a submit button of the form (Enter would then leave the page on Close)");
      for (const id of ["loctextCount", "loctextLimit"]) if (h.split('id="' + id + '"').length !== 2) add("S78", editH, "edit.html must carry #" + id);
      for (const [id, n] of [["jtitle", 200], ["req", 100], ["aiFilterNote", 300], ["aiInterviewNote", 300], ["desc", 20000]]) if (!new RegExp('id="' + id + '"[^>]*maxlength="' + n + '"').test(h)) add("S78", editH, "#" + id + " keeps its limit of " + n + " characters (the hint and the count read the box's maxlength)");
    }
    if (fs.existsSync(regH)) {
      const h = read(regH);
      for (const id of ["recruiterCleared", "waitWord"]) if (!new RegExp('id="' + id + '"[^>]*role="status"|role="status"[^>]*id="' + id + '"').test(h)) add("S78", regH, "register.html must carry #" + id + " as a polite status (role=status)");
      for (const [id, n] of [["jtitle", 200], ["req", 100], ["closeout", 300], ["aiFilterNote", 300], ["aiInterviewNote", 300], ["desc", 20000]]) if (!new RegExp('id="' + id + '"[^>]*maxlength="' + n + '"').test(h)) add("S78", regH, "#" + id + " keeps its limit of " + n + " characters (the hint and the count read the box's maxlength)");
    }
    if (fs.existsSync(edF)) {
      const s = body(edF);
      for (const [pin, why] of [
        ["saveBtn.textContent = dirty ? ACTION.SAVE : ACTION.BACK;", "the main button reads Save changes while something changed and Back to My openings while nothing has"],
        ["if (!anyUnsaved()) { guard.openDialog(() => go(\"dashboard.html\"), saveBtn); return; }", "Back to My openings goes to My openings through the leave dialog (it asks only if something turns out to be unsaved)"],
        ["  if (!linkSectionsClear()) return;\n  await submit();", "the main button double checks the link sections before it submits"],
        ["say(formAlert, \"notice\", panelsFirstText(open));", "the double check says one sentence that names the sections"],
        ["draftSaveBtn.hidden = !draft;", "Save as draft is for a draft only"],
        ["publishBtn.hidden = !(draft && actionsFor(state.orig, Date.now()).includes(\"publish\"));", "Publish is for a draft whose publish window is open (the rule of My openings)"],
        ["actionArea.hidden = !editable;", "the action area is for an opening that can be edited"],
        ["runAction(\"publish\", state.orig, {", "Publish asks first, with My openings' own dialog and words"],
        ["if (added !== null) ul.append(", "the history ends with the Added line"],
        ["mountLimitHint({ input: $(\"#jtitle\") })", "the job title box says its limit"],
      ]) if (!s.includes(pin)) add("S78", edF, "edit.js: " + why);
      if (/status\s*:\s*["']draft["']|setToDraft|backToDraft/.test(s)) add("S78", edF, "no code path of the editor sets an opening back to draft");
      if (/api\.(unpublish|setDraft|revertToDraft)/.test(s)) add("S78", edF, "the editor calls no API that sets an opening back to draft");
    }
    if (fs.existsSync(rgF)) {
      const s = body(rgF);
      for (const [pin, why] of [
        ["if (!state[key] && state.firms && rowsTyped(state.firms.values())) {\n        state.firms.reset(); say($(\"#firmsAlert\"), \"error\", \"\");", "turning the recruiter switch off clears the typed firm rows"],
        ["const RECRUITER_CLEARED = \"The firm names you typed were cleared because Third-party recruiter involved is off.\";", "the sentence next to the switch"],
        ["const WAIT_ONE = \"Checking address\", WAIT_MANY = \"Checking addresses\";", "the wait words"],
        ["if (addresses > 0) { waitWord.textContent = addresses === 1 ? WAIT_ONE : WAIT_MANY; waitWord.hidden = false; }", "the wait word shows while the addresses are checked"],
        ["waitWord.textContent = \"\"; waitWord.hidden = true;", "the wait word is taken away when the checks are over"],
        ["const limitHints = [\"#jtitle\", \"#req\", \"#closeout\", \"#aiFilterNote\", \"#aiInterviewNote\", \"#desc\"].map((sel) => mountLimitHint({ input: $(sel) }));", "the six boxes say their limit"],
      ]) if (!s.includes(pin)) add("S78", rgF, "register.js: " + why);
    }
    if (fs.existsSync(dsF)) {
      const s = body(dsF);
      if (!s.includes('export const ACTION = { SAVE: "Save changes", BACK: "Back to My openings", SAVE_DRAFT: "Save as draft", PUBLISH: "Publish" };')) add("S78", dsF, "the action area's words");
      if (!s.includes("These sections have something that is not saved: ") || !s.includes('" section has something that is not saved. Use the button in that section to save it first, then press Save changes."')) add("S78", dsF, "the double check's sentences");
    }
    if (fs.existsSync(lhF)) {
      const s = body(lhF);
      for (const pin of ['HINT: "Up to " + fmt(max) + " characters."', 'FULL: "That is all it can hold: " + fmt(max) + " characters."', 'CUT: "What you pasted was longer than " + fmt(max) + " characters, so it was cut at " + fmt(max) + "."', "Number(input.getAttribute(\"maxlength\"))"]) if (!s.includes(pin)) add("S78", lhF, "limit-hint.js keeps: " + pin.slice(0, 70));
      if (/innerHTML|insertAdjacentHTML/.test(s)) add("S78", lhF, "no markup is made from text");
    } else add("S78", lhF, "js/limit-hint.js must exist");
    if (fs.existsSync(frF)) { if (!body(frF).includes('el.classList.add("focus-ring");')) add("S78", frF, "the ring class is put on the button the dialog chose"); } else add("S78", frF, "js/focus-ring.js must exist");
    if (fs.existsSync(cssF) && !read(cssF).includes("button.focus-ring,a.focus-ring{outline:2px solid var(--ember);outline-offset:2px}")) add("S78", cssF, "the .focus-ring rule: the same ring as :focus-visible (2px, ember, offset 2px)");
    if (fs.existsSync(daF) && !body(daF).includes("focusWithRing(focusable(form)[0] || confirm);")) add("S78", daF, "the My openings dialog's button shows its ring at once");
    if (fs.existsSync(tmF) && !body(tmF).includes("focusWithRing(confirm);")) add("S78", tmF, "the roster dialog's button shows its ring at once");
    if (fs.existsSync(siF)) {
      const s = body(siF);
      if (!s.includes('focus: "req", clearResults: true };')) add("S78", siF, "the both-boxes-filled refusal asks the page to clear the old results");
      if ((s.match(/clearResults: true/g) || []).length !== 1) add("S78", siF, "only that one refusal clears the old results");
    }
    if (fs.existsSync(seF) && !body(seF).includes("if (q.clearResults) { clear(resultsEl); countEl.hidden = true; hideRecap(); lastSearch = null; status.clear(); }")) add("S78", seF, "the search page clears the list, its count, the recap and the status on that refusal");
    if (fs.existsSync(runF)) {
      const r = read(runF);
      for (const n of ["register-bk.unit.test.js", "register-bk.test.js"]) if (!r.includes('"' + n + '"')) add("S78", runF, n + " is not in the suite");
    }
  }
  // S79 (2026-10-11, prompt BL): My openings fits its card and an employer never reads "as provided by the employer". Pinned: the page's width cap (1800 pixels, so the card follows the window), the class that scopes
  // the table rules to this table, the Title column's minimum, the fixed width of every note in the Actions cell, the note as ONE block, and the place line of the two employer-only screens drawn without the
  // note (the candidate screens are pinned by S68 and keep it). The browser test runs in the suite.
  {
    const P = (...a) => path.join(root, ...a);
    const body = (f) => (fs.existsSync(f) ? stripJsComments(read(f)) : "");
    const dashH = P("dashboard.html"), dashJ = P("js", "pages", "dashboard.js"), editJ = P("js", "pages", "edit.js"), plJ = P("js", "place.js"), cssF = P("app.css"), srJ = P("js", "pages", "search.js"), cmJ = P("js", "pages", "comments.js"), runF = P("tests", "run-all.js");
    if (fs.existsSync(dashH)) {
      const h = read(dashH);
      if (!/<div class="pg" style="max-width:1800px;margin:0 auto;/.test(h)) add("S79", dashH, "the My openings page is capped at 1800 pixels, not 1440: the card follows the window");
      if (!h.includes('class="dash-table rtable my-openings" role="table"')) add("S79", dashH, "the My openings table carries the class my-openings (the layout rules are scoped to it)");
    }
    if (fs.existsSync(cssF)) {
      const c = read(cssF);
      for (const [pin, why] of [
        ['.my-openings thead th:first-child,.my-openings td[data-label="Title"]{min-width:11rem}', "the Title column keeps a readable minimum"],
        ['.my-openings td[data-label="Title"]{overflow-wrap:anywhere}', "a long title or place line wraps inside its column and never pushes another off the page"],
        [".my-openings .act-note{max-width:24ch;white-space:normal;overflow-wrap:break-word}", "every note in the Actions cell wraps at a fixed width"],
        ['.my-openings td[data-label="Actions"] .row-action{white-space:nowrap}', "an action word stays on one line"],
      ]) if (!c.includes(pin)) add("S79", cssF, "app.css: " + why);
      if (!/@media \(min-width:641px\)\{\s*\.my-openings thead th:first-child/.test(c)) add("S79", cssF, "the My openings table rules apply above the phone width only (the phone layout is the card list of S48)");
    }
    if (fs.existsSync(dashJ)) {
      const s = body(dashJ);
      if (!s.includes("placeNodes(h, p, { note: false, hideNone: true })")) add("S79", dashJ, "My openings draws the place without the note (the employer typed it), and with nothing when nothing is set (prompt BN)");
      if (!s.includes('h("div", { class: "row-note act-note" },')) add("S79", dashJ, "the expired draft's note is ONE block (class act-note), not three pieces on a line");
      if (/data-label": "Actions", style/.test(s)) add("S79", dashJ, "the Actions cell has no inline style (it must not be set to nowrap)");
    }
    if (fs.existsSync(editJ) && !body(editJ).includes("placeNodes(h, p, { note: false, hideNone: true })")) add("S79", editJ, "the opening editor draws the place without the note, and with nothing when nothing is set (prompt BN)");
    if (fs.existsSync(plJ) && !body(plJ).includes("if (p.note && !(opts && opts.note === false)) out.push(")) add("S79", plJ, "placeNodes leaves the note off only when the caller says so (the default shows it)");
    for (const f of [srJ, cmJ]) if (fs.existsSync(f) && /note:\s*false/.test(body(f))) add("S79", f, "a screen a candidate sees keeps the note: no note: false here");
    if (fs.existsSync(runF) && !read(runF).includes('"my-openings.test.js"')) add("S79", runF, "my-openings.test.js is not in the suite");
  }
  // S80 (2026-10-11, prompt BM): the opening editor's note box belongs to a CHANGE. Pinned: the block (#noteBlock) is taken out of the page at load, put back only while the MAIN FORM differs from what is saved (a link
  // section alone does not bring it), taken out again with its text, rule sentence and error cleared; the cursor is never moved by it; the main button with nothing changed reads Back to My openings and no button of
  // the bottom area is called Close. The browser test runs in the suite.
  {
    const P = (...a) => path.join(root, ...a);
    const body = (f) => (fs.existsSync(f) ? stripJsComments(read(f)) : "");
    const editH = P("edit.html"), edF = P("js", "pages", "edit.js"), dsF = P("js", "dirty-state.js"), runF = P("tests", "run-all.js");
    if (fs.existsSync(editH)) {
      const h = read(editH);
      if (h.split('id="noteBlock"').length !== 2) add("S80", editH, "edit.html carries #noteBlock exactly once (the note's label, field, rule sentence, error and limit hint)");
      const iArea = h.indexOf('id="actionArea"'), iBlock = h.indexOf('id="noteBlock"'), iBtn = h.indexOf('id="saveBtn"');
      if (!(iArea >= 0 && iBlock > iArea && iBtn > iBlock)) add("S80", editH, "the note block is inside the action area, before the buttons");
      const block = iBlock >= 0 ? h.slice(iBlock, iBtn) : "";
      if (!block.includes('id="note"') || !block.includes('id="noteLabel"') || !block.includes('id="noteNeeded"') || !block.includes('data-error-for="note"') || !block.includes("One line, 500 characters at most.")) add("S80", editH, "the note block holds the field, its label, its rule sentence, its error and its limit hint");
      const area = iArea >= 0 ? h.slice(iArea, h.indexOf('id="readonlyNote"')) : "";
      if (/>\s*Close\s*</.test(area)) add("S80", editH, "no button of the bottom area is called Close");
    }
    if (fs.existsSync(edF)) {
      const s = body(edF);
      for (const [pin, why] of [
        ["const noteBlock = $(\"#noteBlock\"), noteInput = $(\"#note\"), noteLabelEl = $(\"#noteLabel\"), noteNeededEl = $(\"#noteNeeded\"), noteErrEl = noteBlock.querySelector('[data-error-for=\"note\"]');\nnoteBlock.remove();", "the note block is taken out of the page at load and kept"],
        ["syncNoteBlock(editable && formUnsaved());", "the box is in the page only while the main form has a change (not for a link section alone)"],
        ["if (wanted && !inPage) actionArea.insertBefore(noteBlock, actionArea.firstChild);", "the box goes back in at the top of the bottom area, without moving the cursor"],
        ["noteInput.value = \"\"; noteInput.setAttribute(\"aria-invalid\", \"false\");", "the text is cleared when the box goes"],
        ["note: noteInput.value", "everything reads the box through the kept element"],
        ["saveBtn.textContent = dirty ? ACTION.SAVE : ACTION.BACK;", "with nothing changed the main button reads Back to My openings"],
      ]) if (!s.includes(pin)) add("S80", edF, "edit.js: " + why);
      if (/\$\("#note"\)/.test(s.replace(/const noteBlock = [^\n]*\n/, ""))) add("S80", edF, "edit.js reads the note box only through noteInput (a query by id finds nothing while the box is out of the page)");
      if (/ACTION\.CLOSE|"Close"/.test(s)) add("S80", edF, "edit.js has no Close button word");
    }
    if (fs.existsSync(dsF) && !body(dsF).includes('BACK: "Back to My openings"')) add("S80", dsF, "the main button's word is Back to My openings");
    if (fs.existsSync(runF) && !read(runF).includes('"note-box.test.js"')) add("S80", runF, "note-box.test.js is not in the suite");
  }
  // S81 (2026-10-11, prompt BN): My openings tidied, an empty place shown as nothing on the employer's two screens, a count under the note box, and a sentence that describes a condition is shown only while it is
  // true. Pinned: the action words have a gap on their right and no left margin (a wrapped word is not indented), a date and its time are no-wrap pieces, the wide-window rule that lets the Actions, Closes, Added,
  // Opening ID and Comments columns take what their words need, the expired-draft note's own width; placeNodes leaves the words out only when the caller passes hideNone and only for an opening with nothing set,
  // and ONLY My openings and the opening editor pass it (a candidate screen never does); the editor's double check sentence is marked and re-checked on every refresh; the note box has its count. The browser
  // test (follow-up-bn.test.js, with note-box.test.js) runs in the suite.
  {
    const P = (...a) => path.join(root, ...a);
    const body = (f) => (fs.existsSync(f) ? stripJsComments(read(f)) : "");
    const cssF = P("app.css"), dashJ = P("js", "pages", "dashboard.js"), editJ = P("js", "pages", "edit.js"), plJ = P("js", "place.js"), runF = P("tests", "run-all.js");
    if (fs.existsSync(cssF)) {
      const c = read(cssF);
      for (const [pin, why] of [
        ['.my-openings td[data-label="Actions"] .row-action{margin:0 14px 0 0}', "the action words keep a gap on their right and no left margin (a wrapped word is not indented)"],
        ['.my-openings td[data-label="Actions"] .row-action:last-child{margin-right:0}', "the last action word has no gap after it"],
        [".my-openings .nb{white-space:nowrap}", "a date and its time are no-wrap pieces (a line breaks only between them)"],
        ['.my-openings td[data-label="Actions"],.my-openings td[data-label="Closes"],.my-openings td[data-label="Opening ID"],.my-openings td[data-label="Comments"],.my-openings td[data-label="Status"]{width:1%;white-space:nowrap}', "the five columns take what their words need (prompt BP: drawn at the roomiest, fitted by the page; prompt BR: Status joins them so its pill stays one line)"],
        [".my-openings .act-note{min-width:36ch}", "the expired-draft note keeps a block about 36 characters wide while it fits"],
      ]) if (!c.includes(pin)) add("S81", cssF, "app.css: " + why);
      if (!/@media \(min-width:641px\)\{\s*\.my-openings thead th,\.my-openings td\{padding-left:8px;padding-right:8px\}/.test(c)) add("S81", cssF, "the tidy table rules apply above the phone width only (the phone layout is the card list of S48)");
      if (!/@media \(min-width:641px\)\{\s*\.my-openings td\[data-label="Actions"\],/.test(c)) add("S81", cssF, "the roomiest-layout rule applies above the phone width only (prompt BP)");
    }
    if (fs.existsSync(dashJ)) {
      const s = body(dashJ);
      for (const [pin, why] of [
        ['return h("span", { class: "dt" }, ...out);', "the pieces of a date sit in ONE wrapper (a phone card's cell is a grid: each direct child is an item)"],
        ["dateBits(closesCell(p))", "the Closes value is drawn in no-wrap pieces"],
        ["place.length ? h(\"div\"", "the place line is left out when there is no place to show (no empty block)"],
      ]) if (!s.includes(pin)) add("S81", dashJ, "dashboard.js: " + why);
    }
    if (fs.existsSync(plJ)) {
      const s = body(plJ);
      if (!s.includes("if (!p.stated && opts && opts.hideNone === true) return [];")) add("S81", plJ, "placeNodes returns nothing only for an opening with nothing set, and only when the caller passes hideNone");
    }
    // the two employer-only screens are the ONLY files that pass hideNone
    for (const dir of [P("js"), P("js", "pages")]) {
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith(".js")) continue;
        const file = path.join(dir, f), isOk = file === dashJ || file === editJ || file === plJ;
        if (!isOk && /hideNone/.test(body(file))) add("S81", file, "only My openings and the opening editor may pass hideNone (a candidate screen keeps \"Location not stated\")");
      }
    }
    if (fs.existsSync(editJ)) {
      const s = body(editJ);
      for (const [pin, why] of [
        ["const noteLimit = mountLimitHint({ input: noteInput, hint: false });", "the note box has its count (its own line of words stays, so no second hint line)"],
        ["say(formAlert, \"notice\", panelsFirstText(open));\n  formAlert.setAttribute(\"data-live-sentence\", \"panels\");", "the double check sentence is marked as a live sentence"],
        ["  syncLiveSentence();\n  syncActions();", "every refresh re-checks the double check sentence"],
        ["text = panelsFirstText(open);", "the live sentence is re-worded from what the sections hold now"],
        ["noteInput.addEventListener(\"input\",", "the error under the note box goes when a note is typed"],
      ]) if (!s.includes(pin)) add("S81", editJ, "edit.js: " + why);
      if (!s.includes("pl.hidden = placeKids.length === 0;")) add("S81", editJ, "edit.js: the place line (and its label) is hidden when nothing is set");
    }
    if (fs.existsSync(runF) && !read(runF).includes('"follow-up-bn.test.js"')) add("S81", runF, "follow-up-bn.test.js is not in the suite");
  }
  // S82 (2026-10-11, prompt BP): My openings reworked. Pinned: no Applicant cap column or cell (the editor's cap box stays: S-rules of the edit page), no Added column (the day it was added is a line under the title), the
  // Sort by box between the search box and the table (a native select with its label), the headings drawn by the page (the Status column comes and goes), ONE constant for the flag and the Expiring pill (7 days),
  // the pills in order, the sort words, the flag drawn in words with a dark colour whose contrast on the white card is at least 4.5 to 1, the live sentence for a changed sort, the table fitted to the card by asking the
  // browser (fitTable), and the browser test (my-openings-bp.test.js) in the suite.
  {
    const P = (...a) => path.join(root, ...a);
    const body = (f) => (fs.existsSync(f) ? stripJsComments(read(f)) : "");
    const dashH = P("dashboard.html"), dashJ = P("js", "pages", "dashboard.js"), modJ = P("js", "dashboard-model.js"), cssF = P("app.css"), runF = P("tests", "run-all.js");
    if (fs.existsSync(dashH)) {
      const h = read(dashH);
      if (/Applicant cap|sortHead|sortArrow/.test(h)) add("S82", dashH, "My openings has no Applicant cap column and no Added arrow (the sort box replaced it)");
      const iText = h.indexOf('id="textFilter"'), iSort = h.indexOf('id="sortBox"'), iCard = h.indexOf('class="card flush"');
      if (h.split('id="sortBox"').length !== 2 || !(iText >= 0 && iSort > iText && iCard > iSort)) add("S82", dashH, "the Sort by box comes after the search box and before the table (the Tab order)");
      if (!h.includes('<label for="sortBox">Sort by</label><select id="sortBox"></select>')) add("S82", dashH, "the sort box is a native select with the visible label Sort by");
      if (!h.includes('id="headRow"')) add("S82", dashH, "the table headings are drawn by the page into #headRow");
    }
    if (fs.existsSync(modJ)) {
      const s = body(modJ);
      if (s.split("EXPIRY_FLAG_DAYS = ").length !== 2 || !s.includes("export const EXPIRY_FLAG_DAYS = 7;")) add("S82", modJ, "the flag and the Expiring pill have ONE constant, EXPIRY_FLAG_DAYS = 7, assigned once");
      if (!s.includes("left > 0 && left <= EXPIRY_FLAG_DAYS * DAY_MS ? left : null")) add("S82", modJ, "the flag window is read from the one constant");
      if (!s.includes('["closing", "Closing soon"], ["expiring", "Expiring"], ["paused", "Paused"]')) add("S82", modJ, "the pills are in order: All, Live, Closing soon, Expiring, Paused, Scheduled, Draft, Closed");
      for (const w of ["Added, newest first", "Added, oldest first", "Closes, soonest first", "Closes, furthest first", "Title, A to Z", "Title, Z to A"]) if (!s.includes('"' + w + '"')) add("S82", modJ, "the sort option '" + w + "' is missing");
      if (!s.includes("SAMPLE_ROWS.filter((r) => matchesFilter(r, filterKey, SAMPLE_NOW))")) add("S82", modJ, "which views mix statuses is worked out from matchesFilter itself");
      if (/capCell|Applicant cap|No cap set/.test(s)) add("S82", modJ, "the model has no cap cell");
    }
    if (fs.existsSync(dashJ)) {
      const s = body(dashJ);
      if (/capCell|Applicant cap|No cap set|postedCell|sortByPosted/.test(s)) add("S82", dashJ, "My openings has no cap cell, no posted cell and no old Added sort");
      for (const [pin, why] of [
        ["showsStatusColumn(state.filter)", "the Status column follows the chosen pill"],
        ["h(\"div\", { class: \"row-flag\", \"data-part\": \"flag\" }, flag)", "the flag is drawn as words under the date"],
        ["state.announce = SORT_ANNOUNCE(item[1]);", "a changed sort is announced"],
        ["(state.announce ? state.announce + \". \" : \"\") + count", "the announcement goes into the one live region"],
        ["if (state.sortBoxStatus !== showStatus) {", "the sort box keeps its element (and its focus) when the table is drawn again"],
        ["for (const level of [\"\", \"snug\", \"wrap-status\", \"tight\"]) {", "the table is fitted to the card by asking the browser (prompt BR: the Status pills may wrap, as one box each, before any date does)"],
        ["h(\"div\", { class: \"row-sub\", \"data-part\": \"added\" }, addedCell(p))", "the day it was added is a line under the title"],
      ]) if (!s.includes(pin)) add("S82", dashJ, "dashboard.js: " + why);
    }
    if (fs.existsSync(cssF)) {
      const c = read(cssF), m = /\.row-flag\{[^}]*color:(#[0-9A-Fa-f]{6})/.exec(c);
      if (!m) add("S82", cssF, "the flag has a colour (.row-flag)");
      else {
        const lum = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
        const ratio = (1 + 0.05) / (lum(m[1]) + 0.05);
        if (ratio < 4.5) add("S82", cssF, "the flag's colour " + m[1] + " has a contrast of " + ratio.toFixed(2) + " to 1 on the white card (at least 4.5)");
      }
      for (const pin of [".my-openings.snug .act-note{min-width:0}", ".my-openings.tight td[data-label=\"Actions\"]", ".sort-box select{"]) if (!c.includes(pin)) add("S82", cssF, "app.css lacks " + pin);
    }
    if (fs.existsSync(runF) && !read(runF).includes('"my-openings-bp.test.js"')) add("S82", runF, "my-openings-bp.test.js is not in the suite");
  }
  // S83 (2026-10-12, prompt BQ): the KIO ID. Pinned: the prefix and the short link settings live in js/config.js and nowhere else (js/kio.js imports them); the short link ships OFF; the check is the marked Luhn mod 32 block; the
  // employer's block is text with a copy button for each line (no field); the ad lines come from kio.js adLines only; the receiving page reads a path only through kioFromPath and sends on with the ID alone; the search page
  // asks no company for an ID alone and never searches by itself from the fragment; the edit page and the confirmation page draw the one block; the two browser tests are in the suite.
  {
    const cfgF = path.join(root, "js", "config.js"), kioF = path.join(root, "js", "kio.js"), blkF = path.join(root, "js", "kio-block.js"), recvF = path.join(root, "js", "kio-receive.js"), fourF = path.join(root, "404.html");
    const editF = path.join(root, "js", "pages", "edit.js"), regF = path.join(root, "js", "pages", "register.js"), srchF = path.join(root, "js", "pages", "search.js"), runF = path.join(root, "tests", "run-all.js");
    if (fs.existsSync(cfgF)) {
      const c = stripJsComments(read(cfgF));
      if (!/^export const KIO_PREFIX = "[A-Z]{3}";$/m.test(c) || (c.match(/^export const KIO_PREFIX\w* =/gm) || []).length !== 1) add("S83", cfgF, "the KIO prefix is ONE constant in js/config.js");
      if (!/^export const KIO_SHORT_LINK_LIVE = false;$/m.test(c)) add("S83", cfgF, "KIO_SHORT_LINK_LIVE ships false (it is set to true in its own commit, once knowitsopen.com really forwards)");
      if (!/^export const KIO_SHORT_LINK_HOST = "[a-z.]+";$/m.test(c)) add("S83", cfgF, "the short link host is one constant in js/config.js");
    } else add("S83", cfgF, "js/config.js is missing");
    if (fs.existsSync(kioF)) {
      const k = stripJsComments(read(kioF));
      for (const [pin, why] of [['import { KIO_PREFIX, KIO_SHORT_LINK_HOST, KIO_SHORT_LINK_LIVE } from "./config.js";', "the prefix and the short link settings come from js/config.js"], ['export const KIO_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";', "the 32 character alphabet"],
        ["const N = KIO_ALPHABET.length;", "Luhn mod N with N = the alphabet's length"], ["addend = Math.floor(addend / N) + (addend % N);", "the Luhn step"], ["return KIO_ALPHABET[(N - (lunSum(b, 2) % N)) % N];", "the check character"],
        ["if (live === true) lines.push(", "the Check this opening line only while the short link is live"], ['const lines = ["KIO ID: " + shown];', "the ID line is always there"]]) if (!k.includes(pin)) add("S83", kioF, "js/kio.js: " + why);
      if (/["']KIO["']/.test(k)) add("S83", kioF, "js/kio.js names the prefix as a literal: it comes from js/config.js");
    } else add("S83", kioF, "js/kio.js is missing");
    if (fs.existsSync(blkF)) {
      const b = stripJsComments(read(blkF));
      if (/h\("(input|textarea|select)"|contenteditable/.test(b)) add("S83", blkF, "the employer's ID block is text: no field, nothing to edit");
      for (const w of ['"Copy ID"', '"Copy link"', '"Copy these lines"']) if (!b.includes(w)) add("S83", blkF, "the block has the button " + w);
      if (!b.includes('const lines = adLines(shown, live);')) add("S83", blkF, "the ad lines come from kio.js adLines");
      if (/api\.|fetch\(|localStorage|sessionStorage/.test(b)) add("S83", blkF, "the block calls no backend and stores nothing");
    } else add("S83", blkF, "js/kio-block.js is missing");
    if (fs.existsSync(recvF)) {
      const r = stripJsComments(read(recvF));
      if (!r.includes("kioFromPath(location.pathname)") || !r.includes('location.replace("/search.html#k=" + stored);')) add("S83", recvF, "the receiving page reads the path with kioFromPath and sends on with the ID alone");
      if (/fetch\(|api\.|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/.test(r)) add("S83", recvF, "the receiving page calls nothing and stores nothing");
    } else add("S83", recvF, "js/kio-receive.js is missing");
    if (fs.existsSync(fourF)) {
      const t = read(fourF);
      if (!t.includes('<script type="module" src="/js/kio-receive.js"></script>')) add("S83", fourF, "404.html loads the receiving script");
    }
    for (const [f, why] of [[editF, "the edit page draws the ID block"], [regF, "the confirmation page draws the ID block"]]) if (fs.existsSync(f) && !read(f).includes('import { kioBlock } from "../kio-block.js";')) add("S83", f, why + " (kioBlock)");
    if (fs.existsSync(srchF)) {
      const s = read(srchF);
      if (!s.includes('const idAlone = !staffMode && q.ok && q.kind === "kio"')) add("S83", srchF, "an ID alone needs no company");
      if (!s.includes("if (!q.ok && q.message === KIO_INVALID_MESSAGE) { setFormError(q.message); queryIn.focus(); return; }")) add("S83", srchF, "an ID that fails the check is refused on the page, nothing sent");
      if (/applyFragmentPrefill\([^)]*\)[^;]*\.then|requestSubmit\(\)|runSearch\(\)[^;]*applyFragmentPrefill/.test(s.split("function setFormError")[0])) add("S83", srchF, "the fragment never runs a search");
    }
    if (fs.existsSync(runF) && !read(runF).includes('"kio-id.test.js"')) add("S83", runF, "kio-id.test.js is not in the suite");
    if (fs.existsSync(runF) && !read(runF).includes('"kio.unit.test.js"')) add("S83", runF, "kio.unit.test.js is not in the suite");
  }
  // S84 (2026-10-12, prompt BR): the day a closed or expired row ended (Closes cell and sort), the Status pill as one box, the editor's saved line taken away at the next change, and the 14 days counted from the day the
  // draft was ADDED (the server counts created_at + 14 days; saving never moves it) in every place that says so.
  {
    const modF = path.join(root, "js", "dashboard-model.js"), cssF = path.join(root, "app.css"), edF = path.join(root, "js", "pages", "edit.js"), runF = path.join(root, "tests", "run-all.js");
    if (fs.existsSync(modF)) {
      const m = read(modF);
      for (const [pin, why] of [['if (p.status === "expired") return p.expiration_date ? "Expired " + fmtDate(p.expiration_date) : "Expired";', "an expired row says Expired and the day it ran out"],
        ['typeof p.closed_at === "string" && fmtDate(p.closed_at) !== "" ? "Closed " + fmtDate(p.closed_at) : "Closed"', "a closed row says Closed and the day it was closed, or Closed alone: never its scheduled date"],
        ["if (isOver(a) !== isOver(b)) return isOver(a) ? 1 : -1;", "closed and expired rows go after every open row in both Closes directions"],
        ['export const isOver = (p) => p.status === "closed" || p.status === "expired";', "one definition of a row that is over"]]) if (!m.includes(pin)) add("S84", modF, "dashboard-model.js: " + why);
    }
    if (fs.existsSync(cssF)) {
      const c = read(cssF);
      if (!c.includes('.my-openings td[data-label="Status"] .status{display:inline-block;border-radius:14px}')) add("S84", cssF, "the Status pill is one box (inline-block with a modest radius): a wrapped run of text clips its background");
    }
    if (fs.existsSync(edF)) {
      const e = stripJsComments(read(edF));
      for (const [pin, why] of [['if (kind === "ok" || result === true) box.setAttribute("data-result", "1");', "a result line is marked"], ['if (anyUnsaved() && document.querySelector("[data-result]")) clearResults();', "the next change takes the result lines away"],
        ['window.addEventListener("pageshow", (ev) => { if (ev.persisted) clearResults(); });', "a page back from the cache has no result lines"], ['showErrors({}); say(formAlert, "error", ""); clearResults();', "Discard takes them away"]]) if (!e.includes(pin)) add("S84", edF, "edit.js: " + why);
    }
    for (const f of js) {
      const t = read(f);
      if (/(after it was saved|was saved more than 14 days ago)/.test(stripJsComments(t))) add("S84", f, "the 14 days are counted from the day the draft was added, not saved");
    }
    for (const [rel, pin] of [[["js", "pages", "dashboard.js"], "14 days after it was added. To use it, "], [["js", "pages", "edit.js"], "14 days after it was added, until "], [["js", "pages", "register.js"], "14 days after it was added, and the opening window starts when you publish."],
      [["js", "dashboard-actions.js"], "can only be published for 14 days after it was added."]]) {
      const f = path.join(root, ...rel);
      if (fs.existsSync(f) && !read(f).includes(pin)) add("S84", f, "must say the 14 days are counted from when it was added: " + pin);
    }
    if (fs.existsSync(runF) && !read(runF).includes('"br.test.js"')) add("S84", runF, "br.test.js is not in the suite");
  }
  // S75 (2026-10-10, prompt BG): version markers on every local script, style and module import (tests/stamp-versions.js). The site is served with Cache-Control: max-age=600 and no version in any file name, so a changed
  // script could be served from a cache for ten minutes. Every local reference carries ?v= and 8 hex digits of the hash of what it names (for a module, of its text and of the modules it imports), so a changed
  // file is a new address. This rule fails when a reference has no marker, or a marker that is not the current one (a changed file whose markers were not stamped again). Every other rule reads the pages and
  // scripts with the markers taken out (the read helper above), so each pin still sees the text it always saw. The stamp runs by itself before every commit (.githooks/pre-commit, package.json "stamp").
  {
    const P = (...a) => path.join(root, ...a);
    for (const p of stampProblems(root)) add("S75", P(...p.rel.split("/")), p.message);
    const hook = P(".githooks", "pre-commit"), pkg = P("package.json"), runF = P("tests", "run-all.js");
    if (!fs.existsSync(hook)) add("S75", hook, "the pre-commit hook that stamps the markers is missing");
    else { const h = fs.readFileSync(hook, "utf8"); if (!h.includes("node tests/stamp-versions.js") || !h.includes("git add")) add("S75", hook, "the hook must run node tests/stamp-versions.js and add what it changed to the commit"); }
    if (fs.existsSync(pkg)) { const j = fs.readFileSync(pkg, "utf8"); if (!/"stamp"\s*:\s*"node tests\/stamp-versions\.js"/.test(j)) add("S75", pkg, 'package.json must have the script "stamp": "node tests/stamp-versions.js"'); }
    if (fs.existsSync(runF) && !fs.readFileSync(runF, "utf8").includes('"version-markers.test.js"')) add("S75", runF, "version-markers.test.js is not in the suite");
  }
  // S74 (2026-10-10, prompt BG): the candidate's link rows say "Open" with the external link icon; every on/off switch is fixed in size and its sentence wraps; no ring on a non-interactive focus target.
  // Pinned: one unit (js/open-link.js) on every row of links in the details window, built with createElementNS (never HTML text), the icon hidden from assistive technology and the hidden text "opens in a new tab";
  // the unit never breaks across lines (white-space: nowrap) and a long label wraps in its own column; the rows that carry it really open a new tab (window.open "_blank" with noopener, or a link with target and rel);
  // the switch never shrinks (flex: none) and the sentence beside it may wrap, on the two pages that have switches; the one rule that removes the ring from tabindex -1 elements that are not controls, and no rule that
  // gives such an element a ring again; the three browser tests run in the suite.
  {
    const P = (...a) => path.join(root, ...a);
    const body = (f) => (fs.existsSync(f) ? stripJsComments(read(f)) : "");
    const searchF = P("js", "pages", "search.js"), openF = P("js", "open-link.js"), appCss = P("app.css"), stylesCss = P("styles.css"), editH = P("edit.html"), regH = P("register.html"), runF = P("tests", "run-all.js");
    if (fs.existsSync(searchF)) {
      const s = body(searchF);
      if (!s.includes('import { openUnit } from "../open-link.js";')) add("S74", searchF, "the details window uses the one Open unit (js/open-link.js)");
      if ((s.split('h("span", { class: "go" }, openUnit())').length - 1) !== 2) add("S74", searchF, "both the row's button and its fallback link carry the Open unit");
      if (/Continue →|Open link →/.test(s)) add("S74", searchF, "the old words (Continue →, Open link →) are gone from the candidate's rows");
      if (!s.includes('window.open(url, "_blank", "noopener,noreferrer")')) add("S74", searchF, 'a row opens its link in a new tab with noopener: window.open(url, "_blank", "noopener,noreferrer")');
      if (!s.includes('target: "_blank", rel: "noopener noreferrer"')) add("S74", searchF, "the fallback link opens a new tab with noopener noreferrer");
      if (!s.includes('go_.querySelector(".go-open") === null) go_.replaceChildren(openUnit())')) add("S74", searchF, "the Open unit comes back after a state word");
    }
    if (fs.existsSync(openF)) {
      const o = body(openF);
      for (const [needle, why] of [['export const OPEN_WORD = "Open";', "the word is Open"], ['export const OPEN_HIDDEN = "opens in a new tab";', 'the hidden text is "opens in a new tab"'], ['["aria-hidden", "true"]', "the icon is hidden from assistive technology"],
        ['document.createElementNS(SVG_NS, "svg")', "the icon is made as an SVG element, never as HTML text"], ['h("span", { class: "go-open" }, OPEN_WORD, externalIcon(), h("span", { class: "sr-only" }, " " + OPEN_HIDDEN))', "the unit is the word, the icon and the hidden text, in one span"]]) if (!o.includes(needle)) add("S74", openF, "js/open-link.js: " + why);
    }
    if (fs.existsSync(appCss)) {
      const c = read(appCss);
      for (const [needle, why] of [[".source-row .go{font-size:13px;font-weight:700;color:var(--ember);flex:0 0 auto;white-space:nowrap}", "the word cell never wraps or shrinks"], [".source-row .go-open{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}", "the word and the icon are one unit that never breaks"],
        [".source-row-label{font-size:14px;font-weight:600;min-width:0;overflow-wrap:anywhere;margin-right:12px}", "a long label wraps in its own column"],
        ['[tabindex="-1"]:not(a):not(button):not(input):not(select):not(textarea):not(summary):focus-visible{outline:none}', "the one rule that removes the ring from non-interactive focus targets"]]) if (!c.includes(needle)) add("S74", appCss, "app.css: " + why);
      for (const cls of [".link-confirm-text", ".contest-notice", ".contest-confirm-title"]) if (new RegExp(cls.replace(".", "\\.") + ":focus(-visible)?\\s*\\{[^}]*outline\\s*:\\s*[^n]").test(c)) add("S74", appCss, "app.css: " + cls + " is a sentence that script focus moves to: it is not given a ring");
    }
    if (fs.existsSync(stylesCss)) {
      const c = read(stylesCss);
      if (!c.includes(".toggle{width:52px;height:30px;flex:none;")) add("S74", stylesCss, "the switch never shrinks (flex: none)");
      if (!c.includes(".toggle-row>div:first-child{min-width:0;flex:1 1 auto}")) add("S74", stylesCss, "the sentence beside a switch may wrap (min-width: 0)");
    }
    for (const f of [editH, regH]) if (fs.existsSync(f)) {
      const t = read(f);
      const rows = (t.match(/class="toggle-row"/g) || []).length, buttons = (t.match(/<button[^>]*class="toggle"/g) || []).length;
      if (rows !== buttons || buttons === 0) add("S74", f, "every switch sits in a row of class toggle-row (" + rows + " rows for " + buttons + " switches)");
    }
    if (fs.existsSync(runF)) {
      const r = read(runF);
      for (const n of ["open-words.test.js", "toggles-fit.test.js", "focus-outline.test.js"]) if (!r.includes('"' + n + '"')) add("S74", runF, n + " is not in the suite");
    }
  }
  // S73 (2026-10-10, prompt BG): the recruiter firms area adds ONE firm at a time, through the one-firm add (set-destination-links op "add"), never through the whole-set replace.
  // Pinned: the add request is exactly { posting_id, kind: recruiter, op: add, name, url? } (no position, no list of firms), the answer must be an add that changed something; the add form is ONE name box and ONE optional
  // address box with the button "Add firm"; the whole-set controls and the sentence "What you save replaces what is stored" are gone from the firms area; three firms: no form and the one limit sentence; the whole-set call
  // is kept for Remove all firms only (an empty set); typed text in the add form counts as unsaved work; the pending-edit sentence for a firm names the Save on that firm and the bar's Discard.
  {
    const P = (...a) => path.join(root, ...a);
    const htmlF = P("edit.html"), apiF = P("js", "api.js"), editF = P("js", "pages", "edit.js"), modelF = P("js", "firm-panel-model.js"), rowsF = P("js", "link-rows.js"), dirtyF = P("js", "dirty-state.js");
    const body = (f) => (fs.existsSync(f) ? stripJsComments(read(f)) : "");
    if (fs.existsSync(htmlF)) {
      const t = read(htmlF);
      for (const id of ["firmAddBox", "firmRows", "addFirmBtn", "firmsLimit", "firmsAlert", "clearFirmsBtn"]) if (!t.includes('id="' + id + '"')) add("S73", htmlF, "the firms area is missing #" + id);
      if (!/<button type="button" id="addFirmBtn" class="btn btn-dark btn-sm">Add firm<\/button>/.test(t)) add("S73", htmlF, 'the add button must read "Add firm"');
      const fa = t.indexOf('id="firmsPanel"'), fb = t.indexOf('id="clearFirmsBtn"');
      const area = fa >= 0 && fb > fa ? t.slice(fa, fb) : "";
      if (area === "" || t.includes('id="saveFirmsBtn"') || area.includes("Replace recruiter firms") || area.includes("Add another firm")) add("S73", htmlF, "the whole-set controls (Replace recruiter firms, Add another firm) are gone from the edit page's firms area");
      if (area.includes("What you save replaces what is stored")) add("S73", htmlF, 'the sentence "What you save replaces what is stored" is gone from the firms area');
      if (!/<div id="firmsLimit"[^>]*hidden><\/div>/.test(t)) add("S73", htmlF, "the limit sentence is drawn by the page's script from the one sentence in js/firm-panel-model.js, not written twice");
    }
    if (fs.existsSync(apiF)) {
      const a = body(apiF);
      const i0 = a.indexOf("addRecruiterFirm:"), i1 = a.indexOf("removeRecruiterFirm:");
      const seg = i0 >= 0 && i1 > i0 ? a.slice(i0, i1) : "";
      if (!seg.includes('const body = { posting_id: postingId, kind: "recruiter", op: "add", name: c.name.trim() };')) add("S73", apiF, "the add request must be exactly posting_id, kind recruiter, op add and the name (and the address when one is typed)");
      if (/\bposition\s*:|\blinks\s*:|body\.position|body\.links/.test(seg)) add("S73", apiF, "the add request never carries a position or a list of firms: the server picks the position");
      if (!seg.includes('d.op === "add" && d.changed === true && d.posting_id.toLowerCase() === postingId.toLowerCase()')) add("S73", apiF, "the add answer must be an add that changed something, for this opening");
    }
    if (fs.existsSync(editF)) {
      const e = body(editF);
      const i0 = e.indexOf("async function submitFirmAdd()"), i1 = e.indexOf("async function removeAllFirms()");
      const seg = i0 >= 0 && i1 > i0 ? e.slice(i0, i1) : "";
      if (!seg.includes("api.addRecruiterFirm(postingId, plan.add)")) add("S73", editF, "Add firm must call api.addRecruiterFirm with the planned add");
      if (seg.includes("setRecruiterFirms") || seg.includes("recruiterFirms(")) add("S73", editF, "Add firm never uses the whole-set call or reads the firms already named");
      const j0 = e.indexOf("async function removeAllFirms()"), j1 = e.indexOf('$("#addFirmBtn").addEventListener');
      const rem = j0 >= 0 && j1 > j0 ? e.slice(j0, j1) : "";
      if (!rem.includes("api.setRecruiterFirms(postingId, [])")) add("S73", editF, "Remove all firms is the whole-set call with an empty set");
      if (!e.includes('$("#addFirmBtn").addEventListener("click", () => submitFirmAdd());')) add("S73", editF, "the add button must run submitFirmAdd");
      if (!e.includes('$("#firmAddBox").hidden = count >= 3;') || !e.includes("lim.textContent = count >= 3 ? FP.LIMIT : \"\";")) add("S73", editF, "three firms: the add form goes and the limit sentence shows");
      if (!e.includes('(shown("#firmsForm") && rowsTyped(firms.values()))')) add("S73", editF, "text typed in the add form counts as unsaved work");
      if (!e.includes("firmRows: shown(\"#firmsForm\") && rowsTyped(firms.values()), firmEdit: shown(\"#firmsForm\") && firmPanel.hasPending()")) add("S73", editF, "the unsaved model must say whether the add form or an open firm edit is what is not saved");
    }
    if (fs.existsSync(modelF)) {
      const m = body(modelF);
      if (!m.includes('LIMIT: "Three firms are named. That is the most one opening can have: remove one to add another.",')) add("S73", modelF, "the limit sentence is the approved one");
      if (!m.includes('added: (n) => "Firm " + n + " was added.",')) add("S73", modelF, "the sentence after an add is the approved one");
      if (!m.includes('ADD: "Add firm",')) add("S73", modelF, 'the button word is "Add firm"');
    }
    if (fs.existsSync(rowsF)) {
      const r = body(rowsF);
      if (!r.includes('firmAdd: { max: 1, keys: ["name", "url"]')) add("S73", rowsF, "the add form is ONE row");
      if (!r.includes('"aria-label": "Name of the firm to add"') || !r.includes('"aria-label": "Address of the firm to add (optional)"')) add("S73", rowsF, "the add boxes carry their accessible names");
    }
    if (fs.existsSync(dirtyF)) {
      const d = body(dirtyF);
      if (!d.includes('FIRMS_EDIT_DETAIL: "Press Save on the firm you are editing, or press Discard.",')) add("S73", dirtyF, "the pending firm edit sentence is the approved one");
      if (!d.includes("firmsEditOnly ? UNSAVED.FIRMS_EDIT_DETAIL")) add("S73", dirtyF, "the bar uses the firm sentence when only an open firm edit is not saved");
    }
  }
  // S72 (2026-10-10, prompts BC and BC1): the recruiter firms and the AI and hiring policy link as ROWS (Check link, Edit, Remove), on the ONE shared rows panel (js/row-panel.js) that the destination links use too.
  // Pinned: every row, box and button is built once, in js/row-panel.js, and the three profiles (link-panel.js, firm-panel.js, policy-panel.js) only name words, rows and calls; a firm without an address has no Check link;
  // each row action calls the call of ITS OWN kind and no other (a firm never an application link's call or the whole-set call, the policy link never a firm's or an application link's); the address never reaches a row
  // (rows are read from position, name, shown_as and the check result only); three firms at most; the exact accessible names; the candidate pages never carry the panel code; the page mounts them; their tests run in the suite.
  {
    const P = (...a) => path.join(root, ...a);
    const rowF = P("js", "row-panel.js"), firmF = P("js", "firm-panel.js"), firmMF = P("js", "firm-panel-model.js"), polPF = P("js", "policy-panel.js"), polF = P("js", "policy-link.js"), linkPF = P("js", "link-panel.js");
    const htmlF = P("edit.html"), apiF = P("js", "api.js"), editF = P("js", "pages", "edit.js"), runF = P("tests", "run-all.js");
    const EM = "—";
    const body = (f) => (fs.existsSync(f) ? stripJsComments(read(f)) : "");
    for (const f of [rowF, firmF, firmMF, polPF, linkPF]) if (!fs.existsSync(f)) add("S72", f, "this file must exist");
    // one component: a profile builds nothing
    for (const f of [linkPF, firmF, polPF]) {
      const c = body(f);
      if (/\bh\(|\bdocument\b|createElement|\.append\(|innerHTML/.test(c)) add("S72", f, "a profile only names words, rows and calls; every row, box and button is built once, in js/row-panel.js");
      if (c && !c.includes("mountRowPanel({ ...ctx, profile })")) add("S72", f, "the rows are the shared rows panel: return mountRowPanel({ ...ctx, profile })");
    }
    // each kind calls its own calls and no other
    const callsOf = (c) => ["checkDestinationLink", "editDestinationLink", "removeDestinationLink", "setDestinationLinks", "checkRecruiterFirm", "editRecruiterFirm", "removeRecruiterFirm", "setRecruiterFirms", "checkPolicyLink", "setPolicyLink"].filter((n) => new RegExp("\\bapi\\." + n + "\\b").test(c));
    const fc = body(firmF), pc = body(polPF);
    if (fc) {
      if (JSON.stringify(callsOf(fc).sort()) !== JSON.stringify(["checkRecruiterFirm", "editRecruiterFirm", "removeRecruiterFirm"])) add("S72", firmF, "the firm rows call api.checkRecruiterFirm, api.editRecruiterFirm and api.removeRecruiterFirm and nothing else: " + callsOf(fc).join(", "));
      for (const need of ["api.checkRecruiterFirm(ctx.getPostingId(), row.position)", "api.editRecruiterFirm(ctx.getPostingId(), row.position, change)", "api.removeRecruiterFirm(ctx.getPostingId(), row.position)", "canCheck: (row) => row.hasAddress,"]) if (!fc.includes(need)) add("S72", firmF, "the firm profile must keep: " + need);
    }
    if (pc) {
      if (JSON.stringify(callsOf(pc).sort()) !== JSON.stringify(["checkPolicyLink", "setPolicyLink"])) add("S72", polPF, "the policy row calls api.checkPolicyLink and api.setPolicyLink and nothing else: " + callsOf(pc).join(", "));
      for (const need of ["api.checkPolicyLink(ctx.getPostingId())", "api.setPolicyLink(ctx.getPostingId(), change.url)", "api.setPolicyLink(ctx.getPostingId(), null)"]) if (!pc.includes(need)) add("S72", polPF, "the policy profile must keep: " + need);
    }
    // a firm row is built from position, name, shown_as and the check result only; three at most
    if (fs.existsSync(firmMF)) {
      const m = body(firmMF);
      if (!m.includes("recruiterFirms(")) add("S72", firmMF, "firm rows come from the recruiter firms only (recruiterFirms)");
      if (!m.includes("x.position > 3 ||")) add("S72", firmMF, "at most three firms are rows (position 1 to 3)");
      if (/\bx\.(url|href|host|address|link|url_enc|link_id|id)\b/.test(m) || /\burl_enc\b|\blink_id\b/.test(m)) add("S72", firmMF, "a firm row must be built from position, firm, shown_as and the check result only: no field that could hold an address is read");
      if (/https?:\/\/[^\s"'`)<>]+/.test(m)) add("S72", firmMF, "no web address in the firm rows' words");
      for (const need of ['checkAria = (n) => "Check link for firm " + n, editAria = (n) => "Edit firm " + n, removeAria = (n) => "Remove firm " + n;', 'canCheck']) if (need !== "canCheck" && !m.includes(need)) add("S72", firmMF, "the accessible names must stay: " + need);
      if (read(firmMF).includes(EM)) add("S72", firmMF, "no em dash in the firm rows' words");
    }
    if (fs.existsSync(polF)) {
      const p = body(polF);
      if (!p.includes('export const policyAria = { check: "Check link for AI and hiring policy link", edit: "Edit AI and hiring policy link", remove: "Remove AI and hiring policy link" };')) add("S72", polF, "the policy row's accessible names must stay");
      if (!p.includes("const l = policyLink(list);\n  if (!l) return [];")) add("S72", polF, "the policy row exists only while a policy link is stored");
      if (/\bl\.(url|href|host|address|url_enc|link_id)\b/.test(p.slice(p.indexOf("export function policyRows")))) add("S72", polF, "the policy row is built from the check result and what candidates see only: no field that could hold an address is read");
      if (read(polF).includes(EM)) add("S72", polF, "no em dash in the policy link's words");
    }
    // the shared panel: a row without an address has no Check link; the same Remove and Edit questions for all
    if (fs.existsSync(rowF)) {
      const c = body(rowF);
      if (!c.includes("const check = P.canCheck(row) ? h(\"button\"")) add("S72", rowF, "Check link is drawn only for a row the profile says can be checked (a firm with an address, a stored policy link, an application link)");
      if (/\bapi\./.test(c)) add("S72", rowF, "the shared panel names no api call: the profiles carry them");
    }
    // the page: markup, mounting, unsaved work and Discard
    if (fs.existsSync(htmlF)) {
      const h2 = read(htmlF);
      for (const id of ["firmsList", "firmsPanelHint"]) if (h2.split('id="' + id + '"').length !== 2) add("S72", htmlF, "edit.html must carry #" + id + " exactly once");
      if (/id="firmsStored"|id="removePolicyBtn"/.test(h2)) add("S72", htmlF, "the old stored-firms sentence and the Remove policy link button are replaced by the rows");
      if (h2.slice(h2.indexOf('id="firmsPanel"'), h2.indexOf('id="readonlyNote"')).includes(EM)) add("S72", htmlF, "no em dash in the firms area");
    }
    if (fs.existsSync(editF)) {
      const e = body(editF);
      for (const need of ["mountFirmPanel({", "firmPanel.render(doc.destination_links)", "mountPolicyPanel({", "policyPanel.render(", "firmPanel.hasPending()", "policyPanel.hasPending()", "firmPanel.discard()", "policyPanel.discard()"]) if (!e.includes(need)) add("S72", editF, "edit.js must keep: " + need);
      if (/firmsStored/.test(e)) add("S72", editF, "edit.js must not draw the old stored-firms sentence");
    }
    // api: the exact requests and the strict answers
    if (fs.existsSync(apiF)) {
      const a = body(apiF);
      for (const need of ['call("check-destination-link", { posting_id: postingId, kind: "recruiter", position }', 'const body = { posting_id: postingId, kind: "recruiter", op: "edit", position };', 'call("set-destination-links", { posting_id: postingId, kind: "recruiter", op: "remove", position }', 'call("check-destination-link", { posting_id: postingId, kind: "policy", position: 1 }',
        'd.kind === "recruiter" && (d.op === "edit" || d.op === "remove" || d.op === "add")', 'l.kind === "recruiter" && isStr(l.firm) && l.label === null']) if (!a.includes(need)) add("S72", apiF, "api.js must make the call or keep the check: " + need);
      const i0 = a.indexOf("checkRecruiterFirm:"), i1 = a.indexOf("listMyPostings:");
      if (i0 < 0 || i1 < i0 || /poster_id|organization_id/.test(a.slice(i0, i1))) add("S72", apiF, "the rows' calls never send who is asking");
    }
    // the candidate pages and the extension's hand-off never carry the panel code
    for (const rel of ["js/pages/search.js", "js/comments-model.js", "js/pages/comments.js", "js/fragment-prefill.js", "js/signin-handoff.js", "js/pages/dashboard.js", "js/pages/index.js"]) {
      const f = P(...rel.split("/"));
      if (fs.existsSync(f) && /row-panel|firm-panel|policy-panel|checkRecruiterFirm|editRecruiterFirm|removeRecruiterFirm|checkPolicyLink/.test(stripJsComments(read(f)))) add("S72", f, "only the opening editor uses the rows panel and the firm and policy row calls");
    }
    for (const need of ['path.join(here, "rows-panels.unit.test.js")', 'path.join(here, "rows-panels.mutants.test.js")', 'path.join(here, "firm-rows.test.js")']) if (fs.existsSync(runF) && !read(runF).includes(need)) add("S72", runF, "the rows' tests must run in the suite: " + need);
    for (const t of ["rows-panels.unit.test.js", "rows-panels.mutants.test.js", "firm-rows.test.js", "fake-dom.js"]) if (!fs.existsSync(P("tests", t))) add("S72", P("tests", t), "the rows' test must exist");
  }

  // S71 (2026-10-10, prompt BF): the stage SQL and edge function tools (run-sql.js, deploy-edge.js). They live in C:\Users\jpiro\fightghostjobs\tools, outside this repository (it is served by Pages), so the rule reads that folder next to this
  // repository and says nothing where it does not exist (another machine). It fails when: a token, secret key, JWT, database URL with a password or bearer value, or the VALUE of the credential variable FGJ_STAGE_ACCESS_TOKEN of this process,
  // is written in the tools or in the ledger and logs they wrote (reports\sql-run-*, reports\edge-deploy-*); when the stage project ref is written anywhere in the tools but in its one constant in lib/stage.js, or another project-ref shaped word is
  // written; when that constant is not the stage ref as a plain literal; or when a host other than api.supabase.com is written.
  {
    const toolsDir = opts.toolsDir || path.resolve(root, "..", "fightghostjobs", "tools");
    const mainDir2 = path.dirname(toolsDir);
    if (opts.toolsDir || fs.existsSync(mainDir2)) {
      const STAGE = "tpmvkjuhbbwftqoodzcn";
      const stageF = path.join(toolsDir, "lib", "stage.js");
      for (const need of ["run-sql.js", "deploy-edge.js"]) if (!fs.existsSync(path.join(toolsDir, need))) add("S71", path.join(toolsDir, need), need + " must exist in the tools folder");
      if (!fs.existsSync(stageF)) add("S71", stageF, "lib/stage.js (the one place that names the project and reads the credential) must exist");
      const toolFiles = fs.existsSync(toolsDir) ? walk(toolsDir).filter((f) => /\.(js|mjs|json|md|txt)$/.test(f)) : [];
      const repDir = opts.reportsDir || path.join(mainDir2, "reports");
      const written = fs.existsSync(repDir) ? fs.readdirSync(repDir).filter((n) => /^(sql-run-|edge-deploy-).*\.(txt|json)$/.test(n)).map((n) => path.join(repDir, n)) : [];
      const cred = process.env.FGJ_STAGE_ACCESS_TOKEN || "";
      const secretLooking = [
        [/sbp_[A-Za-z0-9]{16,}/, "a personal access token"], [/sb_secret_[A-Za-z0-9_-]{12,}/, "a secret key"], [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, "a JWT"],
        [/postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@/, "a database URL with a password"], [/Bearer\s+[A-Za-z0-9._~+/-]{20,}/, "a bearer value"],
      ];
      for (const f of [...toolFiles, ...written]) {
        const t = read(f);
        for (const [re, what] of secretLooking) if (re.test(t)) add("S71", f, what + " is written here: the credential is read from the environment variable and never written anywhere");
        if (cred.length >= 8 && t.includes(cred)) add("S71", f, "the value of FGJ_STAGE_ACCESS_TOKEN of this process is written here");
      }
      for (const f of toolFiles) {
        if (!/\.(js|mjs)$/.test(f)) continue;
        const t = read(f), r = path.relative(toolsDir, f).replace(/\\/g, "/");
        if (r !== "lib/stage.js" && t.includes(STAGE)) add("S71", f, "the stage project ref is written outside lib/stage.js: import STAGE_REF from there");
        for (const m of t.matchAll(/\b[a-z]{20}\b/g)) if (m[0] !== STAGE) add("S71", f, "a word shaped like a project ref (20 lowercase letters) is written here; the only project ref in the tools is the stage constant");
        for (const m of t.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) if (m[1] !== "api.supabase.com") add("S71", f, "a host other than api.supabase.com is written here: " + m[1]);
        if (/\.supabase\.co\b/.test(t)) add("S71", f, "a project address (.supabase.co) is written here; the tools talk to api.supabase.com only");
      }
      if (fs.existsSync(stageF)) {
        const t = read(stageF);
        const ls = t.split("\n").filter((l) => /^export const STAGE_REF\b/.test(l));
        if (ls.length !== 1 || ls[0] !== 'export const STAGE_REF = "' + STAGE + '";') add("S71", stageF, "the constant must be exactly: export const STAGE_REF = \"<the stage ref>\"; a plain literal, read from nothing");
        if (!t.includes('export const TOKEN_ENV = "FGJ_STAGE_ACCESS_TOKEN";')) add("S71", stageF, "the credential variable must be exactly FGJ_STAGE_ACCESS_TOKEN");
        if (/process\.(env|argv)/.test(t)) add("S71", stageF, "lib/stage.js must not read process.env or process.argv: the environment is passed in by the two command files");
      }
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
