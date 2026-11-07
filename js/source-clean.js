// source-clean.js - the limit of the optional "where you found this job" text (prompt JD, November 7, 2026). A small file with no imports, no browser API, nothing stored, nothing sent, nothing logged: the phone model, the search page
// and the saved search of the sign in hand-off all use this one function, so the three can not drift apart. The SERVER applies the same rule again and does the real cleaning (public.search_event_source_clean); the page never sends a cleaned value.
// limitSource(raw): remove control characters (code below 32 and 127 to 159, line breaks and tabs included), turn every run of white space into one space, trim, and cut at SOURCE_MAX characters counted as WHOLE characters
// (a character outside the basic plane is never cut in the middle). Anything that is not a string gives "". The text is kept exactly as typed otherwise (case, address, spelling).

export const SOURCE_MAX = 120;

export function limitSource(raw) {
  if (typeof raw !== "string") return "";
  let out = "";
  for (const ch of raw) {
    const c = ch.codePointAt(0);
    if (c === 9 || c === 10 || c === 11 || c === 12 || c === 13 || c === 0x2028 || c === 0x2029 || c === 0x85) { out += " "; continue; }   // a break or a tab is white space, not a deleted character
    if (c < 32 || (c >= 127 && c <= 159)) continue;
    out += ch;
  }
  out = out.replace(/\s+/g, " ").trim();
  const chars = Array.from(out);
  return chars.length <= SOURCE_MAX ? out : chars.slice(0, SOURCE_MAX).join("").trim();
}
