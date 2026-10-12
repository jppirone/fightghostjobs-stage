// kio.js - the KIO ID on this site (prompt BQ, October 12, 2026; KIO_ID_Spec_v2). Pure functions, no browser API: unit tested (tests/kio.unit.test.js) and compared with the extension's kio.js, the edge functions and the
// database's public.kio_* functions by tests/kio-parity.test.js.
//   STORED FORM    the prefix + 12 characters, no hyphens, upper case:        KIO7K3M9Q2XW4T9
//   SHOWN FORM     PREFIX-XXXX-XXXX-XXXX (the hyphens are for the eye only):  KIO-7K3M-9Q2X-W4T9
//   THE 12 CHARACTERS: 11 random characters and 1 check character over the 32 character alphabet (digits and capital letters without I, L, O and U).
// WHAT IS ACCEPTED as input: any case; spaces and hyphens ignored; I and L read as 1; O reads as 0; the prefix with or without its hyphen; and a code WITHOUT the prefix when its 12 characters pass the check.
// Nothing is guessed: a code that does not pass the check is never a KIO ID. An old 12 character code that fails the check goes through exactly as it always did.
import { KIO_PREFIX, KIO_SHORT_LINK_HOST, KIO_SHORT_LINK_LIVE } from "./config.js?v=9bf25cae";

export const KIO_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export { KIO_PREFIX };

// ====================================================================================================================================================================================================================
// THE CHECK ALGORITHM: Luhn mod N with N = 32 over the alphabet, applied to the 11 body characters only (the prefix is not part of it). A character's value is its position in the alphabet (0 for "0", 31 for "Z").
// This is the ONLY part of the file that a different algorithm would change (the same part is marked in the extension's kio.js, the edge copies and the database functions).
const N = KIO_ALPHABET.length;
const POINT = new Map([...KIO_ALPHABET].map((c, i) => [c, i]));
function lunSum(chars, factor) {
  let sum = 0;
  for (let i = chars.length - 1; i >= 0; i--) {
    let addend = factor * POINT.get(chars[i]);
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / N) + (addend % N);
    sum += addend;
  }
  return sum;
}
export function kioCheckChar(body) {
  const b = String(body);
  if (b.length !== 11 || ![...b].every((c) => POINT.has(c))) return null;
  return KIO_ALPHABET[(N - (lunSum(b, 2) % N)) % N];
}
export function kioValid(code12) {
  const c = String(code12);
  return c.length === 12 && [...c].every((ch) => POINT.has(ch)) && lunSum(c, 1) % N === 0;
}
// ====================================================================================================================================================================================================================

const BODY_RE = "[0-9A-HJKMNP-TV-Z]";
// the stored form of the ID an employer sees (the prefix + 12 characters) or, until the migration has run, the old 12 characters
export const POST_ID_RE = new RegExp("^(?:" + KIO_PREFIX + ")?[0-9A-Z]{12}$");   // a shape guard on what the server sends, as it always was (any capital letter or digit); the check character is the server's business
// the shown form
export const KIO_ID_SHOWN_RE = new RegExp("^" + KIO_PREFIX + "-" + BODY_RE + "{4}-" + BODY_RE + "{4}-" + BODY_RE + "{4}$");
export const isKioShown = (s) => typeof s === "string" && KIO_ID_SHOWN_RE.test(s);

export const kioStored = (code12) => KIO_PREFIX + code12;
export const kioDisplay = (code12) => KIO_PREFIX + "-" + code12.slice(0, 4) + "-" + code12.slice(4, 8) + "-" + code12.slice(8, 12);
// the shown form of any stored postID: the stored form KIO + 12 -> KIO-XXXX-XXXX-XXXX; the old 12 characters -> XXXX-XXXX-XXXX; anything else comes back as it is
export function displayId(stored) {
  const s = typeof stored === "string" ? stored : "";
  const m = new RegExp("^" + KIO_PREFIX + "([0-9A-Z]{12})$").exec(s);
  if (m) return kioDisplay(m[1]);
  return /^[0-9A-Z]{12}$/.test(s) ? s.slice(0, 4) + "-" + s.slice(4, 8) + "-" + s.slice(8) : String(stored == null ? "" : stored);
}
const hyphenate12 = (s) => s.slice(0, 4) + "-" + s.slice(4, 8) + "-" + s.slice(8, 12);

