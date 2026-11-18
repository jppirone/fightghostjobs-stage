// phone-entry.js - the phone entry on the search page (prompt IB, November 3, 2026). The Shortcut on a phone reads the text out of a screenshot and opens search.html#x=<the text>. The search page loads this file ONLY when its
// address holds the key x (a dynamic import in js/pages/search.js, on load and again on hashchange); with no x the page is the ordinary search page and this file is never fetched.
// What it does: reads the text with the copy of the extension's reader (js/mobile/, through js/phone-model.js), fills the three boxes of the search page, shows the fixed sentences of js/phone-text.js (chosen here, never made from the
// screenshot text), lets the person pick another opening when the screen showed more than one, and takes the fragment out of the address bar. The person presses the normal Search button. Nothing starts a search by itself.
// THE SCREENSHOT TEXT IS NEVER SENT, STORED, LOGGED OR SHOWN: it goes into the boxes with .value only, it is not in any request, and this file uses no localStorage, sessionStorage, IndexedDB, cookie, window.name or console.
// On a computer (a mouse, a window of 900 pixels or more) the page shows sentence 12 and does not fill anything.
import { h, clear } from "./dom.js?v=5c78a8cd";
import { SENTENCES, ORDER_NOTE, MORE_BEFORE, MORE_BUTTON, MORE_AFTER, EXTENSION_LINK_TEXT, choiceText } from "./phone-text.js?v=104f014c";
import { SOURCE_PHONE_SENTENCE } from "./source-text.js?v=0a1a7868";
import { readFragment, cardBoxes } from "./phone-model.js?v=5660dc3f";
import { EXTENSION_PAGE_URL } from "./config.js?v=62c9e3b1";

export const COMPUTER_QUERY = "(hover: hover) and (pointer: fine) and (min-width: 900px)";
export const isComputer = (win) => { try { return !!(win.matchMedia && win.matchMedia(COMPUTER_QUERY).matches); } catch { return false; } };

// the one link that may follow sentence 12: only when EXTENSION_PAGE_URL is a non empty address on this site (a path of this site, or an address with this site's own origin)
export function extensionLink(win, setting = EXTENSION_PAGE_URL) {
  if (typeof setting !== "string" || setting.trim() === "") return null;
  try { const u = new URL(setting.trim(), win.location.href); return u.origin === win.location.origin && (u.protocol === "https:" || u.protocol === "http:") ? u.href : null; } catch { return null; }
}

let wired = false, current = null;   // current: what the person is looking at, in memory only

