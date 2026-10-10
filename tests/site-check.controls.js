// site-check.controls.js - negative controls for site-check.js: each deliberate defect below must be caught by the rule it is meant to trip. Run: node tests/site-check.controls.js
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkSite } from "./site-check.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-site-"));
let n = 0, missed = 0;

function control(label, rule, mutate) {
  const dir = path.join(tmpBase, "c" + ++n);
  fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
  mutate(dir);
  const found = checkSite(dir).filter((f) => f.rule === rule);
  const ok = found.length > 0;
  if (!ok) missed++;
  console.log((ok ? "caught  " : "MISSED  ") + rule + "  " + label);
}
const edit = (rel, fn) => (dir) => { const p = path.join(dir, rel); const before = fs.readFileSync(p, "utf8"), after = fn(before); if (after === before) throw new Error("control mutation changed nothing in " + rel); fs.writeFileSync(p, after); };
const append = (rel, text) => edit(rel, (s) => s + "\n" + text + "\n");

// a clean copy must be clean
{
  const dir = path.join(tmpBase, "clean"); fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
  const f = checkSite(dir); console.log((f.length === 0 ? "clean   " : "DIRTY   ") + "the unmodified copy has " + f.length + " findings"); if (f.length) missed++;
}

control("innerHTML in a page script", "S5", append("js/pages/search.js", "document.body.innerHTML = location.hash;"));
control("insertAdjacentHTML", "S5", append("js/dom.js", "export const x = (e, t) => e.insertAdjacentHTML('beforeend', t);"));
control("document.write", "S5", append("js/pages/index.js", "document.write('<b>x</b>');"));
control("eval", "S5", append("js/pages/register.js", "eval(location.hash.slice(1));"));
control("new Function", "S5", append("js/format.js", "export const f = new Function('return 1');"));
control("a string timer", "S5", append("js/format.js", "setTimeout('alert(1)', 10);"));
control("an inline script", "S3", edit("index.html", (s) => s.replace("</body>", "<script>alert(1)</script></body>")));
control("an inline event handler", "S3", edit("index.html", (s) => s.replace('<a class="nav-logo"', '<a onclick="x()" class="nav-logo"')));
control("a javascript: link", "S3", edit("search.html", (s) => s.replace('href="index.html"', 'href="javascript:alert(1)"')));
control("the CSP meta removed", "S1", edit("register.html", (s) => s.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n/, "")));
control("CSP allows eval", "S1", edit("search.html", (s) => s.replace("script-src 'self';", "script-src 'self' 'unsafe-eval';")));
control("CSP allows any connection", "S1", edit("search.html", (s) => s.replace("connect-src https://tpmvkjuhbbwftqoodzcn.supabase.co;", "connect-src *;")));
control("CSP allows a CDN script", "S1", edit("index.html", (s) => s.replace("script-src 'self';", "script-src 'self' https://cdn.example.com;")));
control("noindex removed", "S2", edit("auth-callback.html", (s) => s.replace('<meta name="robots" content="noindex, nofollow">\n', "")));
control("a script from a CDN", "S4", edit("index.html", (s) => s.replace("</body>", '<script src="https://cdn.example.com/x.js"></script></body>')));
control("a non-module page script", "S4", edit("index.html", (s) => s.replace('<script type="module" src="js/pages/index.js">', '<script src="js/pages/index.js">')));
control("a page script that does not exist", "S4", edit("index.html", (s) => s.replace("js/pages/index.js", "js/pages/nope.js")));
control("an import that does not resolve", "S6", append("js/pages/index.js", "import { z } from '../missing.js';"));
control("a bare import", "S6", append("js/pages/index.js", "import x from 'left-pad';"));
control("a broken local link", "S7", edit("search.html", (s) => s.replace('href="search.html" class="active"', 'href="gone.html" class="active"')));
control("a Google Fonts import", "S11", edit("styles.css", (s) => "@import url('https://fonts.googleapis.com/css2?family=Work+Sans');\n" + s));
control("a missing font file", "S11", edit("styles.css", (s) => s.replace("fonts/work-sans-latin.woff2", "fonts/gone.woff2")));
control("an external stylesheet", "S8", edit("index.html", (s) => s.replace('<link rel="stylesheet" href="app.css">', '<link rel="stylesheet" href="https://cdn.example.com/x.css">')));
control("an analytics beacon", "S8", append("js/pages/index.js", "navigator.sendBeacon('https://t.example.com/', 'x');"));
control("a fetch outside api.js", "S8", append("js/pages/index.js", "fetch('/x');"));
control("a hard-coded third-party address in code", "S8", append("js/format.js", "export const U = 'https://evil.example/collect';"));
control("a secret key in config.js", "S9", append("js/config.js", "export const K = 'sb_secret_ABCDEFGHIJKLMNOP';"));
control("a JWT-looking token", "S9", append("js/format.js", "export const T = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop';"));
control("a database URL", "S9", append("js/format.js", "export const D = 'postgresql://postgres:pw@db.example.com:5432/postgres';"));
control("service_role mentioned in a page script", "S9", append("js/pages/search.js", "// uses service_role"));
control("the publishable key copied into another file", "S9", (dir) => { const k = fs.readFileSync(path.join(dir, "js/config.js"), "utf8").match(/sb_publishable_[A-Za-z0-9_-]+/)[0]; fs.appendFileSync(path.join(dir, "js/format.js"), "\nexport const K2 = '" + k + "';\n"); });
control("the vendored Auth client tampered with", "S10", (dir) => fs.appendFileSync(path.join(dir, "vendor/auth-js.min.mjs"), "\n/* tampered */\n"));
control("target=_blank without noopener in markup", "S12", edit("index.html", (s) => s.replace('<a class="nav-logo" href="index.html" aria-label="FightGhostJobs home">', '<a class="nav-logo" target="_blank" href="index.html" aria-label="FightGhostJobs home">')));
control("the skip link removed from a page", "S31", edit("team.html", (s) => s.replace('<a class="skip-link" href="#main">Skip to content</a>\n', "")));
control("the logo loses its accessible name", "S31", edit("dashboard.html", (s) => s.replace(' aria-label="FightGhostJobs home"', "")));
control("the logo is no longer the first link in the header", "S31", edit("register.html", (s) => s.replace('<a class="nav-logo" href="index.html"', '<a class="nav-logo" href="privacy.html"')));
control("the main region lost from a page", "S31", edit("edit.html", (s) => s.replace('<main id="main">', "<div>").replace("</main>", "</div>")));
control("the footer turned back into a plain div", "S31", edit("comments.html", (s) => s.replace('<footer class="site-footer">', '<div class="site-footer">').replace("</footer>", "</div>")));
control("the header links no longer a nav", "S31", edit("analytics.html", (s) => s.replace('<nav class="nav-links" aria-label="Main">', '<div class="nav-links">').replace("  </nav>", "  </div>")));
control("the old lower-contrast ember returns", "S31", edit("styles.css", (s) => s.replace("--ember:#C43E19;", "--ember:#E8491E;")));
control("the link underline rule removed", "S31", edit("app.css", (s) => s.replace("main a:not(.btn):not(td a){text-decoration:underline", "main a:not(.btn):not(td a){text-decoration:none")));
control("the current page loses aria-current", "S31", edit("search.html", (s) => s.replace(' aria-current="page"', "")));
control("a new tab opened without noopener", "S12", append("js/pages/index.js", "window.open('x.html', '_blank');"));
control("app.css loaded before styles.css", "S13", edit("register.html", (s) => s.replace('<link rel="stylesheet" href="styles.css">\n<link rel="stylesheet" href="app.css">', '<link rel="stylesheet" href="app.css">\n<link rel="stylesheet" href="styles.css">')));

control("the closed-or-expired sentence removed from the note", "S14", edit("js/search-input.js", (s) => s.replace(" A title search finds only openings that are live: closed or expired openings are found only by Opening ID or req number.", "")));
control("the sentence reworded", "S14", edit("js/search-input.js", (s) => s.replace("are found only by Opening ID or req number.", "may be found by Opening ID or req number.")));
control("search.js goes back to its own hand-written message", "S14", edit("js/pages/search.js", (s) => s.replace("noMatchMessage(searched.company, searched.query, searched.kind))", "\"No openings found. Check the name.\")")));
control("search.js no longer imports the message builder", "S14", edit("js/pages/search.js", (s) => s.replace("resolveSearch, noMatchMessage, searchErrorMessage", "resolveSearch, searchErrorMessage")));
control("the message stops echoing what was searched", "S14", edit("js/search-input.js", (s) => s.split("return \"No openings found for").join("return \"Nothing for")));
control("the message stops carrying the note", "S14", edit("js/search-input.js", (s) => s.replace("+ what + \". \" + NO_MATCH_NOTE;", "+ what + \".\";")));

