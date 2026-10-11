// limit-hint.js - a text box that stops typing at a limit says so (prompt BK, October 11, 2026): "Up to 200 characters.", a small live count ("37 of 200") and a sentence when typing or a paste meets the limit.
// It is the same behavior the typed place box has had since prompt BJ (js/place-choice.js keeps its own copy, tied to that box's static markup), built for any single-line box or text area of the register page and
// the opening editor. The limit is the box's own maxlength attribute: the page cannot say one number and enforce another. Nothing here changes a limit. Everything shown is text (dom.js), never HTML.
import { h } from "./dom.js?v=ff147636";

const fmt = (n) => Number(n).toLocaleString("en-US");

// the words, one place (tests/register-bk.unit.test.js pins them)
export function limitWords(max) {
  return {
    HINT: "Up to " + fmt(max) + " characters.",
    COUNT: (n) => fmt(n) + " of " + fmt(max),
    FULL: "That is all it can hold: " + fmt(max) + " characters.",
    CUT: "What you pasted was longer than " + fmt(max) + " characters, so it was cut at " + fmt(max) + ".",
  };
}

// input: the box (its maxlength attribute is the limit); hint: false when the page already says "Up to N characters." in its own words
// -> { refresh, max }  refresh(): redraw the count from the box's value (call it after a script sets the value)
export function mountLimitHint({ input, hint = true } = {}) {
  const max = input ? Number(input.getAttribute("maxlength")) : NaN;
  if (!input || !input.parentElement || !Number.isInteger(max) || max < 1) return { refresh() {}, max: 0 };
  const words = limitWords(max);
  const id = input.id || "";
  const hintEl = hint ? h("div", { class: "field-hint", "data-limit-for": id, "data-limit": "hint" }, words.HINT) : null;
  const countEl = h("div", { class: "field-hint", "aria-hidden": "true", "data-limit-for": id, "data-limit": "count" }, words.COUNT(0));
  const noteEl = h("div", { class: "field-hint", role: "status", hidden: true, "data-limit-for": id, "data-limit": "note" });
  input.parentElement.append(...[hintEl, countEl, noteEl].filter(Boolean));
  const say = (text) => { noteEl.textContent = text || ""; noteEl.hidden = !text; };
  const refresh = () => { countEl.textContent = words.COUNT(input.value.length); if (input.value.length < max) say(""); };
  // the browser stops the typing or the paste at the limit without a word: ask beforehand whether what is coming fits
  input.addEventListener("beforeinput", (ev) => {
    if (!ev.inputType || ev.inputType.indexOf("insert") !== 0) return;
    const incoming = typeof ev.data === "string" ? ev.data : (ev.dataTransfer && typeof ev.dataTransfer.getData === "function" ? ev.dataTransfer.getData("text/plain") : "");
    const selected = Math.abs((input.selectionEnd || 0) - (input.selectionStart || 0));
    const room = max - (input.value.length - selected);
    if (incoming.length > room) say(incoming.length > 1 ? words.CUT : words.FULL);
  });
  input.addEventListener("input", refresh);
  refresh();
  return { refresh, max };
}