export function runPhoneEntry({ win = window, doc = document, companyEl, queryEl, reqEl, sourceEl = null, onOrigin }) {
  const panel = doc.getElementById("phonePanel"), body = doc.getElementById("phoneBody"), line = doc.getElementById("phoneLine"), more = doc.getElementById("phoneMore"), list = doc.getElementById("phoneList"), privacy = doc.getElementById("phonePrivacy"), sourceNote = doc.getElementById("phoneSource");
  if (!panel || !body || !line || !more || !list || !privacy) return false;
  const parsed = readFragment(win.location.hash);
  if (!parsed.x) return false;
  const boxes = { company: companyEl, query: queryEl, req: reqEl };
  const cell = (box) => (box === reqEl ? box.parentElement.parentElement : box.parentElement);

  const takeAddress = () => { try { win.history.replaceState(win.history.state, "", win.location.pathname + win.location.search); } catch { /* the address bar keeps the fragment; the boxes are still filled */ } };
  // a note under a box: one of the fixed sentences, tied to the box for a screen reader
  const noteId = (name) => "phoneNote" + name[0].toUpperCase() + name.slice(1);
  function clearNote(name) {
    const el = doc.getElementById(noteId(name)); if (el) el.remove();
    const d = (boxes[name].getAttribute("aria-describedby") || "").split(/\s+/).filter((x) => x && x !== noteId(name)).join(" ");
    if (d) boxes[name].setAttribute("aria-describedby", d); else boxes[name].removeAttribute("aria-describedby");
  }
  const clearNotes = () => { for (const n of Object.keys(boxes)) clearNote(n); };
  function setNote(name, number) {
    clearNote(name);
    if (!number) return;
    cell(boxes[name]).append(h("div", { id: noteId(name), class: "phone-note", role: "note" }, SENTENCES[number]));
    const d = (boxes[name].getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean); d.push(noteId(name));
    boxes[name].setAttribute("aria-describedby", d.join(" "));
  }
  // prompt JE (November 8, 2026): the "check this" note inside the search box (the status region #orderNote, above the optional line and Search). It is set only when the reader flagged the reading (orderAssumed true), as text, in memory only,
  // and it is emptied when the person edits the company box or the title box, when a search has run, when another opening is picked (that opening brings its own flag) and with every new reading. It blocks nothing.
  function clearOrder() { const e = doc.getElementById("orderNote"); if (e) e.textContent = ""; }
  function setOrder(on) { clearOrder(); const e = doc.getElementById("orderNote"); if (on === true && e) e.textContent = ORDER_NOTE; }
  const fill = (f) => { companyEl.value = f.company; queryEl.value = f.query; reqEl.value = f.req; };
  const setNotes = (n) => { for (const name of Object.keys(boxes)) setNote(name, n[name]); };

  function resetPanel() { clearOrder(); clear(line); clear(more); more.hidden = true; clear(list); list.hidden = true; body.hidden = true; privacy.dataset.on = "0"; if (sourceNote) sourceNote.dataset.on = "0"; }   // prompt JB: the two sentences stay hidden on the page (they are in the info box while data-on is 1)
  function say(text) { clear(line); line.append(text); }
  function showBody() { body.hidden = false; }

  // ---- the editing of a box ends its note (wired once for the page)
  if (!wired) {
    wired = true;
    for (const name of Object.keys(boxes)) boxes[name].addEventListener("input", () => clearNote(name));
    for (const el of [companyEl, queryEl]) el.addEventListener("input", clearOrder);   // prompt JE: editing the company box or the title box ends the "check this" note
    // once a search has run the page shows its recap and empties the boxes: the sentences about the screenshot are done (the privacy sentence stays)
    const recap = doc.getElementById("recap");
    if (recap && win.MutationObserver) new win.MutationObserver(() => { if (!recap.hidden) { clearNotes(); resetPanel(); privacy.dataset.on = current ? "1" : "0"; if (sourceNote) sourceNote.dataset.on = current ? "1" : "0"; } }).observe(recap, { attributes: true, attributeFilter: ["hidden"] });
  }

  // ---- the computer: sentence 12 only; nothing is filled, the fragment goes
  clearNotes(); resetPanel(); current = null;
  if (isComputer(win)) {
    takeAddress();
    say(SENTENCES[12]);
    const href = extensionLink(win);
    if (href) line.append(" ", h("a", { href, class: "phone-link" }, EXTENSION_LINK_TEXT));
    showBody();
    return true;
  }

  // ---- the address is refused as a whole
  if (parsed.refused) {
    takeAddress(); fill({ company: "", query: "", req: "" });
    say(SENTENCES[10]); showBody();
    return true;
  }

  // ---- from here the module has run (states 1 to 5): the next search of this attempt is the phone entry's
  takeAddress();
  if (typeof onOrigin === "function") onOrigin({ origin: "mobile", host: null });
  current = { index: 0 };
  privacy.textContent = SENTENCES[13]; privacy.dataset.on = "1";
  // prompt JD: the optional source (key s of the address) goes into its own field with .value only, so the person sees exactly what will be sent; a new address with no s empties it. Not part of the text, not read by the reader.
  if (sourceEl) { sourceEl.value = typeof parsed.source === "string" ? parsed.source : ""; }
  if (sourceNote) { sourceNote.textContent = SOURCE_PHONE_SENTENCE; sourceNote.dataset.on = "1"; }
  if (parsed.state === "nothing") {
    fill({ company: "", query: "", req: "" });
    say(SENTENCES[9]);
    if (parsed.cut) line.append(" ", SENTENCES[11]);
    showBody();
    return true;
  }
  fill(parsed.boxes.fill); setNotes(parsed.boxes.notes); setOrder(parsed.boxes.orderAssumed === true);
  say(SENTENCES[1]);
  if (parsed.cut) line.append(" ", SENTENCES[11]);

  // ---- more than one complete card on the screen: the first fills the boxes, the others are offered
  if (parsed.cards.length > 1) {
    const cards = parsed.cards;
    let open = false;
    const pickBtn = h("button", { type: "button", class: "btn btn-outline phone-pick", "aria-expanded": "false", "aria-controls": "phoneList" }, MORE_BUTTON);
    more.append(MORE_BEFORE, pickBtn, MORE_AFTER); more.hidden = false;
    const drawList = () => {
      clear(list);
      if (!open) { list.hidden = true; pickBtn.setAttribute("aria-expanded", "false"); return; }
      list.append(h("p", { class: "phone-list-head" }, SENTENCES[7]));
      cards.forEach((c, i) => {
        if (i === current.index) return;
        list.append(h("button", { type: "button", class: "btn btn-outline phone-choice", onclick: () => {
          current.index = i; open = false;
          const b = cardBoxes(c);   // the notes of the first opening are cleared; the picked opening brings its own
          fill(b.fill); setNotes(b.notes); setOrder(b.orderAssumed === true);
          clear(line); line.append(SENTENCES[8]); if (parsed.cut) line.append(" ", SENTENCES[11]);
          drawList(); pickBtn.focus();
        } }, choiceText(c.title, c.company)));
      });
      list.hidden = false; pickBtn.setAttribute("aria-expanded", "true");
    };
    pickBtn.addEventListener("click", () => { open = !open; drawList(); });
  }
  showBody();
  return true;
}