control("the form range drifts (floor 7)", "S15", edit("js/register-form.js", (s) => s.replace("MIN_WINDOW_DAYS = 14", "MIN_WINDOW_DAYS = 7")));
control("the form allows more than 45", "S15", edit("js/register-form.js", (s) => s.replace("MAX_WINDOW_DAYS = 45", "MAX_WINDOW_DAYS = 60")));
control("the dashboard table is wrapped in an element that clips it", "S17", edit("dashboard.html", (s) => s.replace('style="padding:0;overflow-x:auto;"', 'style="padding:0;overflow:hidden;"')));
control("the candidate req box is a plain visible text box", "S18", edit("search.html", (s) => s.replace('id="reqq" class="srch-input" type="password"', 'id="reqq" class="srch-input" type="text"')));
control("the show/hide toggle for the req box is gone", "S18", edit("search.html", (s) => s.replace('id="reqToggle"', 'id="reqTogglX"')));
control("the register form loses the requirements-text hint wording", "S19", edit("register.html", (s) => s.replace("Small corrections (a typo, a tightened sentence, a dropped line) save straight away", "Corrections save")));
control("the edit page loses the requirements-text hint wording", "S19", edit("edit.html", (s) => s.replace("we'll ask you to add it as a new opening with its own req number", "we'll ask you")));
control("the edit page's note label is changed", "S19", edit("edit.html", (s) => s.replace("(required; kept with the opening).", "(optional).")));
control("the edit page loses its destination-links form", "S20", edit("edit.html", (s) => s.replace('id="linksForm"', 'id="linksFormX"')));
control("the locked section no longer points to sales", "S20", edit("edit.html", (s) => s.split("Write to sales@fightghostjobs.com →").join("Ask around")));
control("the edit page no longer saves links through the API", "S20", edit("js/pages/edit.js", (s) => s.replace("api.setDestinationLinks(", "api.somethingElse(")));
control("the edit page reads an address back from a stored link", "S20", append("js/pages/edit.js", "const leak = (doc) => doc.destination_links.map((x) => x.url);"));
control("the register form's go-live disclosure is reworded", "S21", edit("register.html", (s) => s.replace("Your opening goes live within 15 minutes after that time", "Your opening goes live at that time")));
control("the edit page's go-live disclosure is reworded", "S21", edit("edit.html", (s) => s.replace("counted from the moment it actually goes live, not from now", "counted from now")));
control("the go-live input is a plain text box", "S21", edit("register.html", (s) => s.replace('<input id="gldate" type="datetime-local"', '<input id="gldate" type="text"')));
control("the register form loses its 'on a date and time' choice", "S21", edit("register.html", (s) => s.replace('id="glLater"', 'id="glLaterX"')));
control("the register page no longer schedules through the API", "S21", edit("js/pages/register.js", (s) => s.replace("api.schedulePosting(", "api.somethingElse(")));
control("the edit page no longer schedules through the API", "S21", edit("js/pages/edit.js", (s) => s.replace("api.schedulePosting(", "api.somethingElse(")));
control("privacy.html loses the cookie sentence", "S22", edit("privacy.html", (s) => s.replace("We set no cookies of our own", "We set cookies")));
control("privacy.html loses the email paragraph", "S22", edit("privacy.html", (s) => s.replace('id="privacyEmails"', 'id="privacyEmailsX"')));
control("privacy.html stops saying what an email never carries", "S22", edit("privacy.html", (s) => s.replace("never its description, a comment's text or an apply link", "never much")));
control("privacy.html loses the sentence about the contest outcome email", "S22", edit("privacy.html", (s) => s.replace(" (we email the outcome to the account that filed the contest)", "")));
control("privacy.html loses the sentence about the staff email when a contest is filed", "S22", edit("privacy.html", (s) => s.replace("When a contest is filed, we may email our own staff the organization, opening and reason category.", "")));
control("privacy.html loses the sentence that the contest email carries no comment or explanation", "S22", edit("privacy.html", (s) => s.replace("That email does not include the comment or your explanation.", "")));
control("the contest outcome sentence moves out of the emails paragraph", "S22", edit("privacy.html", (s) => s.replace(" (we email the outcome to the account that filed the contest)", "").replace('id="privacyContests">', 'id="privacyContests">When a comment you contested is decided, we email the outcome to the account that filed the contest. ')));
control("the contest-decided email is said twice again", "S22", edit("privacy.html", (s) => s.replace("When a contest is filed, we may", "When a contest on a comment is decided, we email the outcome to the account that filed it. When a contest is filed, we may")));
control("a page loses its privacy footer link", "S22", edit("dashboard.html", (s) => s.replace('<a href="privacy.html">Privacy</a>', '<a href="index.html">Privacy</a>')));
control("the candidate email box loses the privacy one-liner", "S22", edit("search.html", (s) => s.replace('never shown to anyone. <a href="privacy.html">Privacy</a>.', "never shown to anyone.")));
control("the landing page promises a cross-posting count again", "S23", append("index.html", "<div>Posted in 2 places</div>"));
control("the register page promises ATS import again", "S23", append("register.html", "<li>Bulk import from your ATS</li>"));
control("the sample card stops saying it is fictional", "S23", edit("index.html", (s) => s.replace("(a fictional employer)", "")));
control("'Upgrade to add' outside the links panel (the recruiter-firms panel)", "S23", edit("register.html", (s) => s.replace("Naming the firm is part of the destination links tier.", "Upgrade to add the recruiter firm.")));
control("'Upgrade to add' on another page", "S23", append("edit.html", "<p>Upgrade to add named recruiter firms</p>"));
control("the edit page loses the filtering tooltip", "S25", edit("edit.html", (s) => s.replace('AI used for initial filtering<span class="info-icon" tabindex="0">i<span class="info-tooltip">Resume screening', 'AI used for initial filtering<span class="info-icon" tabindex="0">i<span class="info-tooltip">Automated rejection')));
control("the register page's interviewing tooltip is reworded", "S25", edit("register.html", (s) => s.replace("Any AI that interacts with a candidate directly", "Any AI at all")));
control("the icon loses position:relative (the tooltip lands off the page)", "S25", edit("styles.css", (s) => s.replace(".info-icon{position:relative;", ".info-icon{")));
control("the tap state stops showing the tooltip", "S25", edit("styles.css", (s) => s.replace(",.info-icon.open .info-tooltip{display:block}", "{display:block}")));
control("the edit page stops wiring the icons", "S25", edit("js/pages/edit.js", (s) => s.replace("wireInfoIcons();", "")));
control("the register page loses its link rows", "S25", edit("register.html", (s) => s.replace('id="linkRows"', 'id="linkRowsX"')));
control("the register page loses the locked panel", "S25", edit("register.html", (s) => s.replace('id="linksLocked"', 'id="linksLockedX"')));
control("register.js stops saving the links", "S25", edit("js/pages/register.js", (s) => s.replace("api.setDestinationLinks(", "api.somethingElse(")));
control("the edit page grows its own rows again", "S25", edit("js/pages/edit.js", (s) => s.replace("mountLinkRowsById()", "myOwnRows()")));
control("the details dialog loses the links note", "S26", edit("search.html", (s) => s.replace('id="modalLinksNote"', 'id="modalLinksNoteX"')));
control("the links note stops saying what to do when a link is wrong", "S26", edit("search.html", (s) => s.replace("If a link does not lead to this job", "If you like this job")));
control("search.js stops showing the links note", "S26", edit("js/pages/search.js", (s) => s.replace('$("#modalLinksNote").hidden = false;', "")));
control("the edit page says the label is shown to candidates again", "S26", edit("edit.html", (s) => s.replace("The label is a note for you only", "The label is shown to candidates")));
control("the register page loses its firm rows", "S27", edit("register.html", (s) => s.replace('id="firmRows"', 'id="firmRowsX"')));
control("the edit page says coming soon again", "S27", edit("edit.html", (s) => s.replace("Up to 3 firms.", "Naming the recruiter firm: coming soon.")));
control("edit.js stops saving the firms through the API", "S27", edit("js/pages/edit.js", (s) => s.replace("api.setRecruiterFirms(", "api.somethingElse(")));
control("the search page stops naming the firm", "S27", edit("js/pages/search.js", (s) => s.replace('"Recruiter firm: " + link.firm', '"Firm: " + link.firm')));
control("the edit page loses an AI note box", "S28", edit("edit.html", (s) => s.replace('id="aiInterviewNote"', 'id="aiInterviewNoteX"')));
control("the register page's note box grows past 300", "S28", edit("register.html", (s) => s.replace('id="aiFilterNote" type="text" maxlength="300"', 'id="aiFilterNote" type="text" maxlength="500"')));
control("the note label stops saying the words are shown to candidates", "S28", edit("register.html", (s) => s.replace("In your own words (optional, shown to candidates): how AI is used to filter", "In your own words (optional): how AI is used to filter")));
control("the register form stops checking the notes with the shared rule", "S28", edit("js/register-form.js", (s) => s.replace('import { aiNoteProblem } from "./ai-notes.js";', "const aiNoteProblem = () => null;")));
control("the search card stops showing the notes", "S28", edit("js/pages/search.js", (s) => s.replace("...aiNotes(row).map(", "...[].map(")));
control("a page links to comments.html without a reference (a listing in the making)", "S29", append("index.html", '<a href="comments.html">All comments</a>'));
control("the comments page names the author", "S29", edit("js/pages/comments.js", (s) => s.replace('"Candidate ' + String.fromCharCode(183) + ' "', '"Candidate #" + c.id + " ' + String.fromCharCode(183) + ' "')));
control("the wrong-link report stops saying it is private", "S29", edit("comments.html", (s) => s.replace("Tell us here, privately:", "Tell us here:")));
control("the dashboard stops linking the comments", "S29", edit("js/pages/dashboard.js", (s) => s.replace('"comments.html?id=" + encodeURIComponent(p.id)', '"dashboard.html"')));
// S38 (item 4, 2026-10-03): the destination links rows panel. Write-only: no address on the page, the blank tab first, the plan's words once, no new host.
const PANEL = "js/link-panel.js", MODEL = "js/link-panel-model.js";
control("the address box is given the row's address", "S38", edit(PANEL, (s) => s.replace('labelBox.value = row.label || "";', 'labelBox.value = row.label || ""; addr.value = row.url;')));
control("the address box is created with a value", "S38", edit(PANEL, (s) => s.replace('autocapitalize: "off", spellcheck: "false", "aria-label": LP.addressAria(row.position)', 'autocapitalize: "off", spellcheck: "false", value: "x", "aria-label": LP.addressAria(row.position)')));
control("the address box loses autocomplete off", "S38", edit(PANEL, (s) => s.replace('maxlength: "2048", autocomplete: "off", autocapitalize', 'maxlength: "2048", autocapitalize')));
control("the address box gets a value attribute", "S38", append(PANEL, 'const _v = (addr) => addr.setAttribute("value", "x");'));
control("the address box gets a default value", "S38", append(PANEL, "const _d = (addr) => { addr.defaultValue = 'x'; };"));
control("the address box is assigned a variable", "S38", append(PANEL, "const _e = (addr, v) => { addr.value = v; };"));
control("a row reads the address field", "S38", edit(MODEL, (s) => s.replace("rows.push({ position: x.position,", "rows.push({ url: x.url, position: x.position,")));
control("a row reads a host field", "S38", append(MODEL, "const _h = (x) => x.host;"));
control("a row reads the encrypted address", "S38", append(MODEL, "const _u = (list) => list.map((q) => q.url_enc);"));
control("the ticket link is shown as the note text", "S38", edit(PANEL, (s) => s.replace('setNote(row.position, { kind: "notice", text: LP.OPENED });', 'setNote(row.position, { kind: "notice", text: r.data.go_url });')));
control("the ticket link is written into the blocked note", "S38", edit(PANEL, (s) => s.replace('LP.BLOCKED, h("a", { href: note.link', 'LP.BLOCKED, note.link, h("a", { href: note.link')));
control("the tab is opened after the request", "S38", edit(PANEL, (s) => s.replace("const w = openBlank();", "let w = null;").replace("const opened = !!w", "w = openBlank(); const opened = !!w")));
control("the opener is not cut", "S38", edit(PANEL, (s) => s.replace("w.opener = null;", "")));
control("the opener is cut after the tab is pointed", "S38", edit(PANEL, (s) => s.replace("try { w.opener = null; }", "w.location = r.data.go_url; try { w.opener = null; }").replace("        w.location = r.data.go_url;\n", "")));
control("window.open takes a third argument", "S38", edit(PANEL, (s) => s.replace('window.open("about:blank", "_blank")', 'window.open("about:blank", "_blank", "noopener")')));
control("window.open is given the ticket link", "S38", edit(PANEL, (s) => s.replace('window.open("about:blank", "_blank")', "window.open(r.data.go_url, '_blank')")));
control("the panel code names a web address", "S38", append(PANEL, 'const _w = "https://tracker.example.invalid/x";'));
control("the panel model names a web address", "S38", append(MODEL, 'const _w = "https://tracker.example.invalid/x";'));
control("the panel stores something", "S38", append(PANEL, "const _s = () => localStorage.getItem('x');"));
control("the panel logs something", "S38", append(PANEL, "const _l = () => console.log('x');"));
control("the panel gets an Add control", "S38", append(PANEL, 'const _a = "Add another link";'));
control("the model gets an Add control", "S38", append(MODEL, 'const _a = "Add a link";'));
control("the address-bar note is defined a second time", "S38", append(MODEL, 'const _n = "The page you are taken to may show its address in the new tab. That is normal.";'));
control("the address-bar note is dropped from the page", "S38", edit("edit.html", (s) => s.replace("The page you are taken to may show its address in the new tab. That is normal.", "")));
control("the panel sentence changes a word", "S38", edit("edit.html", (s) => s.replace("The other links are not touched.", "The other links are untouched.")));
control("the old 'not shown back to you' sentence returns", "S38", edit("edit.html", (s) => s.replace("What you save replaces what is stored.", "For safety the addresses are not shown back to you: to change them, enter the full set again. What you save replaces what is stored.")));
control("the old stored-links block returns", "S38", edit("edit.html", (s) => s.replace('<div id="linksList" class="link-list"></div>', '<div id="linksList" class="link-list"></div><div id="linksStored"></div>')));
control("an em dash in the panel's html", "S38", edit("edit.html", (s) => s.replace('<div id="linksList" class="link-list"></div>', '<div id="linksList" class="link-list" title="a \u2014 b"></div>')));
control("an em dash in the panel model", "S38", edit(MODEL, (s) => s.replace('LINK_GONE: "That link is no longer stored, so nothing was changed."', 'LINK_GONE: "That link is no longer stored \u2014 so nothing was changed."')));
control("an em dash in the panel code", "S38", edit(PANEL, (s) => s.replace('"Open Link " + note.position', '"Open Link \u2014 " + note.position')));
control("the rows host loses its id", "S38", edit("edit.html", (s) => s.replace('<div id="linksList" class="link-list"></div>', '<div class="link-list"></div>')));
control("the panel loses its id", "S38", edit("edit.html", (s) => s.replace('<div id="linksPanel" hidden', "<div hidden")));
control("the check answer accepts extra keys", "S38", edit("js/api.js", (s) => s.replace("Object.keys(d).length === 2 && isStr(d.go_url)", "isStr(d.go_url)")));
control("the check answer accepts any address", "S38", edit("js/api.js", (s) => s.replace("isStr(d.go_url) && isHttpsTicket(d.go_url)", "isStr(d.go_url)")));
control("a link row may carry a url key", "S38", edit("js/api.js", (s) => s.replace('"check_status", "check_http"];', '"check_status", "check_http", "url"];')));
control("the edit answer's key list is dropped", "S38", edit("js/api.js", (s) => s.replace("Object.keys(d).every((k) => LINK_OP_KEYS.includes(k)) && ", "")));
control("the check call goes to another function", "S38", edit("js/api.js", (s) => s.replace('call("check-destination-link", { posting_id: postingId, position }', 'call("check-destination-links", { posting_id: postingId, position }')));
control("the check call says who is asking", "S38", edit("js/api.js", (s) => s.replace('call("check-destination-link", { posting_id: postingId, position }', 'call("check-destination-link", { posting_id: postingId, poster_id: postingId, position }')));
control("the remove call changes", "S38", edit("js/api.js", (s) => s.replace('{ posting_id: postingId, kind: "apply", op: "remove", position }', '{ posting_id: postingId, op: "remove", position }')));
control("the check button loses the link number", "S38", edit(MODEL, (s) => s.replace('checkAria = (n) => "Check Link " + n', 'checkAria = (n) => "Check link"')));
control("the Remove button is renamed", "S38", edit(MODEL, (s) => s.replace('REMOVE: "Remove"', 'REMOVE: "Delete"')));
control("a labelled row loses its number in the row title", "S38", edit(MODEL, (s) => s.replace("title: linkTitle(x.position, label),", "title: label || linkName(x.position),")));
control("the title form drops the number for a labelled row", "S38", edit(MODEL, (s) => s.replace("linkName(position) + (typeof label", '(typeof label === "string" && label.trim() !== "" ? "" : linkName(position)) + (typeof label')));
control("the edit dialog title drops the label form", "S38", edit(MODEL, (s) => s.replace('editTitle: (n, label) => "Replace the address for " + linkTitle(n, label),', 'editTitle: (n) => "Replace the address for Link " + n,')));
control("the remove question drops the label form", "S38", edit(MODEL, (s) => s.replace('removeConfirm: (n, label) => "Remove " + linkTitle(n, label) + "?', 'removeConfirm: (n) => "Remove Link " + n + "?')));
control("the panel stops passing the label to the confirm sentence", "S38", edit(PANEL, (s) => s.replace("confirmText(row.position, plan, row.label)", "confirmText(row.position, plan)")));
control("the remove question changes", "S38", edit(MODEL, (s) => s.replace("Candidates will no longer see it.", "Candidates will not see it.")));
control("the blocked sentence changes", "S38", edit(MODEL, (s) => s.replace("Your browser blocked the new tab.", "Your browser blocked the tab.")));
control("rows include the recruiter firms", "S38", edit(MODEL, (s) => s.replace("for (const x of applyLinks(", "for (const x of (")));
control("the edit page stops mounting the panel", "S38", edit("js/pages/edit.js", (s) => s.replace("linkPanel.render(doc.destination_links);", "")));
control("the edit page draws the old stored sentence", "S38", append("js/pages/edit.js", '$("#linksStored");'));
control("a row action stops using the stored position", "S38", edit(PANEL, (s) => s.replace("api.removeDestinationLink(ctx.getPostingId(), row.position)", "api.removeDestinationLink(ctx.getPostingId(), 1)")));
control("the panel row style is dropped", "S38", edit("app.css", (s) => s.replace(".link-row{display:flex;", ".link-row{display:grid;")));
control("the privacy page stops saying comments are anonymous", "S29", edit("privacy.html", (s) => s.replace("never who wrote it", "and who wrote it")));
control("the stage gate stops checking the host (it would run on the real site)", "S30", edit("js/stage-gate.js", (s) => s.replace("if (location.hostname !== HOST) return;", "if (false) return;")));
control("the stage gate is bound to the wrong host", "S30", edit("js/stage-gate.js", (s) => s.replace('HOST = "stage.fightghostjobs.com"', 'HOST = "fightghostjobs.com"')));
control("the stage gate loses its MUST NOT SHIP flag", "S30", edit("js/stage-gate.js", (s) => s.replace("MUST NOT SHIP", "may ship")));
control("a page loses the stage gate", "S30", edit("search.html", (s) => s.replace('<script src="js/stage-gate.js"></script>', "")));
control("a page loads the stage gate at the end of the body (data would show first)", "S30", edit("search.html", (s) => s.replace('<script src="js/stage-gate.js"></script>\n', "").replace("</body>", '<script src="js/stage-gate.js"></script></body>')));
control("the team page loses its add form", "S24", edit("team.html", (s) => s.replace('id="addForm"', 'id="addFormX"')));
control("the team page no longer removes through the API", "S24", edit("js/pages/team.js", (s) => s.replace("api.rosterRemove(", "api.somethingElse(")));
control("the edit page has no change note input", "S19", edit("edit.html", (s) => s.replace('<input id="note" type="text" maxlength="500"', '<input id="notx" type="text" maxlength="500"')));
control("the register hint loses the approved wording", "S18", edit("register.html", (s) => s.replace("Required. Your own reference, such as your ATS number.", "Not shown to candidates.")));
control("the register hint stops telling employers the req is masked", "S18", edit("register.html", (s) => s.replace("They see it masked (for example FGJ****45)", "They see it")));
control("a free-text location input comes back", "S16", edit("register.html", (s) => s.replace('<div id="locpicker"', '<div><input id="loc" type="text"></div><div id="locpicker"')));
control("the area cap drifts (4)", "S16", edit("js/location-rules.js", (s) => s.replace("areas: 3, states: 10", "areas: 4, states: 10")));
control("the state cap drifts (12)", "S16", edit("js/location-rules.js", (s) => s.replace("states: 10 }", "states: 12 }")));
control("the attribution is removed", "S16", edit("register.html", (s) => s.replace("licensed CC BY 4.0", "licensed")));
control("the statement is reworded", "S16", edit("register.html", (s) => s.replace("not separate openings.", "and that is fine.")));
control("the statement checkbox loses its id", "S16", edit("register.html", (s) => s.replace('id="attest" type="checkbox"', 'type="checkbox"')));
control("the picker is not a combobox", "S16", edit("register.html", (s) => s.replace('role="combobox" ', "")));
control("the catalog module is edited by hand", "S16", append("js/data/locations-us.js", "// tampered"));
control("the seed file is edited by hand", "S16", edit("data/location-catalog-1-d13e1609.json", (s) => s.replace("Austin, TX", "Austin, Texas")));
control("another module loads the catalog directly", "S16", append("js/pages/search.js", 'import("../data/locations-us.js");'));
control("the form sends free-text locations", "S16", edit("js/register-form.js", (s) => s.replace("  if (chosen.length) body.location_ids", "  body.locations = chosen.map((c) => c.display);\n  if (chosen.length) body.location_ids")));
control("the form stops sending the statement", "S16", edit("js/register-form.js", (s) => s.replace("body.locations_attested = v.attested === true;", "")));
control("the catalog is loaded eagerly", "S16", edit("js/location-catalog.js", (s) => s.replace('import("./data/locations-us.js")', "Promise.resolve({})")));
control("the window input is removed", "S15", edit("register.html", (s) => s.replace('id="livedays"', 'id="somethingelse"')));
control("the window input defaults to 60", "S15", edit("register.html", (s) => s.replace('value="45" autocomplete', 'value="60" autocomplete')));
control("the extended tier appears in the form", "S15", edit("register.html", (s) => s.replace("How long it stays live:", "Extended tier: staff review. How long it stays live:")));
// S32 pass 5: the paid tier wording cannot come back; S35 (TEMPORARY, John 2026-09-30): no analytics or reporting tier claim; S36: contest wording confined to the comments page, no dispute or cross-posting comment claim
control("the home page says the paid tier again", "S32", edit("index.html", (s) => s.replace("The destination links tier adds destination links.", "The paid tier adds destination links.")));
control("a page says paid plan", "S32", append("register.html", "<p>The paid plan adds links.</p>"));
control("the home tier sentence is reworded away from the approved one (not pinned any more)", "S32", edit("index.html", (s) => s.replace("The destination links tier adds destination links.", "The extra tier adds destination links.")));
control("the analytics page heading says analytics is free", "S35", edit("analytics.html", (s) => s.replace('<div class="eyebrow">Analytics</div>', '<div class="eyebrow">Analytics, free on every tier</div>')));
control("a page says analytics is part of the destination links tier", "S35", append("register.html", "<p>Analytics are part of the destination links tier.</p>"));
control("a script string says employer reporting is a paid feature", "S35", append("js/pages/analytics.js", 'const tierNote = "Employer reporting is a paid feature";'));
control("a page says click analytics are included on every tier", "S35", append("dashboard.html", "<p>Impression and click analytics are included on every tier.</p>"));
control("the employer note goes back to having a comment looked at", "S36", edit("comments.html", (s) => s.replace("This page shows the comments on this one opening.", "To have one looked at, write to us with the Opening ID.")));
control("a page says an employer can contest a comment", "S36", append("dashboard.html", "<p>You can contest a comment about your company.</p>"));
control("a page says employers can dispute comments", "S36", append("register.html", "<p>Employers may dispute comments on their openings.</p>"));
control("a script string says an employer sees comments across all their openings", "S36", append("js/pages/dashboard.js", 'const cNote = "Read the comments across all your openings in one place";'));
control("the employer note loses the one-posting statement", "S36", edit("comments.html", (s) => s.replace("This page shows the comments on this one opening.", "Comments appear here.")));
// S36 (rewritten 2026-10-02, item A): the contest notice, the six reasons, the owner-only control, no editing, no hide or delete, no promised response time, the privacy sentence
const NOTICE_TXT = "This comment has been contested by the employer and is under review. It may be removed after additional investigation, at the sole discretion of FightGhostJobs.com.";
control("the notice is reworded in its one place", "S36", edit("js/comments-model.js", (s) => s.replace("after additional investigation, at the sole discretion", "after a review, at the discretion")));
control("the notice gets 'employer/poster' back", "S36", edit("js/comments-model.js", (s) => s.replace("contested by the employer and is under review", "contested by the employer/poster and is under review")));
control("the notice is copied into a page script", "S36", append("js/pages/comments.js", "const _copy = \"" + NOTICE_TXT + "\";"));
control("the notice is copied into comments.html", "S36", edit("comments.html", (s) => s.replace("</main>", "<p>" + NOTICE_TXT + "</p></main>")));
control("a reworded copy of the notice appears in another script", "S36", append("js/pages/dashboard.js", "const _n = 'Contested; the sole discretion of FightGhostJobs.com applies';"));
control("the page stops handing comments to the contest parts", "S36", edit("js/pages/comments.js", (s) => s.replace("addContestPart({ mode: state.mode, comment: c, api, card, after: body, meta, limits: state.contestLimits, onAuthFailure: employerSessionEnded });", "")));
control("the notice is shown to candidates only", "S36", edit("js/contest-ui.js", (s) => s.replace("if (comment.contested) card.append(contestNotice({ employer, since: employer ? comment.contest_filed_at : null }));", 'if (comment.contested && !employer) card.append(contestNotice({ employer, since: null }));')));
control("the notice is shown to the owner only", "S36", edit("js/contest-ui.js", (s) => s.replace("if (comment.contested) card.append(contestNotice({ employer, since: employer ? comment.contest_filed_at : null }));", 'if (comment.contested && employer) card.append(contestNotice({ employer, since: comment.contest_filed_at }));')));
control("the notice block shows the text to the owner only", "S36", edit("js/contest-ui.js", (s) => s.replace('h("p", { class: "contest-notice-text" }, CONTEST_NOTICE)', 'employer ? h("p", { class: "contest-notice-text" }, CONTEST_NOTICE) : null')));
control("the notice block shows its own text instead of the shared one", "S36", edit("js/contest-ui.js", (s) => s.replace('h("p", { class: "contest-notice-text" }, CONTEST_NOTICE)', 'h("p", { class: "contest-notice-text" }, "Contested.")')));
control("the notice has no visible border", "S36", edit("app.css", (s) => s.replace(".contest-notice{border:2px solid var(--ember-dark);", ".contest-notice{border:0 solid var(--ember-dark);")));
control("a reason label is reworded", "S36", edit("js/comments-model.js", (s) => s.replace('label: "Abusive language"', 'label: "Rude language"')));
control("a seventh reason is added", "S36", edit("js/comments-model.js", (s) => s.replace('  { code: "other", label: "Other" },', '  { code: "spam", label: "Spam" },\n  { code: "other", label: "Other" },')));
control("a reason is removed", "S36", edit("js/comments-model.js", (s) => s.replace('  { code: "not_about_posting", label: "Not about this opening" },\n', "")));
control("the reasons change order", "S36", edit("js/comments-model.js", (s) => s.replace('  { code: "abusive", label: "Abusive language" },\n  { code: "other", label: "Other" },', '  { code: "other", label: "Other" },\n  { code: "abusive", label: "Abusive language" },')));
control("a reason code is changed", "S36", edit("js/comments-model.js", (s) => s.replace('code: "closed_or_outdated"', 'code: "closed"')));
control("the dropdown is hard-coded instead of built from the list", "S36", edit("js/contest-ui.js", (s) => s.replace('CONTEST_CATEGORIES.map((c) => h("option", { value: c.code }, c.label))', 'h("option", { value: "other" }, "Other")')));
control("the dropdown sends the label instead of the code", "S36", edit("js/contest-ui.js", (s) => s.replace('h("option", { value: c.code }, c.label)', 'h("option", { value: c.label }, c.label)')));
control("the first-display limits drift", "S36", edit("js/comments-model.js", (s) => s.replace("Object.freeze({ min: 30, max: 1000 })", "Object.freeze({ min: 10, max: 5000 })")));
control("the form stops taking its limits from the server", "S36", edit("js/contest-ui.js", (s) => s.replace("Object.assign(limits, contestLimits(r.error, limits)); ", "")));
control("the already-contested message is reworded", "S36", edit("js/comments-model.js", (s) => s.replace("has already been contested and cannot be contested again.", "was contested before.")));
control("the form loses the visible explanation label", "S36", edit("js/contest-ui.js", (s) => s.replace('h("label", { for: uid + "-why" }, "Explanation"), ', "")));
control("the contest control is offered to candidates too", "S36", edit("js/contest-ui.js", (s) => s.replace("if (employer && comment.contest_state === \"none\") mountContest(", 'if (comment.contest_state === "none") mountContest(')));
control("the contest control is offered while a contest is open", "S36", edit("js/contest-ui.js", (s) => s.replace("if (employer && comment.contest_state === \"none\") mountContest(", 'if (employer && comment.contest_state !== "left" && comment.contest_state !== "removed") mountContest(')));
control("the contest control is mounted a second time (candidate view)", "S36", edit("js/pages/comments.js", (s) => s.replace('const form = h("form", { novalidate: true, hidden: true, style: "display:flex;flex-direction:column;gap:8px;margin-top:6px;" });', 'const form = h("form", { novalidate: true, hidden: true, style: "display:flex;flex-direction:column;gap:8px;margin-top:6px;" }); mountContest({ api, comment: c, card, after: body, meta, limits: state.contestLimits });')));
control("another page mounts the contest control", "S36", append("js/pages/search.js", 'import { mountContest } from "../contest-ui.js";'));
control("another page calls the contest function", "S36", append("js/pages/dashboard.js", 'const _c = (api) => api.contestComment(1, "other", "x");'));
control("the comments page calls the contest function itself", "S36", append("js/pages/comments.js", 'const _d = () => api.contestComment(1, "other", "x");'));
control("the contest request names a poster", "S36", edit("js/api.js", (s) => s.replace('call("contest-comment", { comment_id: commentId, category, explanation }', 'call("contest-comment", { comment_id: commentId, category, explanation, poster_id: "x" }')));
control("the contest control names an organization", "S36", append("js/contest-ui.js", 'const _o = { organization_id: "x" };'));
control("a comment item no longer needs the contest fields", "S36", edit("js/api.js", (s) => s.replace("isStr(c.created_at) && shapes.contestFields(c)", "isStr(c.created_at) && isBool(c.contested)")));
// item A, step 3b: the four contest states in both views, the filing date, fail closed on the new reader keys
control("the page hands comments to the contest parts twice", "S36", edit("js/pages/comments.js", (s) => s.replace("addContestPart({ mode: state.mode, comment: c, api, card, after: body, meta, limits: state.contestLimits, onAuthFailure: employerSessionEnded });", "addContestPart({ mode: state.mode, comment: c, api, card, after: body, meta, limits: state.contestLimits, onAuthFailure: employerSessionEnded }); addContestPart({ mode: state.mode, comment: c, api, card, after: body, meta, limits: state.contestLimits, onAuthFailure: employerSessionEnded });")));
control("the page shows the notice itself again", "S36", edit("js/pages/comments.js", (s) => s.replace("addContestPart({ mode: state.mode, comment: c, api, card, after: body, meta, limits: state.contestLimits, onAuthFailure: employerSessionEnded });", "addContestPart({ mode: state.mode, comment: c, api, card, after: body, meta, limits: state.contestLimits, onAuthFailure: employerSessionEnded }); if (c.contested) card.append(contestNotice({ employer: false }));")));
control("the filing date is dropped from the owner's notice", "S36", edit("js/contest-ui.js", (s) => s.replace("since: employer ? comment.contest_filed_at : null", "since: null")));
control("the filing date goes to every view", "S36", edit("js/contest-ui.js", (s) => s.replace("since: employer ? comment.contest_filed_at : null", "since: comment.contest_filed_at")));
control("the contest control is offered after a decision (left or removed)", "S36", edit("js/contest-ui.js", (s) => s.replace("if (employer && comment.contest_state === \"none\") mountContest(", 'if (employer && comment.contest_state !== "open") mountContest(')));
control("the decided sentence is shown to candidates too", "S36", edit("js/contest-ui.js", (s) => s.replace("if (employer && (comment.contest_state === \"left\" || comment.contest_state === \"removed\")) card.append(contestDecided());", "if ((comment.contest_state === \"left\" || comment.contest_state === \"removed\")) card.append(contestDecided());")));
control("the decided sentence is shown for left only", "S36", edit("js/contest-ui.js", (s) => s.replace("if (employer && (comment.contest_state === \"left\" || comment.contest_state === \"removed\")) card.append(contestDecided());", 'if (employer && comment.contest_state === "left") card.append(contestDecided());')));
control("the decided sentence is shown for removed only", "S36", edit("js/contest-ui.js", (s) => s.replace("if (employer && (comment.contest_state === \"left\" || comment.contest_state === \"removed\")) card.append(contestDecided());", 'if (employer && comment.contest_state === "removed") card.append(contestDecided());')));
control("a decided contest still shows the notice to the owner", "S36", edit("js/contest-ui.js", (s) => s.replace("if (employer && (comment.contest_state === \"left\" || comment.contest_state === \"removed\")) card.append(contestDecided());", "if (employer && (comment.contest_state === \"left\" || comment.contest_state === \"removed\")) { card.append(contestNotice({ employer, since: comment.contest_filed_at })); card.append(contestDecided()); }")));
control("the decided sentence is not shown at all", "S36", edit("js/contest-ui.js", (s) => s.replace("if (employer && (comment.contest_state === \"left\" || comment.contest_state === \"removed\")) card.append(contestDecided());", "")));
control("the decided sentence is reworded in the screen part", "S36", edit("js/contest-ui.js", (s) => s.replace('alertBox("notice", CONTEST_ALREADY)', 'alertBox("notice", "This comment was decided.")')));
control("the already-contested sentence is copied into a page script", "S36", append("js/pages/comments.js", 'const _ac = "This comment has already been contested and cannot be contested again.";'));
control("the already-contested sentence is copied into comments.html", "S36", edit("comments.html", (s) => s.replace("</main>", "<p>This comment has already been contested.</p></main>")));
control("another script shows the contest notice", "S36", append("js/pages/dashboard.js", 'import { contestNotice } from "../contest-ui.js";'));
control("another script shows the decided sentence", "S36", append("js/pages/dashboard.js", 'import { contestDecided } from "../contest-ui.js";'));
control("the screen part uses the decided sentence a second time", "S36", append("js/contest-ui.js", 'const _d2 = () => contestDecided();'));
control("the contest states list loses removed", "S36", edit("js/api.js", (s) => s.replace('["none", "open", "left", "removed"]', '["none", "open", "left"]')));
control("a comment item stops checking the state", "S36", edit("js/api.js", (s) => s.replace("isBool(c.contested) && CONTEST_STATES.includes(c.contest_state)", "isBool(c.contested)")));
control("a comment item stops checking the filing time", "S36", edit("js/api.js", (s) => s.replace("isNullable(c.contest_filed_at, (v) => isStr(v) && Number.isFinite(Date.parse(v)))", "true")));
control("a comment item stops checking none against a null filing time", "S36", edit("js/api.js", (s) => s.replace('(c.contest_state === "none") === (c.contest_filed_at === null)', "true")));
control("a comment item stops checking contested against an open state", "S36", edit("js/api.js", (s) => s.replace('c.contested === (c.contest_state === "open")', "true")));
control("api.js grows a hide-comment call", "S36", edit("js/api.js", (s) => s.replace("    contestComment: async", "    hideComment: (id) => call(\"hide-comment\", { comment_id: id }),\n    contestComment: async")));
control("api.js grows an edit-comment call", "S36", edit("js/api.js", (s) => s.replace("    contestComment: async", "    editComment: (id, body) => call(\"edit-comment\", { comment_id: id, body }),\n    contestComment: async")));
control("comments.html says edit your comment", "S36", edit("comments.html", (s) => s.replace("</main>", "<p>You can edit your comment for ten minutes.</p></main>")));
control("a script string says Edited by the author", "S36", append("js/pages/comments.js", 'const _e = "Edited by the author";'));
control("the contest form says the comment was modified", "S36", edit("js/comments-model.js", (s) => s.replace("A comment can be contested only once.", "A modified comment can be contested only once.")));
control("the page shows the original text", "S36", append("js/contest-ui.js", 'const _t = "Original text";'));
control("the form says amended", "S36", append("js/contest-ui.js", 'const _a = "Your explanation can be amended later";'));
control("a page says a comment was edited", "S36", append("dashboard.html", "<p>The comment was edited by the author.</p>"));
control("the comments page gets a Hide this comment button", "S36", edit("js/contest-ui.js", (s) => s.replace('"Go back")', '"Hide this comment")')));
control("the comments page gets a Delete button in markup", "S36", edit("comments.html", (s) => s.replace('<div id="employerNote"', '<button type="button">Delete this comment</button><div id="employerNote"')));
control("the owner is offered to remove a comment", "S36", append("js/pages/comments.js", 'const _r = "Remove this comment";'));
control("the owner is offered to disable a comment", "S36", append("js/pages/comments.js", 'const _s = "Disable this comment";'));
control("the confirm step promises a response time", "S36", edit("js/comments-model.js", (s) => s.replace("while FightGhostJobs.com reviews it.", "while FightGhostJobs.com reviews it within two business days.")));
control("a message promises a quick decision", "S36", append("js/contest-ui.js", 'const _q = "We will decide quickly";'));
control("the privacy page promises a response time", "S36", edit("privacy.html", (s) => s.replace("FightGhostJobs.com decides whether it stays or is removed", "FightGhostJobs.com decides within 5 days whether it stays or is removed")));
control("the privacy sentence is removed", "S36", edit("privacy.html", (s) => s.replace('id="privacyContests"', 'id="privacyContestsX"')));
control("the privacy sentence stops saying the explanation is kept", "S36", edit("privacy.html", (s) => s.replace("kept in the review record", "discarded")));
control("the privacy sentence stops saying who decides", "S36", edit("privacy.html", (s) => s.replace("FightGhostJobs.com decides whether it stays or is removed", "the comment may change")));
control("the privacy sentence stops saying the comment stays visible", "S36", edit("privacy.html", (s) => s.replace("stays visible with a notice while it is under review", "is hidden while it is under review")));
control("the privacy sentence says candidates see the explanation", "S36", edit("privacy.html", (s) => s.replace("not shown to candidates", "shown to candidates")));
control("a script says employers can challenge a comment", "S36", append("js/pages/dashboard.js", 'const _ch = "Challenge a comment about your company";'));
control("a script says an employer can reply to a comment", "S36", append("js/pages/dashboard.js", 'const _rp = "Reply to a comment from here";'));
control("the dashboard offers to contest a comment", "S36", append("js/pages/dashboard.js", 'const _ct = "Contest a comment on this opening";'));
// S32: public wording (2026-09-30)
control("the search badge goes back to Verified", "S32", edit("js/pages/search.js", (s) => s.replace('"\u2713 Registered"', '"\u2713 Verified"')));
control("the details dialog says the listing is verified again", "S32", edit("js/pages/search.js", (s) => s.replace("This opening was added through FightGhostJobs by the employer.", "This listing is verified: a real employer registered it directly with FightGhostJobs.")));
control("the details dialog loses what FightGhostJobs has not confirmed", "S32", edit("js/pages/search.js", (s) => s.replace(", that the employer representative works for the company named, or that the employer will respond.", ".")));
control("the sample card badge says Verified again", "S32", edit("index.html", (s) => s.replace('<div class="pill badge-verified">\u2713 Registered</div>', '<div class="pill badge-verified">\u2713 Verified</div>')));
control("the home pill says a free public registry again", "S32", edit("index.html", (s) => s.replace(">A place to check job openings that employers disclose</div>", ">A free public registry</div>")));
control("the home page promises free, always", "S32", edit("index.html", (s) => s.replace(">to add and disclose</div>", ">to add and disclose, always</div>")));
control("the home page says permanently", "S32", edit("index.html", (s) => s.replace("Included on every tier.", "Free, on every tier, permanently.")));
control("the home page says it costs nothing", "S32", edit("index.html", (s) => s.replace("Show candidates the facts about your opening. The core facts are free to publish.", "Prove your listing is real. It costs nothing to start.")));
control("the home page says free, forever", "S32", edit("index.html", (s) => s.replace("The facts candidates see are free for employers to publish on every tier", "Every trust field is free, forever")));
control("the register page label goes back to Free, always", "S32", edit("register.html", (s) => s.replace(">Free on every tier</div>", ">Free, always</div>")));
control("the search page signup line says no cost again", "S32", edit("search.html", (s) => s.replace("No password, no account form. Free for job seekers.", "No password, no account form, no cost.")));
control("the search page says company and title always works", "S32", edit("search.html", (s) => s.replace("<li>The most exact way to search:", "<li>Company and title always works:")));
control("the Opening ID help says verified opening again", "S32", edit("search.html", (s) => s.replace("this specific opening", "this specific verified opening")));
control("the no-match note says a missing opening is worth knowing", "S32", edit("js/search-input.js", (s) => s.replace("A missing opening may simply not be added; it says nothing about whether the job exists.", "A real employer registers it, so a missing opening is itself worth knowing.")));
control("the paused message says the employer confirmed it", "S32", edit("js/chips.js", (s) => s.replace("The employer has paused it, so it is not accepting", "The employer has confirmed it, but it is not accepting")));
control("the no-link message says not any less real", "S32", edit("js/pages/search.js", (s) => s.replace("That's their choice to make.\"", "That's their choice to make, not a sign the opening is any less real.\"")));
control("a real employer sentence is appended to a page", "S32", append("comments.html", "<p>Disclosed by a real employer</p>"));
control("the requirements hint goes back to always tell (S19 pins the new wording)", "S19", edit("edit.html", (s) => s.replace("so candidates can tell which role", "so candidates can always tell which role")));
// S33: links (2026-09-30)
control("a mailto to an address that is not approved", "S33", edit("comments.html", (s) => s.replace("</main>", '<p><a href="mailto:info@fightghostjobs.com">info@fightghostjobs.com</a></p></main>')));
control("a mailto whose text does not say it opens an email", "S33", edit("comments.html", (s) => s.replace("</main>", '<p><a href="mailto:sales@fightghostjobs.com">See what is included</a></p></main>')));
control("the pricing card link is a mailto again", "S33", edit("register.html", (s) => s.replace('<a class="hit" href="https://www.fightghostjobs.com/plans.html" style="display:inline-block', '<a class="hit" href="mailto:sales@fightghostjobs.com?subject=Destination%20links%20tier" style="display:inline-block')));
control("the pricing card link points somewhere else", "S33", edit("register.html", (s) => s.replace('href="https://www.fightghostjobs.com/plans.html"', 'href="https://www.fightghostjobs.com/index.html"')));
control("the pricing card link is removed", "S33", edit("register.html", (s) => s.replace(/<a class="hit" href="https:\/\/www\.fightghostjobs\.com\/plans\.html"[^>]*>See what's included \u2192<\/a>/, "")));
control("a link with # as its target", "S33", edit("team.html", (s) => s.replace("</main>", '<p><a href="#">More</a></p></main>')));
control("a link with an empty target", "S33", edit("team.html", (s) => s.replace("</main>", '<p><a href="">More</a></p></main>')));
control("a javascript: link", "S33", edit("team.html", (s) => s.replace("</main>", '<p><a href="javascript:void(0)">More</a></p></main>')));
control("a tel link", "S33", edit("team.html", (s) => s.replace("</main>", '<p><a href="tel:+15555550100">+1 555 555 0100</a></p></main>')));
control("an internal link to a page that does not exist", "S33", edit("search.html", (s) => s.replace("</main>", '<p><a href="pricing.html">Pricing</a></p></main>')));
control("an anchor to an id that is not on the page", "S33", edit("search.html", (s) => s.replace("</main>", '<p><a href="#nowhere">Jump</a></p></main>')));
control("an anchor to an id that is not on the page it names", "S33", edit("search.html", (s) => s.replace("</main>", '<p><a href="register.html#nowhere">Jump</a></p></main>')));
control("a new-tab link without noopener", "S33", edit("privacy.html", (s) => s.replace("</main>", '<p><a href="https://www.fightghostjobs.com/" target="_blank">Site</a></p></main>')));
control("an external link to an unapproved host", "S33", edit("privacy.html", (s) => s.replace("</main>", '<p><a href="https://example.com/">Elsewhere</a></p></main>')));
control("a link about the tiers that is a mailto", "S33", edit("team.html", (s) => s.replace("</main>", '<p><a href="mailto:sales@fightghostjobs.com">Compare the tiers at sales@fightghostjobs.com</a></p><p><a href="mailto:sales@fightghostjobs.com">Compare each tier</a></p></main>')));
control("a script builds a link with # as its target", "S33", append("js/pages/team.js", 'const _x = { href: "#" };'));
control("a script builds a mailto to an unapproved address", "S33", append("js/pages/team.js", 'const _y = "mailto:info@fightghostjobs.com";'));
control("a script points at a page that does not exist", "S33", append("js/pages/team.js", 'const _z = "pricing.html";'));
control("the old tier name returns in a page", "S32", edit("edit.html", (s) => s.replace("part of the destination links tier.", "part of the verified plan.")));
control("the old tier name returns in a script message", "S32", edit("js/pages/edit.js", (s) => s.replace("Your destination links tier ended.", "Your verified plan ended.")));
control("the old tier name returns as a label", "S32", edit("register.html", (s) => s.replace(">Destination links tier</div>", ">Verified tier</div>")));
// S34: no editable company field (2026-09-30)
control("an editable company input is added back to the register form", "S34", edit("register.html", (s) => s.replace('<div id="companyShown"', '<input id="company" type="text"><div id="companyShown"')));
control("a company control with another name is added to the register form", "S34", edit("register.html", (s) => s.replace('<div id="companyShown"', '<input name="companyName" type="text"><div id="companyShown"')));
control("a company textarea is added to the edit page", "S34", edit("edit.html", (s) => s.replace("</main>", '<textarea id="company"></textarea></main>')));
control("the read-only display is removed", "S34", edit("register.html", (s) => s.replace(/<div id="companyShown"[^>]*><\/div>/, "")));
control("the read-only display turns into an input", "S34", edit("register.html", (s) => s.replace('<div id="companyShown" style="', '<input id="companyShown" style="').replace("min-height:20px;\"></div>", 'min-height:20px;">')));
control("the form code sends a company name again", "S34", edit("js/register-form.js", (s) => s.replace("    tier: \"standard\",", "    company_name: String(v.company).trim(),\n    tier: \"standard\",")));
control("the form code asks for a company name again", "S34", edit("js/register-form.js", (s) => s.replace('  need("closeout", v.closeout, "what ends this opening");', '  need("company", v.company, "the company name");\n  need("closeout", v.closeout, "what ends this opening");')));
control("the page reads a company value from the form again", "S34", edit("js/pages/register.js", (s) => s.replace('req: val("#req"), locEntries:', 'req: val("#req"), company: val("#company"), locEntries:')));
control("the page stops showing the organization's name", "S34", edit("js/pages/register.js", (s) => s.replace('$("#companyShown").textContent = ctx.info.organization.name;', "")));
// S37 (2026-10-03): the not-open comments page, the hidden link picker, the single countdown
control("the paused heading says no longer open again", "S37", edit("js/chips.js", (s) => s.replace('? "This opening is paused" :', '? "This opening is no longer open" :')));
control("the paused heading is defined a second time", "S37", append("js/pages/search.js", 'const _ph = "This opening is paused";'));
control("the paused sentence becomes the long sentence", "S37", edit("js/chips.js", (s) => s.replace('? "Comments stay open." :', '? "Comments stay open: what happened after it closed is exactly what other candidates want to know." :')));
control("the paused sentence is dropped", "S37", edit("js/chips.js", (s) => s.replace('? "Comments stay open." :', '? "" :')));
control("the closed heading changes", "S37", edit("js/chips.js", (s) => s.replace(': "This opening is no longer open";', ': "This opening is closed";')));
control("the closed and expired sentence loses a word", "S37", edit("js/chips.js", (s) => s.replace("is exactly what other candidates want to know.", "is what other candidates want to know.")));
control("expired gets the paused wording", "S37", edit("js/chips.js", (s) => s.replace('status === "paused" ? "This opening is paused" :', 'status === "paused" || status === "expired" ? "This opening is paused" :')));
control("the option B sentence is added to the page", "S37", append("js/pages/comments.js", 'const _b = "This opening is paused, so its links are not listed. You can still tell us about a link you followed from it.";'));
control("the option B sentence is added to the markup", "S37", edit("comments.html", (s) => s.replace('<label id="reportLinkLabel"', '<p>You can still tell us about a link you followed from it.</p><label id="reportLinkLabel"')));
control("the page writes the not-open heading itself again", "S37", edit("js/pages/comments.js", (s) => s.replace("nr.title;", '"This opening is no longer open";')));
control("the page stops using the not-open helper", "S37", edit("js/pages/comments.js", (s) => s.replace("notOpenRecap(d.data.status", "notOpenRecap(d.status")));
control("the link label stops being hidden", "S37", edit("js/pages/comments.js", (s) => s.replace('$("#reportLinkLabel").hidden = !picker;', "")));
control("the link dropdown stops being hidden", "S37", edit("js/pages/comments.js", (s) => s.replace("sel.hidden = !picker;", "")));
control("the link label loses its id", "S37", edit("comments.html", (s) => s.replace('<label id="reportLinkLabel" for="reportLink"', '<label for="reportLink"')));
control("the comment button ticks again", "S37", edit("js/pages/comments.js", (s) => s.replace("button.textContent = idleLabel;\n  state.cooldownTimer", 'button.textContent = "Wait " + seconds + "s";\n  state.cooldownTimer')));
control("the comment button gets a one-second timer again", "S37", append("js/pages/comments.js", "const _t = setInterval(() => {}, 1000);"));
control("the reportLink element is removed from the markup", "S29", edit("comments.html", (s) => s.replace('<select id="reportLink" aria-label="Which link"></select>', "")));
// S40: the candidate search screen (one specific job; exact IDs first; title is the labelled fallback; guidance is real text wired to the inputs; a short title is left to the backend)
control("the search page loses its one-specific-job sentence", "S40", edit("search.html", (s) => s.replace("Search for one specific job you already know about.", "Search for jobs.")));
control("the search page loses the easiest-and-most-exact sentence", "S40", edit("search.html", (s) => s.replace("Easiest and most exact: the company name plus the requisition (req) number or the Opening ID", "Search by the company name plus the requisition (req) number or the Opening ID")));
control("the search page loses the no-ID title fallback sentence", "S40", edit("search.html", (s) => s.replace("No ID? Use the company name plus part of the job title, copied from the job ad if you can.", "Or use a job title.")));
control("the search page loses the company-name sentence", "S40", edit("search.html", (s) => s.replace("We ignore endings like Inc., Co. and LLC.", "")));
control("the search page loses the title-search limits sentence", "S40", edit("search.html", (s) => s.replace("and it will not show openings that are not live. Closed or expired openings are found only by Opening ID or req number.", "and it shows every opening.")));
control("the search page loses the one-lookup-box sentence", "S40", edit("search.html", (s) => s.replace("Company is required. Then fill in one of the other two boxes:", "Fill in the boxes:")));
control("the search form gains a fourth box (a way to browse)", "S40", edit("search.html", (s) => s.replace('<button type="submit" id="searchBtn"', '<input id="browse" type="text"><button type="submit" id="searchBtn"')));
control("the search form puts the title box before the req number", "S40", edit("search.html", (s) => { const L = s.split(String.fromCharCode(10)), pair = L.findIndex((l) => l.includes('class="srch-pair"')), or = L.findIndex((l) => l.includes('class="srch-or"')), btn = L.findIndex((l) => l.includes('<button type="submit" id="searchBtn"')); if (pair < 0 || or < pair || btn < or + 3) throw new Error("form shape changed"); return [...L.slice(0, pair + 1), ...L.slice(or + 1, btn - 2), L[or], ...L.slice(pair + 1, or), ...L.slice(btn - 2)].join(String.fromCharCode(10)); }));
control("the title box label goes back to Title or Opening ID", "S40", edit("search.html", (s) => s.replace(">Opening ID, or part of the title\n", ">Title or Opening ID\n")));
control("the company box is no longer described by its hint", "S40", edit("search.html", (s) => s.replace(' aria-describedby="companyHint"', "")));
control("the title box is no longer described by the title note", "S40", edit("search.html", (s) => s.replace('aria-describedby="titleHint reqHint titleNote"', 'aria-describedby="titleHint reqHint"')));
control("the title box points at a note that is not on the page", "S40", edit("search.html", (s) => s.replace('id="titleNote"', 'id="titleNoteGone"')));
control("the req box loses its aria-describedby", "S40", edit("search.html", (s) => s.replace(' aria-describedby="reqCellHint reqHint"', "")));
control("the form error is no longer an alert", "S40", edit("search.html", (s) => s.replace('class="field-error" role="alert" hidden', 'class="field-error" hidden')));
control("the title box loses its label", "S40", edit("search.html", (s) => s.replace('<label for="titleq"', '<span for="titleq"').replace("part of the title\n          <span class", "part of the title\n          <span class")));
control("a 1 or 2 letter title is refused locally again", "S40", edit("js/search-input.js", (s) => s.replace("if (alnumCount(t) < 1) return", "if (alnumCount(t) < 3) return")));
control("a title with no letter or digit is no longer refused locally", "S40", edit("js/search-input.js", (s) => s.replace("if (alnumCount(t) < 1) return", "if (alnumCount(t) < 0) return")));
control("a title over 80 characters is no longer refused locally", "S40", edit("js/search-input.js", (s) => s.replace("if (t.length > 80) return", "if (t.length > 8000) return")));
control("the too-short-title message is reworded", "S40", edit("js/search-input.js", (s) => s.replace("That part of the title is too short to search on its own.", "Title too short.")));
control("the too-short-title message loses the short-forms hint", "S40", edit("js/search-input.js", (s) => s.replace("or a short form like VP, SR or JR if the employer used one.", "")));
control("the page shows the raw backend refusal again", "S40", edit("js/pages/search.js", (s) => s.replace("setFormError(searchErrorMessage(r.error));", 'setFormError(r.error.message || "That search was not accepted.");')));
control("the empty-result note stops saying to check the ID and try another part of the title", "S14", edit("js/search-input.js", (s) => s.replace("Check the company name, and check the ID exactly as it is printed in the job ad. If you searched by title, try a different part of the title.", "Check the company name.")));
control("the empty-result note stops saying closed or expired openings are found by Opening ID or req number", "S14", edit("js/search-input.js", (s) => s.replace("closed or expired openings are found only by Opening ID or req number.", "closed or expired openings are not shown.")));
control("the dashboard loses the place-your-postID-on-your-site sentence", "S40", edit("dashboard.html", (s) => s.replace("it lets candidates find the opening exactly.", "")));
// S45 (2026-10-03): the edit page's unsaved-changes bar, the leave dialog, and the recruiter toggle's wording and place.
{
  const HTML = "edit.html", DS = "js/dirty-state.js", GD = "js/unsaved-guard.js", EJ = "js/pages/edit.js", CSS = "app.css";
  const BAR = /<div id="unsavedBar"[\s\S]*?<\/main>/;
  const TOGGLE_BLOCK = /      <div style="display:flex;align-items:center;justify-content:space-between;">\n        <div>\n          <div style="font-size:14px;font-weight:600;">Third-party recruiter involved<\/div>[\s\S]*?<\/button>\n      <\/div>\n/;
  const FIRMS_BLOCK = /      <div id="firmsPanel"[\s\S]*?\n      <\/div>\n    <\/div>\n\n    <div id="readonlyNote"/;
  control("the unsaved bar is removed", "S45", edit(HTML, (s) => s.replace('id="unsavedBar"', 'id="unsavedBarX"')));
  control("the bar is no longer a polite live region", "S45", edit(HTML, (s) => s.replace('role="status" aria-live="polite" aria-atomic="true"></div>\n<div id="unsavedBar"', 'role="status" aria-atomic="true"></div>\n<div id="unsavedBar"')));
  control("the status region loses role=status", "S45", edit(HTML, (s) => s.replace('class="unsaved-sr" role="status" aria-live="polite"', 'class="unsaved-sr" aria-live="polite"')));
  control("the bar is not hidden until something is unsaved", "S45", edit(HTML, (s) => s.replace('aria-label="Unsaved changes" hidden>', 'aria-label="Unsaved changes">')));
  control("the bar is moved out of <main> (it would sit below the footer's page area)", "S45", edit(HTML, (s) => { const m = s.match(BAR); return s.replace(m[0], "</main>\n" + m[0].replace("</main>", "")); }));
  control("the bar loses its Save changes button", "S45", edit(HTML, (s) => s.replace('id="unsavedSave" class="btn btn-dark btn-sm">Save changes</button>', 'id="unsavedSave" class="btn btn-dark btn-sm">Send</button>')));
  control("the bar loses its Discard button", "S45", edit(HTML, (s) => s.replace('id="unsavedDiscard" class="btn btn-outline btn-sm">Discard</button>', 'id="unsavedDiscard" class="btn btn-outline btn-sm">Reset</button>')));
  control("the leave dialog is no longer an alertdialog", "S45", edit(HTML, (s) => s.replace('role="alertdialog"', 'role="dialog"')));
  control("the leave dialog is not modal", "S45", edit(HTML, (s) => s.replace('role="alertdialog" aria-modal="true"', 'role="alertdialog"')));
  control("the leave dialog loses its description", "S45", edit(HTML, (s) => s.replace(' aria-describedby="leaveText"', "")));
  control("the Stay choice is renamed", "S45", edit(HTML, (s) => s.replace(">Stay on this page</button>", ">Cancel</button>")));
  control("the Discard-and-leave choice is renamed", "S45", edit(HTML, (s) => s.replace(">Discard and leave</button>", ">Leave</button>")));
  control("the Save-and-leave choice is renamed", "S45", edit(HTML, (s) => s.replace(">Save and leave</button>", ">Save</button>")));
  control("the heading can no longer take focus", "S45", edit(HTML, (s) => s.replace('<h1 id="editHeading" tabindex="-1"', '<h1 id="editHeading"')));
  control("the early note rule has no place", "S45", edit(HTML, (s) => s.replace('<div id="noteNeeded" class="field-hint" hidden></div>', "")));
  control("the early title rule has no place", "S45", edit(HTML, (s) => s.replace('<div id="titleRule" class="field-hint" hidden></div>', "")));
  control("the note input is no longer read with the early rule", "S45", edit(HTML, (s) => s.replace('autocomplete="off" aria-describedby="noteNeeded"', 'autocomplete="off"')));
  control("an em dash in the leave dialog", "S45", edit(HTML, (s) => s.replace('<p id="leaveText" class="unsaved-dialog-text"></p>', '<p id="leaveText" class="unsaved-dialog-text">Unsaved — lost</p>')));
  control("the recruiter sentence stops saying naming a firm is optional", "S45", edit(HTML, (s) => s.replace("and adding its links is optional. It belongs", "and adding its links belongs")));
  control("the recruiter sentence drops the pointer to the Destination links section", "S45", edit(HTML, (s) => s.replace("It belongs to the Destination links section below, which is part of the destination links tier.", "It is a destination links tier feature.")));
  control("the old recruiter sentence returns", "S45", edit(HTML, (s) => s.replace("Free for every employer: just say yes or no. Naming the recruiter firm and adding its links is optional. It belongs to the Destination links section below, which is part of the destination links tier.", "The yes/no flag is free. Naming the firm is a destination links tier feature.")));
  control("the recruiter toggle is no longer read with its sentence", "S45", edit(HTML, (s) => s.replace('aria-label="Third-party recruiter involved" aria-describedby="recruiterHint"', 'aria-label="Third-party recruiter involved"')));
  control("the recruiter toggle moves below Save changes", "S45", edit(HTML, (s) => { const m = s.match(TOGGLE_BLOCK); return s.replace(m[0], "").replace("    </form>\n", m[0] + "    </form>\n"); }));
  control("the recruiter firms panel moves above Save changes", "S45", edit(HTML, (s) => { const m = s.match(FIRMS_BLOCK); const block = m[0].replace(/\n    <\/div>\n\n    <div id="readonlyNote"$/, "\n"); return s.replace(m[0], "    </div>\n\n    <div id=\"readonlyNote\"").replace('      <div id="exclusiveRow" hidden>', block + '      <div id="exclusiveRow" hidden>'); }));
  control("the dirty-state headline changes", "S45", edit(DS, (s) => s.replace('HEAD: "You have unsaved changes",', 'HEAD: "Unsaved changes",')));
  control("the dirty-state sentence about Save changes changes", "S45", edit(DS, (s) => s.replace('FORM_DETAIL: "They take effect only when you press Save changes.",', 'FORM_DETAIL: "Press Save.",')));
  control("a section's headline stops saying not saved yet", "S45", edit(DS, (s) => s.replace('out.headline = cap(named) + " not saved yet";', 'out.headline = cap(named) + " changed";')));
  control("the bar claims Save changes covers the sections", "S45", edit(DS, (s) => s.replace('" not saved yet. Save changes does not save " + itThem + ": use the button in " + section + "."', '" not saved yet. Save changes saves " + itThem + " too."')));
  control("the destination links section is renamed", "S45", edit(DS, (s) => s.replace('LINKS: "destination links",', 'LINKS: "links",')));
  control("the title rule says 50 percent", "S45", edit(DS, (s) => s.replace("must keep at least 60% of the wording", "must keep at least 50% of the wording")));
  control("the early note sentence changes", "S45", edit(DS, (s) => s.replace("so a change to it needs a note. Say what changed and why.", "so write something.")));
  control("the leave dialog's Save label changes", "S45", edit(DS, (s) => s.replace('LEAVE_SAVE_AND_LEAVE: "Save and leave"', 'LEAVE_SAVE_AND_LEAVE: "OK"')));
  control("an em dash in the unsaved words", "S45", append(DS, "export const BAD = 'a — b';"));
  control("the guard stops asking the browser before the page is left", "S45", edit(GD, (s) => s.replace('win.addEventListener("beforeunload", onBeforeUnload); listening = true;', "listening = true;")));
  control("the guard never stops asking", "S45", edit(GD, (s) => s.replace('win.removeEventListener("beforeunload", onBeforeUnload); listening = false;', "listening = false;")));
  control("the guard's browser question is not actually raised", "S45", edit(GD, (s) => s.replace('ev.preventDefault(); ev.returnValue = ""; return "";', 'return undefined;')));
  control("Escape in the dialog no longer means Stay", "S45", edit(GD, (s) => s.replace('if (ev.key === "Escape") { ev.preventDefault(); if (!busy) closeDialog(true); return; }', 'if (ev.key === "Escape") { return; }')));
  control("focus does not move into the dialog", "S45", edit(GD, (s) => s.replace("    dlg.stay.focus();\n", "")));
  control("focus does not return after the dialog", "S45", edit(GD, (s) => s.replace("d.returnTo.focus()", "void 0")));
  control("Tab is no longer kept inside the dialog", "S45", edit(GD, (s) => s.replace('if (ev.key === "Tab")', 'if (ev.key === "F13")')));
  control("the page is no longer marked while the bar shows", "S45", edit(GD, (s) => s.replace('root.classList.toggle("unsaved-on", s.any);', "")));
  control("the guard keeps something in storage", "S45", append(GD, "const _k = () => localStorage.setItem('x', 'y');"));
  control("an em dash in the guard", "S45", append(GD, "// a — b"));
  control("the page stops mounting the guard", "S45", edit(EJ, (s) => s.replace("guard = mountUnsavedGuard({", "const unusedGuard = ({")));
  control("the page stops holding back Sign out", "S45", edit(EJ, (s) => s.replace('t.closest("#navAccount button:not(.avatar-btn)")', 't.closest("#navAccountX")')));
  control("the page stops taking a snapshot when an opening is loaded", "S45", edit(EJ, (s) => s.replace("state.baseline = snapshotOf(collect());", "state.baseline = null;")));
  control("submit() no longer says whether it saved", "S45", edit(EJ, (s) => s.replace("async function submit() {\n  if (state.busy || !state.orig) return false;", "async function submit() {\n  if (state.busy || !state.orig) return;")));
  control("saving the links wipes what was typed elsewhere", "S45", edit(EJ, (s) => s.replace("populate(reload.data, { keepForm: true, saved: PANEL.LINKS });\n    const warn", "populate(reload.data);\n    const warn")));
  control("saving the firms wipes what was typed elsewhere", "S45", edit(EJ, (s) => s.replace("populate(reload.data, { keepForm: true, saved: PANEL.FIRMS })", "populate(reload.data)")));
  control("saving the go-live time wipes what was typed elsewhere", "S45", edit(EJ, (s) => s.replace("populate(reload.data, { keepForm: true, saved: PANEL.GOLIVE })", "populate(reload.data)")));
  control("the bar is no longer sticky", "S45", edit(CSS, (s) => s.replace(".unsaved-bar{position:sticky;bottom:0;", ".unsaved-bar{position:static;bottom:0;")));
  control("a focused field is no longer kept clear of the bar", "S45", edit(CSS, (s) => s.replace("html.unsaved-on{scroll-padding-bottom:140px}", "")));
  control("the bar no longer stacks on a narrow screen", "S45", edit(CSS, (s) => s.replace("@media (max-width:720px){.unsaved-inner{padding:10px 16px}.unsaved-actions{width:100%}", "@media (max-width:20px){.unsaved-inner{padding:10px 16px}.unsaved-actions{width:100%}")));
  control("the bar's content no longer wraps", "S45", edit(CSS, (s) => s.replace("gap:12px 24px;flex-wrap:wrap}", "gap:12px 24px}")));
  control("the status region is hidden with display:none", "S45", edit(CSS, (s) => s.replace(".unsaved-sr{position:absolute;width:1px;height:1px;", ".unsaved-sr{display:none;position:absolute;width:1px;height:1px;")));

// S46 (2026-10-04): the signed-in header: the initials circle is the control; the text is no longer printed beside it.
{
  const AM = "js/account-menu.js", AP = "js/app.js", CSS2 = "app.css";
  control("the circle loses its accessible name (aria-label)", "S46", edit(AM, (s) => s.replace('"aria-label": t.label, ', "")));
  control("the circle is no longer a button (a span)", "S46", edit(AM, (s) => s.replace('h("button", { type: "button", class: "avatar avatar-btn"', 'h("span", { type: "button", class: "avatar avatar-btn"')));
  control("the circle forgets aria-expanded", "S46", edit(AM, (s) => s.replace('"aria-expanded": "false", ', "")));
  control("the circle forgets aria-controls", "S46", edit(AM, (s) => s.replace(', "aria-controls": ACCOUNT.POP_ID', "")));
  control("the accessible name no longer says who is signed in", "S46", edit(AM, (s) => s.replace('PREFIX: "Signed in as "', 'PREFIX: ""')));
  control("the accessible name drops the organization", "S46", edit(AM, (s) => s.replace('label: ACCOUNT.PREFIX + n + (o ? ", " + o : "")', "label: ACCOUNT.PREFIX + n")));
  control("the label is no longer hidden from screen readers (it would be read twice)", "S46", edit(AM, (s) => s.replace('class: "account-pop", "aria-hidden": "true"', 'class: "account-pop"')));
  control("Escape no longer closes the label", "S46", edit(AM, (s) => s.replace('if (ev.key !== "Escape") return;', 'if (ev.key !== "Esc") return;')));
  control("Escape no longer returns focus to the circle", "S46", edit(AM, (s) => s.replace("if (!on && giveFocus) button.focus();", "")));
  control("a click elsewhere no longer closes the label", "S46", edit(AM, (s) => s.replace("if (isOpen && !contains(root, ev.target)) set(false, false);", "")));
  control("focus leaving the control no longer closes the label", "S46", edit(AM, (s) => s.replace('root.addEventListener("focusout", onFocusOut);', "")));
  control("aria-expanded no longer follows the label", "S46", edit(AM, (s) => s.replace('button.setAttribute("aria-expanded", on ? "true" : "false");', "")));
  control("wiring twice stacks listeners", "S46", edit(AM, (s) => s.replace("if (previous) { previous(); previous = null; }", "")));
  control("the account control stores something", "S46", edit(AM, (s) => s.replace("let previous = null;", 'let previous = null; sessionStorage.setItem("x", "y");')));
  control("an em dash in the account control", "S46", edit(AM, (s) => s.replace("let previous = null;", "let previous = null; // a — b")));
  control("app.js prints the name and organization beside the circle again", "S46", edit(AP, (s) => s.replace("      account.root,\n", '      account.root, name + (org ? " · " + org : ""),\n')));
  control("app.js no longer wires the control", "S46", edit(AP, (s) => s.replace("    wireAccountMenu(account, document);\n", "")));
  control("app.js builds the old span with the text", "S46", edit(AP, (s) => s.replace("const account = buildAccount(h, initials, name, org);", 'const account = buildAccount(h, initials, name, org); h("span", { class: "nav-account" }, name);')));
  control("the candidate's signed-in area no longer wraps", "S46", edit(AP, (s) => s.replace('container.classList.add("nav-acct-area");\n    container.append(\n      h("span", { style: "font-size:13px;color:var(--muted);" }, "Email confirmed"),', 'container.append(\n      h("span", { style: "font-size:13px;color:var(--muted);" }, "Email confirmed"),')));
  control("Sign out is removed from the header (both signed-in areas)", "S46", edit(AP, (s) => s.split('"Sign out"').join('"Sign off"')));
  control("an inline margin comes back in the signed-in area", "S46", edit(AP, (s) => s.replace('href: "dashboard.html" }, "My openings")', 'href: "dashboard.html", style: "margin-right:14px;" }, "My openings")')));
  control("the label is no longer a small box under the circle", "S46", edit(CSS2, (s) => s.replace(".account-pop{display:none;position:absolute;top:calc(100% + 10px);right:0;", ".account-pop{display:none;position:static;")));
  control("the keyboard focus no longer shows the label", "S46", edit(CSS2, (s) => s.replace(".account-pop.open,.avatar-btn:focus-visible+.account-pop{display:block}", ".account-pop.open{display:block}")));
  control("mouse-over no longer shows the label", "S46", edit(CSS2, (s) => s.replace("@media (hover:hover){.nav-account:hover .account-pop{display:block}}", "")));
  control("mouse-over applies on touch screens too (sticky hover)", "S46", edit(CSS2, (s) => s.replace("@media (hover:hover){.nav-account:hover", "@media (hover:none){.nav-account:hover")));
  control("Escape can no longer dismiss the hover label", "S46", edit(CSS2, (s) => s.replace(".account-pop.dismissed{display:none!important}", "")));
  control("the circle's touch target is only the drawn circle", "S46", edit(CSS2, (s) => s.replace('.avatar-btn::before{content:"";position:absolute;inset:-6px}', "")));
  control("the signed-in area cannot wrap", "S46", edit(CSS2, (s) => s.replace(".nav-acct-area{gap:10px 14px;flex-wrap:wrap;justify-content:flex-end}", ".nav-acct-area{gap:10px 14px;justify-content:flex-end}")));
  control("the bar does not relax at medium widths", "S46", edit(CSS2, (s) => s.replace("@media (max-width:1300px){.nav{padding:0 24px}", "@media (max-width:130px){.nav{padding:0 24px}")));
  control("the bar does not stack at narrow widths", "S46", edit(CSS2, (s) => s.replace("@media (max-width:1080px){.nav{height:auto;min-height:72px;flex-wrap:wrap;", "@media (max-width:108px){.nav{height:auto;min-height:72px;flex-wrap:wrap;")));
  control("buttons lose their visible focus outline", "S46", edit(CSS2, (s) => s.replace("a:focus-visible,button:focus-visible,", "a:focus-visible,")));
  control("the old margin rule that depended on the printed text returns", "S46", edit(CSS2, (s) => s + "\n.nav-account+.btn{margin-left:14px}\n"));
  control("the file js/account-menu.js is missing", "S46", (dir) => { fs.rmSync(path.join(dir, AM)); });
  control("innerHTML in the account control", "S5", append(AM, "document.body.innerHTML = location.hash;"));
}

// S47 (2026-10-04): the top bar at phone widths (the browser test tests/header-layout.test.js measures it; this rule keeps what that test depends on).
{
  const CSS3 = "app.css", TST = "tests/header-layout.test.js";
  const VP = '<meta name="viewport" content="width=device-width, initial-scale=1">';
  control("a page's viewport meta allows no zoom (maximum-scale)", "S47", edit("index.html", (s) => s.replace(VP, '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">')));
  control("a page's viewport meta forbids zoom (user-scalable=no)", "S47", edit("search.html", (s) => s.replace(VP, '<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">')));
  control("a page's viewport meta is gone", "S47", edit("privacy.html", (s) => s.replace(VP + "\n", "")));
  control("a page's viewport meta is a fixed width", "S47", edit("team.html", (s) => s.replace(VP, '<meta name="viewport" content="width=1024">')));
  control("text-size-adjust 100% is removed", "S47", edit(CSS3, (s) => s.replace("html{-webkit-text-size-adjust:100%;text-size-adjust:100%}", "")));
  control("text-size-adjust is auto", "S47", edit(CSS3, (s) => s.replace("html{-webkit-text-size-adjust:100%;text-size-adjust:100%}", "html{-webkit-text-size-adjust:auto;text-size-adjust:auto}")));
  control("the phone block starts at the wrong width", "S47", edit(CSS3, (s) => s.replace("@media (max-width:640px){", "@media (max-width:64px){")));
  control("the phone bar loses its padding rule", "S47", edit(CSS3, (s) => s.replace(".nav{padding:6px 12px;gap:0 10px;justify-content:flex-start;align-items:center;min-height:0}", ".nav{padding:6px 12px}")));
  control("the logo is no longer 44 pixels tall", "S47", edit(CSS3, (s) => s.replace(".nav-logo{order:1;min-height:44px;", ".nav-logo{order:1;min-height:30px;")));
  control("the logo mark keeps its big size", "S47", edit(CSS3, (s) => s.replace(".nav-mark{width:32px;height:32px}", "")));
  control("the wordmark keeps its big size", "S47", edit(CSS3, (s) => s.replace(".nav-wordmark{font-size:16px;white-space:nowrap}", ".nav-wordmark{font-size:22px}")));
  control("the three links are not the last row", "S47", edit(CSS3, (s) => s.replace(".nav-links{order:5;width:100%;", ".nav-links{order:1;width:100%;")));
  control("the links are no longer 44 pixel targets", "S47", edit(CSS3, (s) => s.replace("align-items:center;min-height:44px;font-size:14px}", "align-items:center;font-size:14px}")));
  control("the account buttons lose their 36 pixel look", "S47", edit(CSS3, (s) => s.replace("#navAccount .btn-sm{position:relative;min-height:36px;", "#navAccount .btn-sm{position:relative;")));
  control("the account buttons lose their invisible touch margin", "S47", edit(CSS3, (s) => s.replace('#navAccount .btn-sm::before{content:"";position:absolute;inset:-6px 0}', "")));
  control("the signed-in items no longer join the bar's rows", "S47", edit(CSS3, (s) => s.replace("#navAccount.nav-acct-area{display:contents!important}", "")));
  control("the account buttons are no longer the second row", "S47", edit(CSS3, (s) => s.replace("#navAccount.nav-acct-area>*{order:4}", "")));
  control("the circle no longer sits beside the logo", "S47", edit(CSS3, (s) => s.replace("#navAccount.nav-acct-area>span{order:2}", "")));
  control("Sign out no longer sits beside the circle", "S47", edit(CSS3, (s) => s.replace("#navAccount.nav-acct-area>.btn-ghost{order:3}", "")));
  control("the row break after Sign out is gone", "S47", edit(CSS3, (s) => s.replace('#navAccount.nav-acct-area::after{content:"";order:3;flex:0 0 100%;height:0}', "")));
  control("the initials label is no longer anchored inside the window", "S47", edit(CSS3, (s) => s.replace(".account-pop{top:50px;right:12px;max-width:calc(100vw - 24px)}", "")));
  control("the label is anchored to the circle on a phone again", "S47", edit(CSS3, (s) => s.replace("  .nav-account{position:static}\n", "")));
  control("the narrow phone block is removed", "S47", edit(CSS3, (s) => s.replace("@media (max-width:360px){.nav{padding:6px 8px}.nav-links a{font-size:13px}}", "")));
  control("the logo gets a fixed minimum width", "S47", edit(CSS3, (s) => s + "\n.nav-logo{min-width:480px}\n"));
  control("the wordmark gets a wide fixed width", "S47", edit(CSS3, (s) => s + "\n@media (max-width:640px){.nav-wordmark{width:300px}}\n"));
  control("the account buttons get a fixed minimum width", "S47", edit(CSS3, (s) => s + "\n#navAccount .btn-sm{min-width:200px}\n"));
  control("the base stylesheet gives the bar a fixed minimum width", "S47", edit("styles.css", (s) => s + "\n.nav{min-width:1024px}\n"));
  control("the browser test is missing", "S47", (dir) => { fs.rmSync(path.join(dir, TST)); });
  control("the browser test no longer covers 320", "S47", edit(TST, (s) => s.replace("const WIDTHS = [320, 360, 375, 390, 414];", "const WIDTHS = [360, 375, 390, 414];")));
  control("the browser test loses its negative controls", "S47", edit(TST, (s) => s.replace("negative controls: the header rule catches each deliberate defect", "negative controls: skipped")));
}

// S48 (2026-10-04): the pages at phone widths (the browser test tests/phone-layout.test.js measures them; this rule keeps what that test depends on, and keeps the desktop layout from changing).
{
  control("page side padding goes back to 64 pixels", "S48", edit("app.css", (s) => s.replace(".pg{padding-left:16px!important;padding-right:16px!important}", ".pg{padding-left:64px!important;padding-right:64px!important}")));
  control("the shorter top and bottom space is removed", "S48", edit("app.css", (s) => s.replace(".pg-top{padding-top:28px!important;padding-bottom:36px!important}", "")));
  control("two columns no longer stack", "S48", edit("app.css", (s) => s.replace(".cols{flex-direction:column!important;gap:24px!important;align-items:stretch!important}", ".cols{flex-direction:row!important}")));
  control("stacked columns no longer fill the row", "S48", edit("app.css", (s) => s.replace(".cols>*{flex:none!important;width:100%!important;max-width:none!important;min-width:0}", "")));
  control("fields go two per row again", "S48", edit("app.css", (s) => s.replace(".grid2,.grid3{grid-template-columns:minmax(0,1fr)!important}", ".grid2,.grid3{grid-template-columns:1fr 1fr!important}")));
  control("cards go back to 28 pixel padding", "S48", edit("app.css", (s) => s.replace(".card{padding:16px!important}", ".card{padding:28px!important}")));
  control("table cards lose their no-padding rule", "S48", edit("app.css", (s) => s.replace(".card.flush{padding:0!important}", "")));
  control("buttons lose their 44 pixel height", "S48", edit("app.css", (s) => s.replace("main .btn,main button.btn,main a.btn{min-height:44px;justify-content:center}", "")));
  control("form text goes back below 16 pixels", "S48", edit("app.css", (s) => s.replace("input[type=\"text\"],input[type=\"email\"],input[type=\"number\"],input[type=\"password\"],select,textarea{font-size:16px!important}", "")));
  control("switches may shrink again", "S48", edit("app.css", (s) => s.replace(".toggle{flex:none}", "")));
  control("help text can open off the screen again", "S48", edit("app.css", (s) => s.replace(".info-tooltip,.info-tooltip-wide{position:fixed!important;left:16px!important;right:16px!important;width:auto!important;top:auto!important;bottom:16px!important}", "")));
  control("the verify card's email box and button sit side by side again", "S48", edit("app.css", (s) => s.replace(".signin-row{flex-direction:column;align-items:stretch}", "")));
  control("the verify card's button no longer fills the row", "S48", edit("app.css", (s) => s.replace(".signin-row .btn{width:100%}", "")));
  control("the footer cannot wrap again", "S48", edit("app.css", (s) => s.replace(".site-footer{flex-wrap:wrap;gap:0 20px;padding:12px 16px}", "")));
  control("the details window is a fixed width again", "S48", edit("app.css", (s) => s.replace(".modal{width:calc(100vw - 24px);max-width:none;max-height:88vh;padding:20px 16px}", "")));
  control("a link's text and Continue sit side by side again", "S48", edit("app.css", (s) => s.replace(".source-row{flex-direction:column;align-items:flex-start;gap:6px;min-height:44px}", "")));
  control("tables stay tables on a phone", "S48", edit("app.css", (s) => s.replace(".rtable,.rtable thead,.rtable tbody,.rtable tr,.rtable th,.rtable td{display:block}", "")));
  control("table cells lose their visible labels", "S48", edit("app.css", (s) => s.replace(".rtable td::before{content:attr(data-label);", ".rtable td::before{content:none;")));
  control("a result card's heading row cannot wrap", "S48", edit("app.css", (s) => s.replace(".res-head{flex-wrap:wrap;gap:10px}", "")));
  control("a rule outside the phone media blocks (it would change the desktop layout)", "S48", edit("app.css", (s) => s + "\n.pg{padding-left:16px}\n"));
  control("a rule added after the phone block but outside it", "S48", edit("app.css", (s) => s.replace("@media (max-width:360px){.rtable td{grid-template-columns:92px minmax(0,1fr)}}", "@media (max-width:360px){.rtable td{grid-template-columns:92px minmax(0,1fr)}}\n.card{padding:10px}")));
  control("the phone block marker is gone", "S48", edit("app.css", (s) => s.replace("/* phone layout for the pages themselves (October 4, 2026).", "/* phone layout for the pages.")));
  control("the home page loses its column class", "S48", edit("index.html", (s) => s.replace('class="pg pg-top cols"', 'class="pg pg-top"')));
  control("the home page's three steps lose grid3", "S48", edit("index.html", (s) => s.replace('class="grid3"', "")));
  control("the register page loses grid2", "S48", edit("register.html", (s) => s.replace('class="grid2"', "")));
  control("the sign-in page loses pg", "S48", edit("employer-signin.html", (s) => s.replace('class="pg pg-top cols"', 'class="cols"')));
  control("the search page's verify card loses pg", "S48", edit("search.html", (s) => s.replace('id="signinWrap" class="pg"', 'id="signinWrap"')));
  control("the My openings table loses its table roles", "S48", edit("dashboard.html", (s) => s.replace('class="dash-table rtable" role="table"', 'class="dash-table rtable"')));
  control("the My openings table loses its labelled scroll area", "S48", edit("dashboard.html", (s) => s.replace(' data-scroll-area="My openings table"', "")));
  control("the Team table loses rtable", "S48", edit("team.html", (s) => s.replace('class="dash-table rtable" role="table"', 'class="dash-table" role="table"')));
  control("the Analytics table loses its column header roles", "S48", edit("analytics.html", (s) => s.replace('<th role="columnheader">Searches</th>', "<th>Searches</th>").replace('role="columnheader">Posting<', ">Posting<")));
  control("a My openings row cell loses its data-label", "S48", edit("js/pages/dashboard.js", (s) => s.replace('"data-label": "Closes", ', "")));
  control("a Team row cell loses its role", "S48", edit("js/pages/team.js", (s) => s.replace('role: "cell", "data-label": "Role"', '"data-label": "Role"')));
  control("an Analytics row loses its row role", "S48", edit("js/pages/analytics.js", (s) => s.replace('return h("tr", { role: "row" },', 'return h("tr", {},')));
  control("the result card heading loses res-head", "S48", edit("js/pages/search.js", (s) => s.replace('class: "res-head", ', "")));
  control("the phone layout test is missing", "S48", (dir) => { fs.rmSync(path.join(dir, "tests/phone-layout.test.js")); });
  control("the phone layout test no longer covers 320", "S48", edit("tests/phone-layout.test.js", (s) => s.replace("const WIDTHS = [320, 360, 375, 390, 414];", "const WIDTHS = [360, 375, 390, 414];")));
  control("the phone layout test loses its negative controls", "S48", edit("tests/phone-layout.test.js", (s) => s.replace("negative controls: each phone fix undone makes the layout rule fail", "negative controls: skipped")));
}

// S49 (2026-10-04): the sign-in link opens in a NEW tab (the browser test tests/signin-tabs.test.js proves it with two tabs; this rule keeps what it depends on).
{
  control("the saved search expires after a day", "S49", edit("js/signin-handoff.js", (s) => s.replace("export const HANDOFF_TTL_MS = 60 * 60 * 1000;", "export const HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;")));
  control("the hand-off sends something", "S49", edit("js/signin-handoff.js", (s) => s.replace("function drop(store, key)", "function drop(store, key) { fetch('/x?' + key); }\nfunction drop2(store, key)")));
  control("the hand-off uses tab-local storage", "S49", edit("js/signin-handoff.js", (s) => s.replace("function drop(store, key)", "function drop(store, key) { sessionStorage.setItem(key, '1'); }\nfunction drop2(store, key)")));
  control("a saved value is not removed when read", "S49", edit("js/signin-handoff.js", (s) => s.replace("    store.removeItem(key);\n", "")));
  control("a saved value is kept past its expiry", "S49", edit("js/signin-handoff.js", (s) => s.replace("!(o.exp > now)", "false")));
  control("the watch listens to nothing", "S49", edit("js/signin-handoff.js", (s) => s.replace('win.addEventListener("storage", onStorage);', "")));
  control("the watch ignores the session key", "S49", edit("js/signin-handoff.js", (s) => s.replace("ev.key === null || ev.key === storageKey", "false")));
  control("the landing page is kept in tab-local storage", "S49", edit("js/session.js", (s) => s.replace('saveLanding(localStorage, next || "")', 'saveLanding(sessionStorage, next || "")')));
  control("sign-out keeps the saved search", "S49", edit("js/session.js", (s) => s.replace("clearHandoff(localStorage); ", "")));
  control("the pending search goes back to tab-local storage", "S49", edit("js/pages/search.js", (s) => s.replace("savePending(localStorage,", "savePending(sessionStorage,")));
  control("the search page does not watch for a sign-in elsewhere", "S49", edit("js/pages/search.js", (s) => s.replace("watchOtherTabSignIn(async", "(async")));
  control("the verify card's wording is changed without approval", "S49", edit("js/pages/search.js", (s) => s.replace("We keep your search in this browser for one hour and run it when you open the link in this browser.", "We keep your search and run it when you are back.")));
  control("the Check your email wording is changed without approval", "S49", edit("js/pages/search.js", (s) => s.replace("Open the link in this same browser and your search will be waiting.", "Your search will be waiting.")));
  control("the verify card goes back to the old promise", "S49", edit("js/pages/search.js", (s) => s.replace("Confirm your email first. We keep your search in this browser for one hour and run it when you open the link in this browser. If the link opens somewhere else, enter your search again.", "Verify your email first; your search is saved and runs as soon as you are back.")));
  control("the employer sign-in page does not watch", "S49", edit("js/pages/employer-signin.js", (s) => s.replace("watchOtherTabSignIn(() =>", "(() =>")));
  control("the employer sign-in page always lands in the employer area", "S49", edit("js/pages/employer-signin.js", (s) => s.replace('rememberedNext() || "register.html"', '"register.html"')));
  control("the comments page does not watch", "S49", edit("js/pages/comments.js", (s) => s.replace("watchOtherTabSignIn(async", "(async")));
  control("the sign-in link page leaves no landing flag", "S49", edit("js/pages/auth-callback.js", (s) => s.replace('markLanded(sessionStorage, "candidate");', "")));
  control("the landing note loses its approval marker", "S49", edit("js/landing-notice.js", (s) => s.replace("WORDING APPROVED by John on October 4, 2026", "WORDING")));
  control("the landing note is switched off", "S49", edit("js/landing-notice.js", (s) => s.replace("LANDING_NOTICE_ENABLED = true;", "LANDING_NOTICE_ENABLED = false;")));
  control("the candidate landing wording is changed", "S49", edit("js/landing-notice.js", (s) => s.replace("or keep searching here.", "or keep looking here.")));
  control("the employer landing wording is changed", "S49", edit("js/landing-notice.js", (s) => s.replace("or keep working here.", "or keep going here.")));
  control("the both-roles wording is changed", "S49", edit("js/landing-notice.js", (s) => s.replace("Searching here works as a candidate.", "You can search here.")));
  control("the both-roles note is chosen for a candidate-only session", "S49", edit("js/landing-notice.js", (s) => s.replace('if (session.isPoster && session.isCandidate) return "both";', 'if (session.isCandidate) return "both";')));
  control("the both-roles note is chosen for an employer-only session", "S49", edit("js/landing-notice.js", (s) => s.replace('if (session.isPoster) return "employer";', 'if (session.isPoster) return "both";')));
  control("the search page no longer shows the both-roles note", "S49", edit("js/pages/search.js", (s) => s.replace('if (roleNoteKind(session) === "both") {', "if (false) {")));
  control("the top bar builder no longer shows the landing note", "S49", edit("js/app.js", (s) => s.replace("  showLandingNote(session);\n", "")));
  control("an em dash in the landing note", "S49", edit("js/landing-notice.js", (s) => s.replace("You are signed in. You can close this tab and go back to the one you started from, or keep searching here.", "You are signed in \u2014 you can close this tab.")));
  control("the two-tab test is missing", "S49", (dir) => { fs.rmSync(path.join(dir, "tests/signin-tabs.test.js")); });
  control("the two-tab test loses its negative controls", "S49", edit("tests/signin-tabs.test.js", (s) => s.replace("negative controls: each deliberate defect makes a sign-in tab scenario fail", "negative controls: skipped")));
}

// S50 (2026-10-04, after the stage recheck): landing wording by page, the home page wording, Report a wrong link only for a posting with links, the search fields' line, the details window's scroll lock.
{
  control("the Team page is dropped from the employer pages", "S50", edit("js/landing-notice.js", (s) => s.replace("\"analytics.html\", \"team.html\", ", "\"analytics.html\", ")));
  control("the search page is dropped from the candidate pages", "S50", edit("js/landing-notice.js", (s) => s.replace("export const CANDIDATE_PAGES = [\"search.html\"];", "export const CANDIDATE_PAGES = [];")));
  control("the landing note ignores the page", "S50", edit("js/app.js", (s) => s.replace("landingKindForPage(location.pathname, location.search) || flag", "flag")));
  control("the landing note ignores the role check", "S50", edit("js/app.js", (s) => s.replace("kind === \"poster\" && session.isPoster ? landingText(\"poster\")", "kind === \"poster\" ? landingText(\"poster\")")));
  control("the home button says Search a company again", "S50", edit("index.html", (s) => s.replace("<a class=\"btn btn-dark\" href=\"search.html\">Look up an opening</a>", "<a class=\"btn btn-dark\" href=\"search.html\">Search a company</a>")));
  control("the home sentence goes back to the old wording", "S50", edit("index.html", (s) => s.replace("Look up an opening by company and req number, or by company and Opening ID or title, before applying. No account or password, just a quick email check.", "Search by company and title before applying. No account required to look up an opening.")));
  control("the home sentence is reworded", "S50", edit("index.html", (s) => s.replace("or by company and Opening ID or title, before applying.", "or by title, before applying.")));
  control("the old wording appears on another page", "S50", edit("privacy.html", (s) => s.replace("<h1", "<p>Search a company</p><h1")));
  control("the report section is shown whatever the opening has", "S50", edit("js/pages/comments.js", (s) => s.replace("$(\"#reportWrap\").hidden = !picker;", "$(\"#reportWrap\").hidden = false;")));
  control("the report section is shown again somewhere", "S50", edit("js/pages/comments.js", (s) => s.replace("async function sessionEnded() {", "async function sessionEnded() { if (false) $(\"#reportWrap\").hidden = false;")));
  control("the search fields lose their bottom line", "S50", edit("app.css", (s) => s.replace(".srch-input{border-bottom:2px solid #8A8379!important;border-radius:0!important;padding-bottom:6px!important}", ".srch-input{border-bottom:0!important}")));
  control("the search fields lose their focus line", "S50", edit("app.css", (s) => s.replace(".srch-input:focus{border-bottom-color:var(--ember-dark)!important;box-shadow:0 1px 0 0 var(--ember-dark)}", "")));
  control("the backdrop rule is gone", "S50", edit("app.css", (s) => s.replace(".modal-backdrop{touch-action:none;overscroll-behavior:contain}", "")));
  control("the window rule is gone", "S50", edit("app.css", (s) => s.replace(".modal{touch-action:pan-y;overscroll-behavior:contain}", "")));
  control("the company field loses its line class", "S50", edit("search.html", (s) => s.replace("<input id=\"company\" class=\"srch-input\" type=\"text\"", "<input id=\"company\" type=\"text\"")));
  control("the req field loses its line class", "S50", edit("search.html", (s) => s.replace("<input id=\"reqq\" class=\"srch-input\" type=\"password\"", "<input id=\"reqq\" type=\"password\"")));
  control("the title field loses its line class", "S50", edit("search.html", (s) => s.replace("<input id=\"titleq\" class=\"srch-input\" type=\"text\"", "<input id=\"titleq\" type=\"text\"")));
  control("the details window no longer locks the page", "S50", edit("js/pages/search.js", (s) => s.replace("if (!unlockScroll) unlockScroll = lockScroll(document, window);", "")));
  control("the details window never unlocks the page", "S50", edit("js/pages/search.js", (s) => s.replace("if (unlockScroll) { unlockScroll(); unlockScroll = null; }", "")));
  control("the unlock restores the wrong values", "S50", edit("js/scroll-lock.js", (s) => s.replace("html.style.overflow = prev.html; body.style.overflow = prev.body; body.style.paddingRight = prev.pad;", "html.style.overflow = \"auto\"; body.style.overflow = \"auto\";")));
  control("the lock forgets the scrollbar", "S50", edit("js/scroll-lock.js", (s) => s.replace("const bar = Math.max(0, win.innerWidth - html.clientWidth);", "const bar = 0;")));
  control("the lock keeps something in storage", "S50", edit("js/scroll-lock.js", (s) => s.replace("let done = false;", "let done = false; localStorage.setItem('x', 'y');")));
  control("the lock fixes the body", "S50", edit("js/scroll-lock.js", (s) => s.replace("let done = false;", "let done = false; body.style.position = 'fixed';")));
  control("the scroll lock file is missing", "S50", (dir) => { fs.rmSync(path.join(dir, "js/scroll-lock.js")); });
  control("the report section test is missing", "S50", (dir) => { fs.rmSync(path.join(dir, "tests/comments-report.test.js")); });
  control("the search UI test is missing", "S50", (dir) => { fs.rmSync(path.join(dir, "tests/search-ui.test.js")); });
  control("the search UI test loses its negative controls", "S50", edit("tests/search-ui.test.js", (s) => s.replace("negative controls: each defect", "controls skipped: each defect")));
  control("the report section test loses its negative controls", "S50", edit("tests/comments-report.test.js", (s) => s.replace("negative controls: each defect", "controls skipped: each defect")));
}

// S51 (2026-10-05): home step 3, the search form's boxes, the callback without the flash on employer pages.
{
  control("the home heading goes back to Candidates verify", "S51", edit("index.html", (s) => s.replace("Candidates look up</h3>", "Candidates verify</h3>")));
  control("the home step 3 sentence goes back to the earlier wording", "S51", edit("index.html", (s) => s.replace("Look up an opening by company and req number, or by company and Opening ID or title, before applying. No account or password, just a quick email check.", "Look up an opening by company and req number, or by company and title, before applying. No account required.")));
  control("the old heading appears on another page", "S51", edit("privacy.html", (s) => s.replace("<h1", "<h3>Candidates verify</h3><h1")));
  control("the Company label loses (required)", "S51", edit("search.html", (s) => s.replace(" <span class=\"srch-req\">(required)</span>", "")));
  control("the company box is no longer aria-required", "S51", edit("search.html", (s) => s.replace(" type=\"text\" aria-required=\"true\" maxlength=\"200\"", " type=\"text\" maxlength=\"200\"")));
  control("the group loses its role", "S51", edit("search.html", (s) => s.replace("class=\"srch-group\" role=\"group\" aria-labelledby=\"oneOfHead\"", "class=\"srch-group\"")));
  control("the group loses its label link", "S51", edit("search.html", (s) => s.replace(" role=\"group\" aria-labelledby=\"oneOfHead\"", " role=\"group\"")));
  control("the heading Then one of these is gone", "S51", edit("search.html", (s) => s.replace("<div id=\"oneOfHead\" class=\"srch-then\">Then one of these</div>", "<div id=\"oneOfHead\" class=\"srch-then\"></div>")));
  control("the visible or is gone", "S51", edit("search.html", (s) => s.replace("<div class=\"srch-or\">or</div>", "<div class=\"srch-or\"></div>")));
  control("the old sentence is back", "S51", edit("search.html", (s) => s.replace("Company is required. Then fill in one of the other two boxes: the req number, or the Opening ID / title box, not both. The req number is hidden as you type; press Show to check it.", "Fill in only one of the two lookup boxes: the req number, or the Opening ID / title box. The req number is hidden as you type; press Show to check it.")));
  control("the new sentence is reworded", "S51", edit("search.html", (s) => s.replace("not both.", "not both!")));
  control("the required word loses its ember color", "S51", edit("app.css", (s) => s.replace(".srch-req{text-transform:none;letter-spacing:0;font-weight:700;color:var(--ember)}", ".srch-req{text-transform:none;letter-spacing:0;font-weight:700}")));
  control("the or loses its rule", "S51", edit("app.css", (s) => s.replace(".srch-or{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:700;color:var(--muted)}", ".srch-or{display:none}")));
  control("the callback flashes on employer pages again", "S51", edit("js/pages/auth-callback.js", (s) => s.replace("landingKindForPage(\"/\" + destPage[0], destPage[1] ? \"?\" + destPage[1] : \"\") !== \"poster\")", "true)")));
  control("the search form test loses its grouping checks", "S51", edit("tests/search-ui.test.js", (s) => s.split("Then one of these").join("Then one")));
}

// S52 (2026-10-05): the accessibility round.
{
  control("header-order.js is gone", "S52", (dir) => fs.rmSync(path.join(dir, "js/header-order.js")));
  control("the phone breakpoint of the header order is wrong", "S52", edit("js/header-order.js", (s) => s.replace("PHONE_QUERY = \"(max-width:640px)\"", "PHONE_QUERY = \"(max-width:600px)\"")));
  control("the middle breakpoint of the header order is wrong", "S52", edit("js/header-order.js", (s) => s.replace("MIDDLE_QUERY = \"(max-width:1080px)\"", "MIDDLE_QUERY = \"(max-width:1000px)\"")));
  control("app.js stops watching the header order", "S52", edit("js/app.js", (s) => s.replace("watchHeaderOrder(document, window);", "void 0;")));
  control("the search status is not a live region", "S52", edit("search.html", (s) => s.replace(" role=\"status\" aria-live=\"polite\" aria-atomic=\"true\"></div>\n    <div id=\"resultCount\"", "></div>\n    <div id=\"resultCount\"")));
  control("the visible count is read a second time", "S52", edit("search.html", (s) => s.replace("class=\"result-count\" aria-hidden=\"true\" hidden", "class=\"result-count\" hidden")));
  control("search.js stops announcing", "S52", edit("js/pages/search.js", (s) => s.replace("  status.announce(spoken);\n  // After a successful search", "  // After a successful search")));
  control("search.js no longer traps focus in the details window", "S52", edit("js/pages/search.js", (s) => s.replace("releaseFocus = trapFocus({", "releaseFocus = ({")));
  control("the details window no longer returns focus to the exact button", "S52", edit("js/pages/search.js", (s) => s.replace("openModal(row, button)", "openModal(row, null)")));
  control("the page behind the details window is not made inert", "S52", edit("js/dialog-focus.js", (s) => s.replace("sib.setAttribute(\"inert\", \"\");", "")));
  control("Tab is no longer trapped in the details window", "S52", edit("js/dialog-focus.js", (s) => s.replace("doc.addEventListener(\"keydown\", onKey, true);", "")));
  control("the hit area of the top bar and footer links is gone", "S52", edit("app.css", (s) => s.replace(".nav-links a::before,.site-footer a::before,footer.wrapflex a::before,.hit::before,#modalMore a::before,.row-action::before,.check-row::before{", ".nav-links a::before{")));
  control("the drop-down list has no minimum height", "S52", edit("app.css", (s) => s.replace("select{min-height:24px}", "")));
  control("the little i icon has no hit area", "S52", edit("app.css", (s) => s.replace(".info-icon::before{content:\"\";position:absolute;inset:-5px}", "")));
  control("the 3 Comments link loses its hit class", "S52", edit("index.html", (s) => s.replace("<a class=\"hit\" href=\"search.html\"", "<a href=\"search.html\"")));
  control("the unsaved bar stops saying it is gone", "S52", edit("js/dirty-state.js", (s) => s.replace("CLEARED: \"No unsaved changes.\"", "CLEARED: \"\"")));
  control("a discard no longer hushes the closing message", "S52", edit("js/unsaved-guard.js", (s) => s.replace("const hush = (on) => { hushed = !!on; };", "const hush = () => {};")));
  control("a test of the round is not run", "S52", edit("tests/run-all.js", (s) => s.replace("target-size.test.js", "target-size-old.test.js")));
}

// S53 (2026-10-05, Part C): the search recap.
{
  control("the recap moves under the results", "S53", edit("search.html", (s) => s.replace('    <div id="searchStatus"', '    <div id="results" style="display:none"></div>\n    <div id="searchStatus"')));
  control("the Edit this search button becomes a span", "S53", edit("search.html", (s) => s.replace("<button type=\"button\" id=\"recapEdit\" class=\"btn btn-outline btn-sm\">Edit this search</button>", "<span id=\"recapEdit\" class=\"btn\">Edit this search</span>")));
  control("the recap sentence loses its ending", "S53", edit("js/search-recap.js", (s) => s.replace("TAIL: \" Your results are below.\"", "TAIL: \"\"")));
  control("the req number is printed in the recap", "S53", edit("js/search-recap.js", (s) => s.replace("search.kind === \"req\" ? RECAP.REQ", "search.kind === \"req\" ? search.value")));
  control("an Opening ID is printed in the recap", "S53", edit("js/search-recap.js", (s) => s.replace("search.kind === \"code\" || search.alsoTryCode ? RECAP.CODE", "search.kind === \"code\" ? search.value : RECAP.CODE")));
  control("the boxes are not emptied", "S53", edit("js/pages/search.js", (s) => s.replace("companyIn.value = \"\"; queryIn.value = \"\"; reqIn.value = \"\";", "void 0;")));
  control("a new search does not hide the recap", "S53", edit("js/pages/search.js", (s) => s.replace("setFormError(\"\"); hideRecap();", "setFormError(\"\");")));
  control("Edit this search does not move the cursor", "S53", edit("js/pages/search.js", (s) => s.replace("lastSearch = null; hideRecap(); companyIn.focus();", "lastSearch = null; hideRecap();")));
  control("Edit this search does not put the values back", "S53", edit("js/pages/search.js", (s) => s.replace("companyIn.value = lastSearch.company; queryIn.value = lastSearch.q; reqIn.value = lastSearch.r;", "void 0;")));
  control("the typed search is kept in storage", "S53", edit("js/pages/search.js", (s) => s.replace("  lastSearch = typed;\n", "  lastSearch = typed; localStorage.setItem(\"typed\", JSON.stringify(typed));\n")));
  control("the count is spoken as a second message", "S52", edit("js/pages/search.js", (s) => s.replace("  status.announce(spoken);\n  // After a successful search", "  status.announce(spoken); status.announce(countEl.textContent);\n  // After a successful search")));
  control("a hidden recap shows", "S53", edit("app.css", (s) => s.replace(".recap[hidden]{display:none}", "")));
  control("the recap test is not run", "S53", edit("tests/run-all.js", (s) => s.replace("search-recap.test.js", "search-recap-old.test.js")));
}
  control("the count is left out of the spoken message", "S52", edit("js/pages/search.js", (s) => s.replace('const spoken = text + " " + countEl.textContent + ".";', "const spoken = text;")));

// S54 (2026-10-05): the edit page's skip link.
{
  control("the unsaved skip link is gone from edit.html", "S54", edit("edit.html", (s) => s.replace("<a id=\"skipToUnsaved\" class=\"skip-link\" href=\"#unsavedSave\" hidden>Skip to unsaved changes</a>\n", "")));
  control("the unsaved skip link comes after Skip to content", "S31", edit("edit.html", (s) => s.replace("<a id=\"skipToUnsaved\" class=\"skip-link\" href=\"#unsavedSave\" hidden>Skip to unsaved changes</a>\n<a class=\"skip-link\" href=\"#main\">Skip to content</a>\n", "<a class=\"skip-link\" href=\"#main\">Skip to content</a>\n<a id=\"skipToUnsaved\" class=\"skip-link\" href=\"#unsavedSave\" hidden>Skip to unsaved changes</a>\n")));
  control("the skip link is never hidden again", "S54", edit("js/unsaved-guard.js", (s) => s.replace("if (skip) skip.hidden = !s.any;", "if (skip) skip.hidden = false;")));
  control("the skip link does not move focus", "S54", edit("js/unsaved-guard.js", (s) => s.replace("(saveBtn.hidden || saveBtn.disabled ? discardBtn : saveBtn).focus()", "void 0")));
  control("edit.js does not hand over the skip link", "S54", edit("js/pages/edit.js", (s) => s.replace("skip: $(\"#skipToUnsaved\")", "skip: null")));
}

// S55: the landing note clears on the person's first real action (Part E3), with no close button, no timer and no announcement
{
  control("the landing note never clears on content pages", "S55", edit("js/app.js", (s) => s.replace("for (const t of [\"click\", \"keydown\"]) document.addEventListener(t, onAct, true);", "void 0;")));
  control("a click on the note itself clears it", "S55", edit("js/app.js", (s) => s.replace("main.contains(t) && !box.contains(t)", "main.contains(t)")));
  control("a finished search does not clear the note", "S55", edit("js/pages/search.js", (s) => s.replace("if (!auto) clearLandingNote();", "")));
  control("a replayed search is not marked automatic", "S55", edit("js/pages/search.js", (s) => s.replace("runSearch(true);", "runSearch();")));
  control("typing does not clear the note", "S55", edit("js/pages/search.js", (s) => s.replace("el.addEventListener(\"input\", clearLandingNote)", "el.addEventListener(\"input\", () => {})")));
  control("the note gets a timer", "S55", edit("js/app.js", (s) => s.replace("landingNoteOn = { box, off };", "landingNoteOn = { box, off }; setTimeout(clearLandingNote, 9000);")));
  control("the landing-clear test is not run", "S55", edit("tests/run-all.js", (s) => s.replace("landing-clear.test.js", "landing-clear-old.test.js")));
}

// S56: after a successful search the recap scrolls to the top of the window (Part E4): smooth, no focus move, not with reduced motion, not for a replayed search
{
  control("the recap no longer scrolls into view", "S56", edit("js/pages/search.js", (s) => s.replace("recapEl.scrollIntoView({ block: \"start\", behavior: \"smooth\" });", "void 0;")));
  control("the scroll ignores reduced motion", "S56", edit("js/pages/search.js", (s) => s.replace("!(window.matchMedia && window.matchMedia(\"(prefers-reduced-motion: reduce)\").matches)", "true")));
  control("a replayed search scrolls", "S56", edit("js/pages/search.js", (s) => s.replace("if (!auto && !(window.matchMedia", "if (!(window.matchMedia")));
  control("the recap takes the focus", "S56", edit("js/pages/search.js", (s) => s.replace("recapEl.scrollIntoView({ block: \"start\", behavior: \"smooth\" });", "recapEl.scrollIntoView({ block: \"start\", behavior: \"smooth\" }); recapEl.focus();")));
  control("the scroll test is not run", "S56", edit("tests/run-all.js", (s) => s.replace("search-scroll.test.js", "search-scroll-old.test.js")));
}

// S57: candidate sign-in wording, the confirm family (Part E5): search card heading, paragraph, button, the flash after the link and the top bar word; employer side stays sign-in link
{
  control("the search card heading goes back to Verify", "S57", edit("search.html", (s) => s.replace("<h2>Confirm your email to search</h2>", "<h2>Verify your email to search</h2>")));
  control("the paragraph goes back to keeps you verified", "S57", edit("search.html", (s) => s.replace("that keeps your email confirmed for 90 days.", "that keeps you verified for 90 days.")));
  control("the button goes back to Send link", "S57", edit("search.html", (s) => s.replace("id=\"candSend\" class=\"btn btn-dark\">Email me a link</button>", "id=\"candSend\" class=\"btn btn-dark\">Send link</button>")));
  control("the top bar goes back to Email verified", "S57", edit("js/app.js", (s) => s.replace("\"Email confirmed\"", "\"Email verified\"")));
  control("the flash goes back to Email verified", "S57", edit("js/pages/auth-callback.js", (s) => s.replace("say(\"Email confirmed\", \"You can search now.\", [])", "say(\"Email verified\", \"You can search now.\", [])")));
  control("the employer heading changes", "S57", edit("employer-signin.html", (s) => s.replace("<h2>Email me a sign-in link</h2>", "<h2>Confirm your email</h2>")));
}

// S58: the one comments switch, js/config.js COMMENTS_VISIBLE, shipped true (since 2026-10-06), read by every comment surface (Part E6)
{
  control("the switch ships off", "S58", edit("js/config.js", (s) => s.replace("export const COMMENTS_VISIBLE = true;", "export const COMMENTS_VISIBLE = false;")));
  control("the home page card ignores the switch", "S58", edit("js/pages/index.js", (s) => s.replace("if (!COMMENTS_VISIBLE) { const c", "if (false) { const c")));
  control("the details window ignores the switch", "S58", edit("js/pages/search.js", (s) => s.replace("if (COMMENTS_VISIBLE) more.append(", "more.append(")));
  control("Report a wrong link is dropped from the details window", "S58", edit("js/pages/search.js", (s) => s.replace("if (withReport) more.append(", "if (false) more.append(")));
  control("the comments page always asks for the thread", "S58", edit("js/pages/comments.js", (s) => s.replace("if (COMMENTS_VISIBLE) await loadThread(0);", "await loadThread(0);")));
  control("the Comments stay open line ignores the switch", "S58", edit("js/pages/comments.js", (s) => s.replace("closed_reason || null, COMMENTS_VISIBLE)", "closed_reason || null, true)")));
  control("My openings keeps its Comments cells", "S58", edit("js/pages/dashboard.js", (s) => s.replace("COMMENTS_VISIBLE ? h(\"td\"", "true ? h(\"td\"")));
  control("the comments switch test is not run", "S58", edit("tests/run-all.js", (s) => s.replace("comments-switch.test.js", "comments-switch-old.test.js")));
}

// S59: no verify, verified or verification in candidate-facing text (Part E7): the word is confirm; exceptions are the destination link wording, data and class names, and privacy.html
{
  control("a page says Verify your email again", "S59", edit("search.html", (s) => s.replace("<h2>Confirm your email to search</h2>", "<h2>Verify your email to search</h2>")));
  control("a comments page sentence says verified candidates", "S59", edit("comments.html", (s) => s.replace("Written by candidates who confirmed their email, newest first, anonymous.", "Written by verified candidates, newest first, anonymous.")));
  control("a script message says verification", "S59", edit("js/api.js", (s) => s.replace("Your email confirmation has expired. Please confirm your email again.", "Your email verification has expired. Please verify your email again.")));
  control("the comment tag goes back to Verified candidate", "S59", edit("js/pages/comments.js", (s) => s.replace("\"Candidate · \" + ago(", "\"Verified candidate · \" + ago(")));
  control("the callback says verified candidate", "S59", edit("js/pages/auth-callback.js", (s) => s.replace("Signed in, but not as a candidate", "Signed in, but not as a verified candidate")));
  control("the employer notice says verified candidate session", "S59", edit("js/pages/search.js", (s) => s.replace("needs a candidate sign-in: sign out, then confirm a candidate email address.", "needs a verified candidate session: sign out, then verify a candidate email address.")));
  control("the verify word comes back on the home page", "S59", edit("index.html", (s) => s.replace("Candidates look up</h3>", "Candidates look up</h3><p>Verify first.</p>")));
}

// S60: search engines, the flag ALLOW_INDEXING in js/config.js (false on stage), robots.txt, the robots tag of every page, the tool and the test (Phase 3)
{
  control("My openings says index, follow", "S60", edit("dashboard.html", (s) => s.replace('<meta name="robots" content="noindex, nofollow">', '<meta name="robots" content="index, follow">')));
  control("a sign-in page says only noindex", "S60", edit("auth-callback.html", (s) => s.replace('<meta name="robots" content="noindex, nofollow">', '<meta name="robots" content="noindex">')));
  control("the home page says index, follow while the flag is false", "S60", edit("index.html", (s) => s.replace('<meta name="robots" content="noindex, nofollow">', '<meta name="robots" content="index, follow">')));
  control("robots.txt allows crawling on stage", "S60", edit("robots.txt", (s) => s.replace("Disallow: /", "Allow: /")));
  control("robots.txt is emptied", "S60", edit("robots.txt", (s) => s.replace("Disallow: /", "")));
  control("the flag is switched on without running the tool", "S60", edit("js/config.js", (s) => s.replace("export const ALLOW_INDEXING = false;", "export const ALLOW_INDEXING = true;")));
  control("the flag line is removed", "S60", edit("js/config.js", (s) => s.replace("export const ALLOW_INDEXING = false;", "")));
  control("the indexing test is not run", "S60", edit("tests/run-all.js", (s) => s.replace("indexing.test.js", "indexing-old.test.js")));
}

// S63: back from Comments or Report a wrong link (the Auth client without its cross-tab channel, the page guard)
control("the Auth client keeps its cross-tab channel", "S63", edit("js/session.js", (s) => s.replace("    globalThis.BroadcastChannel = undefined;\n", "")));
control("the channel is never put back", "S63", edit("js/session.js", (s) => s.replace("} finally { globalThis.BroadcastChannel = channel; }", "} finally { }")));
control("the client is created before the channel is hidden", "S63", edit("js/session.js", (s) => s.replace("    globalThis.BroadcastChannel = undefined;\n    try {\n    client = new GoTrueClient({", "    try {\n    client = new GoTrueClient({").replace("    } finally {", "    globalThis.BroadcastChannel = undefined;\n    } finally {")));
control("another script opens a channel", "S63", append("js/pages/comments.js", "const bc = new BroadcastChannel('x');"));
control("an unload handler", "S63", append("js/pages/search.js", "window.addEventListener('unload', () => {});"));
control("an onunload handler", "S63", append("js/pages/edit.js", "window.onunload = () => {};"));
control("the page guard is gone", "S63", edit("js/pages/search.js", (s) => s.replace('window.addEventListener("pageshow", async (ev) => {', 'window.addEventListener("pageshow-gone", async (ev) => {')));
control("the guard runs for every load", "S63", edit("js/pages/search.js", (s) => s.replace("if (!ev.persisted) return;", "")));
control("the guard keeps the results", "S63", edit("js/pages/search.js", (s) => s.replace("closeModal(); clear(resultsEl); countEl.hidden = true; hideRecap(); lastSearch = null; status.clear();", "lastSearch = null;")));
control("the new test is not part of the full run", "S63", edit("tests/run-all.js", (s) => s.replace("back-restore.test.js", "back-restore-gone.test.js")));
// S62: the search page opened with the company and one other value in the URL fragment (extension hand-off)
{
  control("the fragment is no longer taken out of the address bar", "S62", edit("js/fragment-prefill.js", (s) => s.replace("win.history.replaceState(", "win.history.pushState(")));
  control("the search page never reads the fragment", "S62", edit("js/pages/search.js", (s) => s.replace("if (applyFragmentPrefill({ win: window, companyEl: companyIn, queryEl: queryIn, reqEl: reqIn })) takePending(localStorage);", "")));
  control("the fragment starts the search by itself", "S62", edit("js/pages/search.js", (s) => s.replace("reqEl: reqIn })) takePending(localStorage);", "reqEl: reqIn })) { takePending(localStorage); runSearch(); }")));
  control("the title limit is raised", "S62", edit("js/fragment-prefill.js", (s) => s.replace("req: 100, title: 80 };", "req: 100, title: 8000 };")));
  control("a key given twice is accepted", "S62", edit("js/fragment-prefill.js", (s) => s.replace("if (found.has(key)) { bad = true; continue; }", "if (found.has(key)) { continue; }")));
  control("a control character is accepted", "S62", edit("js/fragment-prefill.js", (s) => s.replace("if (hasControl(value)) { bad = true; continue; }", "")));
  control("more than one second value is accepted", "S62", edit("js/fragment-prefill.js", (s) => s.replace("seconds.length !== 1", "seconds.length < 1")));
  control("the fragment text goes into the page as markup", "S62", edit("js/fragment-prefill.js", (s) => s.replace("companyEl.value = result.company;", "companyEl.value = result.company; companyEl.insertAdjacentHTML(\"afterend\", result.company);")));
  control("the fragment test is not run", "S62", edit("tests/run-all.js", (s) => s.replace("fragment-prefill.test.js", "fragment-prefill-old.test.js")));
}

// S61: the emailed one-time code typed in the same tab (Phase 4)
{
  control("the code is confirmed with the wrong call", "S61", edit("js/session.js", (s) => s.replace('call("email");', 'call("sms");')));
  control("the search page loses its code field", "S61", edit("js/pages/search.js", (s) => s.replace("if (CODE_ENABLED) {", "if (false) {")));
  control("the employer page loses its code field", "S61", edit("js/pages/employer-signin.js", (s) => s.replace("if (CODE_ENABLED) {", "if (false) {")));
  control("the callback shows the landing note after a typed code", "S61", edit("js/pages/auth-callback.js", (s) => s.replace('if (!viaCode) markLanded(sessionStorage, "poster");', 'markLanded(sessionStorage, "poster");')));
  control("the code field is no one-time-code field", "S61", edit("js/code-entry.js", (s) => s.replace('autocomplete: "one-time-code"', 'autocomplete: "off"')));
  control("the emailed code test is not run", "S61", edit("tests/run-all.js", (s) => s.replace("code-entry.test.js", "code-entry-old.test.js")));
  control("the switch line is removed", "S61", edit("js/config.js", (s) => s.replace("export const EMAIL_CODE_ENTRY = false;", "")));
  control("the switch ships on", "S61", edit("js/config.js", (s) => s.replace("export const EMAIL_CODE_ENTRY = false;", "export const EMAIL_CODE_ENTRY = true;")));
}
}
// S64: no database script in anything Pages serves (no .sql file anywhere, no top-level db folder)
const put = (rel, text) => (dir) => { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
control("a .sql file at the top of the repository", "S64", put("migration.sql", "select 1;\n"));
control("a .sql file inside tests/", "S64", put("tests/probe.sql", "select 1;\n"));
control("a .SQL file in a new folder", "S64", put("notes/RUN.SQL", "select 1;\n"));
control("a top-level db folder with a text note", "S64", put("db/notes.txt", "a note\n"));
control("a top-level DB folder (capitals)", "S64", put("DB/notes.txt", "a note\n"));

// S65: the staff-only search scope
control("the staff banner words are changed", "S65", edit("js/staff-scope.js", (s) => s.replace("including ones that are not live.", "including ones that are live.")));
control("scope matches in any case or with repeats", "S65", edit("js/staff-scope.js", (s) => s.replace('all.length === 1 && all[0] === "all"', 'all.length >= 1 && all[0].toLowerCase() === "all"')));
control("a posting word in the staff wording", "S65", edit("js/staff-scope.js", (s) => s.replace('draft: "Draft"', 'draft: "Draft posting"')));
control("the page starts staff mode on the address alone", "S65", edit("js/pages/search.js", (s) => s.replace("if (r.ok && r.data === true) enterStaffMode();", "enterStaffMode();")));
control("the page starts staff mode on any answer", "S65", edit("js/pages/search.js", (s) => s.replace("if (r.ok && r.data === true) enterStaffMode();", "if (r.ok) enterStaffMode();")));
control("staff mode can start in a second place", "S65", edit("js/pages/search.js", (s) => s.replace("async function detectStaff() {", "async function detectStaff() { if (STAFF_REQUESTED && !session) enterStaffMode();")));
control("the staff search saves the search in the browser", "S65", edit("js/pages/search.js", (s) => s.replace("let r = await api.staffSearch(Object.assign({ p_company: c.value }, key));", "savePending(localStorage, {}); let r = await api.staffSearch(Object.assign({ p_company: c.value }, key));")));
control("the staff search calls the candidate search", "S65", edit("js/pages/search.js", (s) => s.replace("let r = await api.staffSearch(Object.assign({ p_company: c.value }, key));", "await api.candidateSearch({}); let r = await api.staffSearch(Object.assign({ p_company: c.value }, key));")));
control("the staff page is not marked noindex", "S65", edit("js/pages/search.js", (s) => s.split('"noindex, nofollow"').join('"index, follow"')));
control("staff results are kept when the page is left", "S65", edit("js/pages/search.js", (s) => s.replace('window.addEventListener("pagehide", () => { if (staffMode) {', 'window.addEventListener("pagehide", () => { if (false) {')));
control("a staff card is built with innerHTML", "S65", edit("js/pages/search.js", (s) => s.replace("function renderStaffCard(row) {", "function renderStaffCard(row) { document.body.innerHTML = '';")));
control("search.html mentions staff", "S65", append("search.html", "<!-- staff -->"));
control("another page script uses the staff check", "S65", append("js/pages/team.js", "api.isStaff();"));
control("the rpc helper may cache", "S65", edit("js/api.js", (s) => s.replace('body: JSON.stringify(body === undefined ? {} : body), cache: "no-store" });\n      text = await res.text();\n    } catch {\n      return { ok: false, status: 0, error: { code: "network" } };\n    }\n    if (!res.ok) return { ok: false, status: res.status, error: { code: "refused" } };', 'body: JSON.stringify(body === undefined ? {} : body) });\n      text = await res.text();\n    } catch {\n      return { ok: false, status: 0, error: { code: "network" } };\n    }\n    if (!res.ok) return { ok: false, status: res.status, error: { code: "refused" } };')));
control("a third database function is called directly", "S65", edit("js/api.js", (s) => s.replace("    isStaff: () => rpc(", '    anything: () => rpc("operator_list_postings", {}),\n    isStaff: () => rpc(')));

// S66 (2026-10-09): the opening vocabulary in anything a person reads
control("the home page says listing again", "S66", edit("index.html", (s) => s.replace("Every opening here is disclosed by the employer:", "Every listing here is disclosed by the employer:")));
control("the home page says registry again", "S66", edit("index.html", (s) => s.replace(">A place to check job openings that employers disclose</div>", ">A registry of job openings disclosed by employers</div>")));
control("the privacy page says registry again", "S66", edit("privacy.html", (s) => s.replace("FightGhostJobs runs on Supabase", "The registry runs on Supabase")));
control("the privacy page title has an em dash again", "S66", edit("privacy.html", (s) => s.replace("<title>FightGhostJobs | Privacy</title>", "<title>FightGhostJobs \u2014 Privacy</title>")));
control("a button says Posting again", "S66", edit("js/pages/comments.js", (s) => s.replace('send.textContent = "Sending\u2026"', 'send.textContent = "Posting\u2026"')));
control("the employer notice says posting comments again", "S66", edit("js/pages/comments.js", (s) => s.replace("Reading and leaving comments here", "Reading and posting comments here")));
control("the analytics page says registry again", "S66", edit("js/pages/analytics.js", (s) => s.replace("Of all searches + detail views on FightGhostJobs", "Of all searches + detail views on the registry")));
control("the staging gate says registry again", "S66", edit("js/stage-gate.js", (s) => s.replace("sample and test data only.", "sample and test data, not the registry.")));
control("a placeholder says a job board listing again", "S66", edit("comments.html", (s) => s.replace("opened a job ad for a different role.", "opened a job board listing for a different role.")));
control("a screen reader label says certified", "S66", edit("search.html", (s) => s.replace('aria-label="What\'s the req number?', 'aria-label="Certified: what\'s the req number?')));
control("a script string says compliant", "S66", edit("js/pages/search.js", (s) => s.replace('"Searching\u2026"', '"Compliant search\u2026"')));
control("an opening is called listed without the word opening", "S66", edit("index.html", (s) => s.replace("Every opening here is disclosed by the employer:", "Every job here is listed by the employer:")));
control("a text has an en dash", "S66", edit("search.html", (s) => s.replace("Search for one specific job you already know about.", "Search for one specific job \u2013 you already know about.")));

// S59 / S59b (2026-10-09): the link label words
control("the employer page says not verified by us again", "S59", edit("edit.html", (s) => s.replace('"employer-provided link, not checked by us"', '"employer-provided link, not verified by us"')));
control("the register page says not verified by us again", "S59", edit("register.html", (s) => s.replace('"employer-provided link, not checked by us"', '"employer-provided link, not verified by us"')));
control("the details window says we could not verify it again", "S59", edit("search.html", (s) => s.replace("we could not check it", "we could not verify it")));
control("the employer page loses the pinned label sentence", "S59", edit("edit.html", (s) => s.replace('"employer-provided link, not checked by us"', '"an employer-provided link"')));
control("the stored label fixture goes back to the old label", "S59", edit("tests/edit.test.js", (s) => s.split("Employer-provided link, not checked by us").join("Employer-provided link, not verified by us")));
control("the stored label fixture drifts", "S59", edit("tests/api.test.js", (s) => s.replace("Employer-provided link, not checked by us", "Employer-provided link, unchecked")));

// S66 (2026-10-09, prompt AZ): "Registered" is the paid status word only; the free action is "Add an opening"
control("the home page button says Register an Opening again", "S66", edit("index.html", (s) => s.replace("Add an Opening \u2192", "Register an Opening \u2192")));
control("the register page heading says Register an opening again", "S66", edit("register.html", (s) => s.replace(">Add an opening</h1>", ">Register an opening</h1>")));
control("the register page title says Register an Opening again", "S66", edit("register.html", (s) => s.replace("<title>FightGhostJobs | Add an Opening</title>", "<title>FightGhostJobs | Register an Opening</title>")));
control("the register button says Register opening again", "S66", edit("js/pages/register.js", (s) => s.replace('"Add and schedule" : "Add opening"', '"Register and schedule" : "Register opening"')));
control("the success heading says Registered again", "S66", edit("js/pages/register.js", (s) => s.replace('"Added. It is live now."', '"Registered. It is live now."')));
control("the details window says registered through again", "S66", edit("js/pages/search.js", (s) => s.replace("This opening was added through FightGhostJobs by the employer.", "This opening was registered through FightGhostJobs by an employer.")));
control("the My openings column says Registered again", "S66", edit("dashboard.html", (s) => s.replace('aria-label="Sort by date added">Added <span', 'aria-label="Sort by date added">Registered <span')));
control("the team page says who can register openings", "S66", edit("team.html", (s) => s.replace("who can add openings for your organization.", "who can register openings for your organization.")));
control("a search result chip says Registered with a date again", "S66", edit("js/chips.js", (s) => s.replace('text: "Added " + fmtDateTz(p.posted_at, tz)', 'text: "Registered " + fmtDateTz(p.posted_at, tz)')));
control("the privacy heading says register openings again", "S66", edit("privacy.html", (s) => s.replace("If you add openings", "If you register openings")));

// S67 (2026-10-09): the page never sees a plan; the check mark is one strict boolean read in one place
control("the search page reads is_registered directly", "S67", edit("js/pages/search.js", (s) => s.replace('isRegistered(row) ? h("div", { class: "pill badge-verified", style: "flex-shrink:0;" }', 'row.is_registered ? h("div", { class: "pill badge-verified", style: "flex-shrink:0;" }')));
control("the staff card draws the mark without the rule", "S67", edit("js/pages/search.js", (s) => s.replace('isRegistered(row) ? h("div", { class: "pill badge-verified" }, "✓ Registered") : null', 'h("div", { class: "pill badge-verified" }, "✓ Registered")')));
control("the rule accepts any truthy value", "S67", edit("js/registered.js", (s) => s.replace("row.is_registered === true", "!!row.is_registered")));
control("the search page names the plan", "S67", edit("js/pages/search.js", (s) => 'const plan = "verified";\n' + s));
control("the search page names a paid source", "S67", edit("js/pages/search.js", (s) => 'const source = "paid";\n' + s));
control("a script names the stored plan source column", "S67", edit("js/chips.js", (s) => s + '\nexport const SOURCE_COLUMN = "plan_source";\n'));
control("a page string says promotional", "S67", edit("js/pages/analytics.js", (s) => s.replace("Share of FightGhostJobs traffic", "Share of promotional traffic")));

fs.rmSync(tmpBase, { recursive: true, force: true });
console.log("site-check controls: " + n + " defects, " + missed + " missed");
process.exit(missed ? 1 : 0);
