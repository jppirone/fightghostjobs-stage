// phone-model.js - the phone entry without a page (prompt IB, November 3, 2026). Pure functions: no browser API, no network, nothing stored, nothing logged. Unit tested (tests/phone-entry.unit.test.js).
// It turns the address fragment of the Shortcut (search.html#x=<the text the phone read out of a screenshot>) into what the search page should show, using the copy of the extension's reader (js/mobile/, tests/copy-reader.js).
//   readFragment(hash) -> { x: false }                                  the fragment holds no x: the page is the ordinary search page
//                       | { x: true, refused: true }                    the fragment is refused as a whole (sentence 10)
//                       | { x: true, refused: false, state, cut, boxes, cards }
//     state "nothing": no opening could be read (sentence 9); state "read": the boxes hold what was found; cut: the text was cut at the cap (sentence 11)
//     boxes: { fill: { company, query, req }, notes: { company, query, req } }   query is the box for a KIO ID or the title; a note is the NUMBER of a sentence of js/phone-text.js (never text from the screenshot)
//     cards: the complete cards in the order they were read, only when there is more than one (the first one fills the boxes; the others are offered)
// THE FRAGMENT IS UNTRUSTED INPUT FROM ANY SOURCE. Rules (all pinned by the unit test):
//   - the key x holds the text; x together with any of c, p, r, t, k, o, h refuses the whole fragment; x twice refuses it; other unknown keys are ignored (as on the classic address)
//   - the key s (prompt JD) holds where the person found the job: a separate piece (parsePhoneFragment().source, readFragment().source), limited by js/source-clean.js, never inside the text, never a reason to refuse the text
//   - decodeURIComponent, so a plus sign stays a plus sign; a bad percent escape, or any control character other than a line break after decoding, refuses the whole fragment
//   - a fragment of more than MAX_FRAGMENT characters or more than MAX_PARTS parts is refused (the page never decodes an unbounded string)
//   - the text is cut at TEXT_CAP characters at the last whole line (before it is read); the page says so
import { readText } from "./mobile/mobile-reader/reader.js?v=29302fc3";
import { limitSource } from "./source-clean.js?v=228d1fb3";

export const TEXT_CAP = 600, MAX_FRAGMENT = 50000, MAX_PARTS = 12;
const CLASSIC_KEYS = new Set(["c", "p", "r", "t", "k", "o", "h"]);
const isBreak = (ch) => ch === "\n" || ch === "\r" || ch === " " || ch === " ";
// a control character is any code below 32, 127 to 159, other than a line break (line feed, carriage return and the two Unicode line separators)
const hasBadControl = (s) => { for (const ch of s) { if (isBreak(ch)) continue; const c = ch.codePointAt(0); if (c < 32 || (c >= 127 && c <= 159)) return true; } return false; };

