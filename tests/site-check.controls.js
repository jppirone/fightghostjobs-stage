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
control("target=_blank without noopener in markup", "S12", edit("index.html", (s) => s.replace('<a class="nav-logo" href="index.html">', '<a class="nav-logo" target="_blank" href="index.html">')));
control("a new tab opened without noopener", "S12", append("js/pages/index.js", "window.open('x.html', '_blank');"));
control("app.css loaded before styles.css", "S13", edit("register.html", (s) => s.replace('<link rel="stylesheet" href="styles.css">\n<link rel="stylesheet" href="app.css">', '<link rel="stylesheet" href="app.css">\n<link rel="stylesheet" href="styles.css">')));

control("the closed-or-expired sentence removed from the note", "S14", edit("js/search-input.js", (s) => s.replace(" Closed or expired postings appear only when you search by req code.", "")));
control("the sentence reworded", "S14", edit("js/search-input.js", (s) => s.replace("appear only when you search by req code.", "may appear if you search by req code.")));
control("search.js goes back to its own hand-written message", "S14", edit("js/pages/search.js", (s) => s.replace("empty-note\", style: \"margin-top:0;\" }, NO_MATCH_NOTE))", "empty-note\", style: \"margin-top:0;\" }, \"No posting matched. Check the name.\"))")));
control("search.js no longer imports the note", "S14", edit("js/pages/search.js", (s) => s.replace("classifyQuery, NO_MATCH_NOTE }", "classifyQuery }")));

fs.rmSync(tmpBase, { recursive: true, force: true });
console.log("site-check controls: " + n + " defects, " + missed + " missed");
process.exit(missed ? 1 : 0);
