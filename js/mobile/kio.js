// kio.js - the KIO ID: the permanent identifier of an opening (KIO_ID_Spec_v2, John's decisions of October 8, 2026). Pure functions, no browser API: unit tested (tests/kio.test.js).
//   STORED FORM    KIO + 12 characters, no hyphens, upper case (15 characters):                    KIO7K3M9Q2XW4T9
//   DISPLAYED FORM KIO-XXXX-XXXX-XXXX (18 characters; the hyphens are for the eye only):          KIO-7K3M-9Q2X-W4T9
//   THE 12 CHARACTERS: 11 random characters (the body) and 1 check character, over the 32 character alphabet below (digits and capital letters without I, L, O and U).
// WHAT IS ACCEPTED as input (a person typed it, a page showed it, a picture was read): any case; spaces and hyphens anywhere are ignored; I and L read as 1; O reads as 0; the prefix with or without its hyphen; and a code
// WITHOUT the prefix when its 12 characters pass the check. A code that does not pass is never a KIO ID: NOTHING IS GUESSED.
// THE OLD FORMAT (XXXX-XXXX-XXXX, no prefix, 12 characters over the same alphabet) is still read. It has the same length as a KIO body without its prefix, so the order of tests is: a 12 character code that PASSES the check is a KIO ID
// (the prefix is added); one that does not pass is an old code and goes through exactly as it always did (never corrected: an O stays an O and is refused). About 1 old code in 32 passes the check by chance.

export const KIO_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const KIO_PREFIX = "KIO";
export const KIO_STORED_LENGTH = 15, KIO_DISPLAY_LENGTH = 18, KIO_CODE_LENGTH = 12;

// ====================================================================================================================================================================================================================
// THE CHECK ALGORITHM: Luhn mod N with N = 32 over the alphabet, applied to the 11 body characters only (the prefix is not part of it). This is the ONLY part of the file that a different algorithm would change.
// A character's code point is its position in the alphabet (0 for "0", 31 for "Z").
const N = KIO_ALPHABET.length;
const POINT = new Map([...KIO_ALPHABET].map((c, i) => [c, i]));
// the sum of the loop over `chars` from the LAST to the FIRST, starting with `factor` (2 when a check character is being made, 1 when a code that already has its check character is being tested)
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
// the check character of an 11 character body (null when the body has a character outside the alphabet)
export function kioCheckChar(body) {
  const b = String(body);
  if (b.length !== KIO_CODE_LENGTH - 1 || ![...b].every((c) => POINT.has(c))) return null;
  return KIO_ALPHABET[(N - (lunSum(b, 2) % N)) % N];
}
// is this 12 character code (body + check character, already in the alphabet and in capitals) valid?
export function kioValid(code12) {
  const c = String(code12);
  return c.length === KIO_CODE_LENGTH && [...c].every((ch) => POINT.has(ch)) && lunSum(c, 1) % N === 0;
}
// ====================================================================================================================================================================================================================

export const kioStored = (code12) => KIO_PREFIX + code12;
export const kioDisplay = (code12) => KIO_PREFIX + "-" + code12.slice(0, 4) + "-" + code12.slice(4, 8) + "-" + code12.slice(8, 12);
const hyphenate12 = (s) => s.slice(0, 4) + "-" + s.slice(4, 8) + "-" + s.slice(8, 12);
// the characters that are ignored in a code: white space (the no-break space too), the hyphen, the other dashes of text (code points 8208 to 8213) and the minus sign (8722). They are built from their code
// numbers so that this file itself has no long dash in it (the static rule of tests/build.test.js)
const OTHER_DASHES = [8208, 8209, 8210, 8211, 8212, 8213, 8722].map((c) => String.fromCharCode(c)).join("");
const SEPARATORS = new RegExp("[\\s\\-" + OTHER_DASHES + "]+", "g");
const IN_ALPHABET = (s) => [...s].every((c) => POINT.has(c));
// I and L read as 1, O reads as 0 (the alphabet has none of the three letters)
export const kioSubstitute = (s) => s.replace(/[IL]/g, "1").replace(/O/g, "0");

