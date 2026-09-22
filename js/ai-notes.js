// ai-notes.js - the employer's own words about their AI use (design brief 18.1): one optional note under each AI toggle, shown to candidates next to the toggle's chip. Pure (no DOM): tested in Node.
// The rule is the database's (public.ai_note_problem): at most 300 characters, one paragraph of plain text (no line breaks, tabs, control or invisible characters), and NO web address in any
// disguise, so the note can never become an untracked link. No civility filter: the note is attributed disclosure, written by a signed-in poster and logged with every edit.

export const MAX_AI_NOTE = 300;
// the forbidden characters, built by code point so the file itself never holds a control character: C0 and C1 controls, soft hyphen, combining grapheme joiner, Mongolian vowel separator,
// zero-width spaces/joiners and bidi marks, line/paragraph separators and bidi overrides, word joiner and invisible operators, the byte-order mark
const cc = (n) => String.fromCharCode(n);
const BAD_CHARS = new RegExp("[" + cc(0) + "-" + cc(31) + cc(127) + "-" + cc(159) + cc(173) + cc(847) + cc(6158) + cc(8203) + "-" + cc(8207) + cc(8232) + "-" + cc(8238) + cc(8288) + "-" + cc(8292) + cc(65279) + "]");
const TLDS = "com|net|org|edu|gov|io|co|ai|app|dev|xyz|info|biz|tv|ly|cc|uk|ca|de|fr|ru|cn|jp|br|au|eu|nl|ch|us|me|site|online|tech|store|shop|blog|cloud|page|link|click|top|club|live|life|world|today|news|agency|works|jobs|careers|work|pro|name|mobi|asia|one|ink|art|fun|vip|win|bid|fyi|wiki";
const DOMAIN_RE = new RegExp("[a-z0-9][.](" + TLDS + ")(?![a-z0-9])");
const IP_RE = /[0-9]{1,3}([.][0-9]{1,3}){3}/;

// t: the trimmed text. -> null when fine (an empty note is "no note"), else the sentence to show under the box
export function aiNoteProblem(t) {
  const s = String(t == null ? "" : t);
  if (s === "") return null;
  if (BAD_CHARS.test(s)) return "Keep it to one paragraph of plain text (no line breaks).";
  if (Array.from(s).length > MAX_AI_NOTE) return "Keep it to " + MAX_AI_NOTE + " characters or fewer.";
  const x = s.normalize("NFKC").toLowerCase().split("[.]").join(".").split("(.)").join(".").split("{.}").join(".").split(cc(12290)).join(".");
  if (x.includes("://") || /www[.]/.test(x) || IP_RE.test(x) || DOMAIN_RE.test(x)) return "No web addresses here: the destination links are for those.";
  return null;
}

// What a candidate reads. p: a search row or a posting. -> [{ key, label, text }] in the designed order, only for a toggle that is on and has words
export function aiNotes(p) {
  const out = [];
  if (p && p.ai_filtering === true && typeof p.ai_filtering_note === "string" && p.ai_filtering_note !== "") out.push({ key: "filtering", label: "AI filtering, in the employer's words", text: p.ai_filtering_note });
  if (p && p.ai_interview_other === true && typeof p.ai_interview_note === "string" && p.ai_interview_note !== "") out.push({ key: "interview", label: "AI interviewing/other, in the employer's words", text: p.ai_interview_note });
  return out;
}
