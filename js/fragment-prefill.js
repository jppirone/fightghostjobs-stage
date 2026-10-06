// fragment-prefill.js - the search page can be opened with the company and ONE other value in the URL FRAGMENT (October 6, 2026), for example by the FightGhostJobs browser extension:
//   search.html#c=<company>&p=<postID>     or    #c=<company>&r=<req number>     or    #c=<company>&t=<title>
// The fragment (after #) is never sent to a server. This module reads it, fills the Company box and the ONE other box, and takes the fragment out of the address bar AT ONCE. It never runs the search:
// the person presses Search (and, signed out, goes through the same email step as always; nothing about sign-in changes). The req number goes into the req box, which stays hidden as it is today.
//
// THE FRAGMENT IS UNTRUSTED INPUT FROM ANY SOURCE (any web page can link to this page). Rules, all checked by tests/fragment-prefill.unit.test.js and tests/fragment-prefill.test.js:
//   - only the keys c, p, r, t are read; every other key is ignored; a fragment with none of them is not ours and is left exactly as it is (the sign-in link's fragment must reach the Auth client untouched)
//   - plain text only: the values are put into the boxes with .value, never into the page as HTML, and a value with a control character is refused
//   - a maximum length per value (company 200, postID 14, req number 100, title 80, the site's own limits) and for the whole fragment; a longer value refuses the whole fragment (nothing is cut, nothing is guessed)
//   - a key given twice, a bad percent escape, a missing company, or MORE THAN ONE of postID, req number and title (the page takes the req box or the postID/title box, never both) refuses the whole fragment
//   - a refused fragment fills nothing, and is still removed from the address bar

export const FRAGMENT_KEYS = { c: "company", p: "postid", r: "req", t: "title" };
export const FRAGMENT_MAX = { company: 200, postid: 14, req: 100, title: 80 };
const MAX_TOTAL = 700, MAX_PARTS = 12;
const hasControl = (s) => Array.from(s).some((ch) => { const c = ch.codePointAt(0); return c < 32 || c === 127 || c === 0x2028 || c === 0x2029; });

// -> { ours: boolean, result: { company, kind: "postid" | "req" | "title", value } | null }
export function parseSearchFragment(hash) {
  const raw = String(hash == null ? "" : hash).replace(/^#/, "");
  const pieces = raw.split("&");
  const found = new Map();
  let ours = false, bad = raw.length > MAX_TOTAL || pieces.length > MAX_PARTS;
  for (const piece of pieces.slice(0, MAX_PARTS)) {
    const eq = piece.indexOf("=");
    if (eq < 1) continue;
    const key = piece.slice(0, eq);
    if (!Object.prototype.hasOwnProperty.call(FRAGMENT_KEYS, key)) continue;   // an unknown key (or "__proto__") is ignored
    ours = true;
    if (found.has(key)) { bad = true; continue; }
    let value;
    try { value = decodeURIComponent(piece.slice(eq + 1)); } catch { bad = true; continue; }
    if (hasControl(value)) { bad = true; continue; }
    found.set(key, value.trim());
  }
  if (!ours) return { ours: false, result: null };
  if (bad) return { ours: true, result: null };
  const company = found.get("c") || "", seconds = ["p", "r", "t"].filter((k) => found.has(k));
  if (company === "" || company.length > FRAGMENT_MAX.company || seconds.length !== 1) return { ours: true, result: null };
  const kind = FRAGMENT_KEYS[seconds[0]], value = found.get(seconds[0]);
  if (value === "" || value.length > FRAGMENT_MAX[kind]) return { ours: true, result: null };
  return { ours: true, result: { company, kind, value } };
}

// win: the window; fills the boxes (text only) and removes the fragment from the address bar before anything else happens. -> true when the boxes were filled
export function applyFragmentPrefill({ win, companyEl, queryEl, reqEl }) {
  const { ours, result } = parseSearchFragment(win.location.hash);
  if (!ours) return false;
  try { win.history.replaceState(win.history.state, "", win.location.pathname + win.location.search); } catch { /* the address bar keeps the fragment; the boxes are still filled below */ }
  if (!result) return false;
  companyEl.value = result.company;
  if (result.kind === "req") reqEl.value = result.value; else queryEl.value = result.value;
  return true;
}