// the characters that are ignored in a typed ID: white space (the no-break space too), the hyphen, the other dashes of text (code points 8208 to 8213) and the minus sign (8722). Built from their code numbers so that this file has
// no long dash in it (the static rule of the site check)
const OTHER_DASHES = [8208, 8209, 8210, 8211, 8212, 8213, 8722].map((c) => String.fromCharCode(c)).join("");
const SEPARATORS = new RegExp("[\\s\\-" + OTHER_DASHES + "]+", "g");
const IN_ALPHABET = (s) => [...s].every((c) => POINT.has(c));
export const kioSubstitute = (s) => s.replace(/[IL]/g, "1").replace(/O/g, "0");

// what a text is: -> { kind: "kio", code, stored, display, hadPrefix, legacy } | { kind: "old", display } | { kind: "none", reason }
//   legacy: the old looking form of a KIO ID that was given WITHOUT its prefix (whose characters are all in the alphabet), else null
export function readKio(raw) {
  const s = String(raw == null ? "" : raw).toUpperCase().replace(SEPARATORS, "");
  if (s === "" || !/^[0-9A-Z]+$/.test(s)) return { kind: "none", reason: "characters" };
  if (s.length === KIO_PREFIX.length + 12) {
    if (kioSubstitute(s.slice(0, KIO_PREFIX.length)) !== kioSubstitute(KIO_PREFIX)) return { kind: "none", reason: "no-prefix" };
    const code = kioSubstitute(s.slice(KIO_PREFIX.length));
    if (!IN_ALPHABET(code)) return { kind: "none", reason: "alphabet" };
    if (!kioValid(code)) return { kind: "none", reason: "check" };
    return { kind: "kio", code, stored: kioStored(code), display: kioDisplay(code), hadPrefix: true, legacy: null };
  }
  if (s.length === 12) {
    const code = kioSubstitute(s);
    if (IN_ALPHABET(code) && kioValid(code)) return { kind: "kio", code, stored: kioStored(code), display: kioDisplay(code), hadPrefix: false, legacy: IN_ALPHABET(s) ? hyphenate12(s) : null };
    if (IN_ALPHABET(s)) return { kind: "old", display: hyphenate12(s) };
    return { kind: "none", reason: "alphabet" };
  }
  return { kind: "none", reason: "length" };
}

// does this text LOOK like an attempt at a KIO ID (the prefix, then three groups of four, with or without separators between the groups)? A title such as "Kiosk Operator II" does not. The search page uses it to say "That ID is not
// valid" at once for an ID that was mistyped (a wrong check character) instead of searching the text as a title; it is never used to accept anything.
const typedClass = (c) => "[" + (c === "I" || c === "L" ? "IL1" : c === "O" || c === "0" ? "O0" : c) + "]";
const LOOKS_LIKE = new RegExp("^\\s*" + [...KIO_PREFIX].map(typedClass).join("") + "[\\s\\-]?[0-9A-Z]{4}[\\s\\-]?[0-9A-Z]{4}[\\s\\-]?[0-9A-Z]{4}\\s*$", "i");
export const looksLikeKio = (raw) => LOOKS_LIKE.test(String(raw == null ? "" : raw));

// ---- the short link and the lines an employer puts in a job ad (the employer's pages: js/kio-block.js)
export const shortLinkOf = (shown) => KIO_SHORT_LINK_HOST + "/" + shown;
// the lines for a job ad, in order: the ID line always; the "Check this opening" line only while the short link is live (js/config.js KIO_SHORT_LINK_LIVE). `live` is a parameter so a test can name both states.
export function adLines(shown, live = KIO_SHORT_LINK_LIVE) {
  const lines = ["KIO ID: " + shown];
  if (live === true) lines.push("Check this opening: " + shortLinkOf(shown));
  return lines;
}

// the receiving page (404.html): what a path on this site is, when it is a KIO ID: /KIO-7K3M-9Q2X-W4T9 or /kio7k3m9q2xw4t9 ... -> the stored form, else null. Only a KIO ID that passes the check is ever forwarded.
export function kioFromPath(pathname) {
  const p = String(pathname == null ? "" : pathname).replace(/^\/+/, "").replace(/\/+$/, "");
  if (p === "" || p.includes("/") || p.length > 40) return null;
  let t = p; try { t = decodeURIComponent(p); } catch { return null; }
  const r = readKio(t);
  return r.kind === "kio" && r.hadPrefix ? r.stored : null;
}
