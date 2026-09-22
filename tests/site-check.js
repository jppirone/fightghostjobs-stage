// site-check.js - static rules for the whole site. Run: node tests/site-check.js [rootDir]      (exit 1 on any finding)
// The site handles two kinds of session and shows text written by strangers (postings, comments), so these rules are enforced by a program, not by care:
//   S1  every page carries the one expected Content-Security-Policy (scripts only from this site; the only network destination is the project's own API)
//   S2  every page says noindex, nofollow
//   S3  no inline script, no inline event handler, no javascript: URL
//   S4  every <script> is a module from js/ and exists
//   S5  no way to turn text into HTML or code (innerHTML, outerHTML, insertAdjacentHTML, document.write, eval, new Function, string timers)
//   S6  every import resolves to a real file
//   S7  every local href / src / stylesheet exists
//   S8  no network address other than the project's API appears in code, markup or styles (no CDN, no analytics, no font host)
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
//   S23 no page promises what is not built (cross-posting count, ATS import, company-wide view, "1 in 5", "Upgrade to add"); the sample card says it is fictional
//   S24 the Team page exists with its controls and calls the roster only through api.js
//   S25 the AI-disclosure "i" tooltips are on the register AND edit pages (designed wording), positioned and tap-able; the destination-link rows are on both pages and register.js saves them
//   S26 the candidate's details dialog explains the one-time links and what to do when one is wrong; the employer pages say the label is theirs only; api.js accepts the derived label + check
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
        if (!/\btype="module"/.test(attrs) || !/^js\/[a-z0-9\/-]+\.js$/i.test(src)) add("S4", f, "script must be a module from js/: " + src);
        else if (!fs.existsSync(path.join(root, src))) add("S4", f, "script does not exist: " + src);
      }
    }
    if (/\son[a-z]+\s*=\s*["']/i.test(s.replace(/<script[\s\S]*?<\/script>/gi, ""))) add("S3", f, "inline event handler attribute");
    if (/\b(href|src|action)\s*=\s*["']\s*javascript:/i.test(s)) add("S3", f, "javascript: URL");
    if (/<a\b[^>]*target="_blank"(?![^>]*rel="[^"]*noopener)[^>]*>/i.test(s) || /<a\b(?![^>]*rel="[^"]*noopener)[^>]*target="_blank"[^>]*>/i.test(s)) add("S12", f, "target=_blank without rel=noopener");
    for (const m of s.matchAll(/\b(?:href|src)\s*=\s*"([^"]*)"/g)) {
      const u = m[1];
      if (u === "" || u.startsWith("#") || u.startsWith("mailto:")) continue;
      if (/^https?:\/\//i.test(u)) { if (!u.startsWith(API_ORIGIN)) add("S8", f, "external address in markup: " + u); continue; }
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
    const REQ_TEXT_HINT = "This text is compared with any later changes to it. Small corrections (a typo, a tightened sentence, a dropped line) save straight away and are never flagged or held up. If a change would rewrite most of it, we'll ask you to register it as a new posting with its own req number, so candidates can always tell which role they're looking at. Each change is saved with a short note.";
    for (const f of [rh, eh]) if (!read(f).includes('<div id="reqTextHint" class="field-hint">' + REQ_TEXT_HINT + "</div>")) add("S19", f, "the requirements-text hint (#reqTextHint) must carry the approved wording, word for word");
    if (!read(eh).includes("What changed, and why? (required; kept with the posting).")) add("S19", eh, "the change-note label must be the approved wording");
    if (!/<input id="note" type="text" maxlength="500"/.test(read(eh))) add("S19", eh, "the change note input (id=note, at most 500 characters) is missing");
  }

  // S20: destination links on the edit page (item 3, verified plan): the section and its controls exist, a free organization is pointed to sales, the page saves through setDestinationLinks, and it never reads an address back (the server sends position and label only)
  if (fs.existsSync(eh)) {
    const eht = read(eh), ejs = path.join(root, "js", "pages", "edit.js");
    for (const id of ["linksCard", "linksLocked", "linksForm", "linkRows", "exclusiveRow", "exclusiveToggle"]) if (!eht.includes('id="' + id + '"')) add("S20", eh, "the edit page is missing #" + id + " (destination links, verified plan)");
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
  // The ONE place "Upgrade to add" is allowed: the locked destination-links panel on register.html (that editor genuinely exists for the verified plan), between id="linksLocked" and <!-- /linksLocked -->.
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
    if (fs.existsSync(sh2)) { const t = read(sh2); if (!t.includes('id="modalLinksNote"')) add("S26", sh2, "search.html is missing #modalLinksNote"); for (const need of ["look unusual on purpose", "one-time link through FightGhostJobs", "protected from scraping", "wherever the employer told us to send you", "we could not verify it", "If a link does not lead to this job", "mailto:sales@fightghostjobs.com"]) if (!t.includes(need)) add("S26", sh2, "the links note must say: " + need); }
    const sj = path.join(root, "js", "pages", "search.js"); if (fs.existsSync(sj) && !read(sj).includes('$("#modalLinksNote").hidden = false')) add("S26", sj, "search.js must show the links note when links are listed");
    for (const name of ["register.html", "edit.html"]) { const p = path.join(root, name); if (fs.existsSync(p)) { const t = read(p); if (!t.includes("The label is a note for you only")) add("S26", p, name + " must say the label is the employer's note only"); if (!t.includes("a link shortener or redirect is not accepted")) add("S26", p, name + " must say shorteners are refused"); } }
    const aj = path.join(root, "js", "api.js"); if (fs.existsSync(aj) && !/linkExtras: \(x\) => \(x\.shown_as === undefined \|\| isStr\(x\.shown_as\)\)/.test(read(aj))) add("S26", aj, "api.js must accept shown_as on a stored link");
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