// -> { x: boolean, refused: boolean, text: string, source: string }
// prompt JD (November 7, 2026): the key s holds where the person found the job (the Shortcut asks, optionally). It is a SEPARATE piece: never part of the text, never read by the reader, and never a reason to refuse the text (s is not a classic key).
// source is the decoded value after limitSource (js/source-clean.js): "" when there is no s, an empty s, two or more s pieces, or a bad percent sequence in it (the search itself is kept in every one of those cases). A refused address has no source.
export function parsePhoneFragment(hash) {
  const raw = String(hash == null ? "" : hash).replace(/^#/, "");
  const pieces = raw.split("&");
  let xCount = 0, value = "", old = false, sCount = 0, sValue = "";
  for (const piece of pieces.slice(0, MAX_PARTS)) {
    const eq = piece.indexOf("=");
    if (eq < 1) continue;
    const key = piece.slice(0, eq);
    if (key === "x") { xCount++; if (xCount === 1) value = piece.slice(eq + 1); }
    else if (key === "s") { sCount++; if (sCount === 1) sValue = piece.slice(eq + 1); }
    else if (CLASSIC_KEYS.has(key)) old = true;
  }
  if (xCount === 0) return { x: false, refused: false, text: "", source: "" };
  if (old || xCount > 1 || raw.length > MAX_FRAGMENT || pieces.length > MAX_PARTS) return { x: true, refused: true, text: "", source: "" };
  let text;
  try { text = decodeURIComponent(value); } catch { return { x: true, refused: true, text: "", source: "" }; }
  if (hasBadControl(text)) return { x: true, refused: true, text: "", source: "" };
  let source = "";
  if (sCount === 1) { try { source = limitSource(decodeURIComponent(sValue)); } catch { source = ""; } }
  return { x: true, refused: false, text, source };
}

// the cap: at most TEXT_CAP characters, ending at a whole line (the cut is done by the page). -> { text, cut }
export function limitText(text) {
  const t = String(text);
  if (t.length <= TEXT_CAP) return { text: t, cut: false };
  const head = t.slice(0, TEXT_CAP);
  if (isBreak(t[TEXT_CAP])) return { text: head, cut: true };
  let at = -1;
  for (let i = head.length - 1; i >= 0; i--) if (isBreak(head[i])) { at = i; break; }
  if (at > 0) return { text: head.slice(0, at).replace(/\r$/, ""), cut: true };   // a CR LF break is one break
  // no line break in the first part at all: the only cut possible is in the middle of the line (never between the two halves of one character)
  const last = head.charCodeAt(head.length - 1);
  return { text: last >= 0xd800 && last <= 0xdbff ? head.slice(0, -1) : head, cut: true };
}

// one opening (a card, or the single reading) -> the boxes. p: { company, title, req, reqUnlabelled, cutCompany, cutTitle, titleShortened, titleBroken }; kio: the KIO ID as shown, or null
// The notes are sentence numbers of js/phone-text.js: 2 cut off, 3 req number found in the title, 4 broken word in the title, 5 nothing found for a box.
export function boxesOf(p, kio) {
  const company = p.company || "", title = p.title || "", req = p.req || "";
  if (kio) {
    // a KIO ID is the exact key: it takes the KIO or title box, the company stays optional, and no req number goes with it (the search page refuses an ID together with a req number). The title is not held and not sent.
    return { fill: { company, query: kio, req: "" }, notes: { company: company && p.cutCompany ? 2 : null, query: null, req: null }, orderAssumed: false };   // prompt JE: with a KIO ID the order of the title and the company does not matter, so no note
  }
  const notes = { company: null, query: null, req: null };
  if (company) { if (p.cutCompany) notes.company = 2; } else if (title || req) notes.company = 5;
  if (title) { if (p.cutTitle || p.titleShortened) notes.query = 2; } else if (p.titleBroken) notes.query = 4; else if (company) notes.query = 5;
  if (req && p.reqUnlabelled) notes.req = 3;
  // prompt JE (November 8, 2026): orderAssumed is the reader's own flag (reader-v3): true only when a two line crop was read and position alone decided which line is the title and which the company; the page shows a note for it, in memory only
  return { fill: { company, query: title, req }, notes, orderAssumed: p.orderAssumed === true };
}

// a card of the reader -> the shape boxesOf reads. A requisition number of a card is always the one found in its title without a label.
export const ofCard = (c) => ({ company: c.company, title: c.title, req: c.req || "", reqUnlabelled: !!c.req, cutCompany: !!(c.cut && c.cut.company), cutTitle: !!(c.cut && c.cut.title), titleShortened: c.titleShortened === true, titleBroken: false, orderAssumed: c.orderAssumed === true });
export const cardBoxes = (card) => boxesOf(card, null);

// the text (already cut) -> what the page shows. Reads the text with the copy of the extension's reader.
export function readingOf(text) {
  if (String(text).trim() === "") return { state: "nothing", boxes: null, cards: [] };
  const r = readText(text);
  const complete = Array.isArray(r.cards) ? r.cards : [];
  let primary, cards = [];
  if (r.company || r.title) {
    primary = { company: r.company, title: r.title, req: r.req || "", reqUnlabelled: r.reqUnlabelled === true, cutCompany: !!(r.cut && r.cut.company), cutTitle: !!(r.cut && r.cut.title), titleShortened: r.titleShortened === true, titleBroken: r.titleBroken === true, orderAssumed: r.orderAssumed === true };
  } else if (complete.length) {
    cards = complete.map(ofCard);
    primary = cards[0];
    // a labelled req number somewhere in a text with several openings does not say which opening it belongs to: it is used only when there is one opening
    if (cards.length === 1 && r.req) primary = { ...primary, req: r.req, reqUnlabelled: false };
  } else {
    primary = { company: null, title: null, req: r.req || "", reqUnlabelled: r.reqUnlabelled === true, cutCompany: false, cutTitle: false, titleShortened: false, titleBroken: r.titleBroken === true };
  }
  const kio = typeof r.kio === "string" && r.kio !== "" ? r.kio : null;
  if (!primary.company && !primary.title && !primary.req && !kio) return { state: "nothing", boxes: null, cards: [] };
  return { state: "read", boxes: boxesOf(primary, kio), cards: cards.length > 1 ? cards : [] };
}

export function readFragment(hash) {
  const p = parsePhoneFragment(hash);
  if (!p.x) return { x: false };
  if (p.refused) return { x: true, refused: true };
  const lim = limitText(p.text);
  return { x: true, refused: false, cut: lim.cut, source: p.source, ...readingOf(lim.text) };
}