// what a text is: -> { kind: "kio", code, stored, display, hadPrefix, legacy } | { kind: "old", display } | { kind: "none", reason }
//   legacy: the old looking form (XXXX-XXXX-XXXX) of a KIO ID that was given WITHOUT its prefix and whose characters are all in the alphabet, else null (see the report: the search page of today still knows only the old form)
export function readKio(raw) {
  const s = String(raw == null ? "" : raw).toUpperCase().replace(SEPARATORS, "");
  if (s === "" || !/^[0-9A-Z]+$/.test(s)) return { kind: "none", reason: "characters" };   // empty, or something that is not a letter or a digit
  if (s.length === KIO_STORED_LENGTH) {
    if (!/^K[IL1][O0]/.test(s)) return { kind: "none", reason: "no-prefix" };       // 15 characters but no KIO prefix
    const code = kioSubstitute(s.slice(3));
    if (!IN_ALPHABET(code)) return { kind: "none", reason: "alphabet" };            // a character outside the alphabet
    if (!kioValid(code)) return { kind: "none", reason: "check" };                  // the check character does not fit
    return { kind: "kio", code, stored: kioStored(code), display: kioDisplay(code), hadPrefix: true, legacy: null };
  }
  if (s.length === KIO_CODE_LENGTH) {
    const code = kioSubstitute(s);
    if (IN_ALPHABET(code) && kioValid(code)) return { kind: "kio", code, stored: kioStored(code), display: kioDisplay(code), hadPrefix: false, legacy: IN_ALPHABET(s) ? hyphenate12(s) : null };
    if (IN_ALPHABET(s)) return { kind: "old", display: hyphenate12(s) };   // never corrected: an O stays an O and is refused above
    return { kind: "none", reason: "alphabet" };
  }
  return { kind: "none", reason: "length" };   // not 12 and not 15 characters
}

// What is typed or pasted into the box, written the way the box shows it. Nothing is corrected while typing (an O stays an O): a KIO ID shows as KIO-XXXX-XXXX-XXXX, an old code as XXXX-XXXX-XXXX.
// `caret` is the position in the typed text (kept in the same place in the result). -> { value, caret }
export function formatKioInput(raw, caret) {
  const text = String(raw == null ? "" : raw), at = caret == null ? text.length : Math.max(0, Math.min(caret, text.length));
  const clean = (t) => t.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const all = clean(text);
  const prefixed = /^KIO/.test(all) || (all.length > KIO_CODE_LENGTH && /^K[IL1][O0]/.test(all));
  const cap = prefixed ? KIO_STORED_LENGTH : KIO_CODE_LENGTH;
  let chars = all.slice(0, cap), keep = Math.min(clean(text.slice(0, at)).length, chars.length);
  // a whole code that passes the check is shown in its KIO form (a code pasted without the prefix gets it)
  if (chars.length === KIO_CODE_LENGTH || chars.length === KIO_STORED_LENGTH) { const r = readKio(chars); if (r.kind === "kio") return { value: r.display, caret: r.display.length }; }
  const render = (c) => {
    if (prefixed) { const body = c.slice(3); return c.length <= 3 ? c : c.slice(0, 3) + "-" + [body.slice(0, 4), body.slice(4, 8), body.slice(8, 12)].filter(Boolean).join("-"); }
    return c.length > 8 ? c.slice(0, 4) + "-" + c.slice(4, 8) + "-" + c.slice(8) : c.length > 4 ? c.slice(0, 4) + "-" + c.slice(4) : c;
  };
  return { value: render(chars), caret: render(chars.slice(0, keep)).length };
}

// the order of tests in readKio, by name (tests/kio.test.js checks each):
//   "prefixed": 15 characters starting K, I or 1 or L, O or 0: a KIO ID if the check passes, else not valid
//   "plain":    12 characters: a KIO ID (the prefix is added) if the check passes, else an old code if all are in the alphabet, else not valid
//   "other":    any other length: not valid
export const KIO_ORDER_OF_TESTS = ["prefixed", "plain", "other"];
