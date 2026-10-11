// place-choice.js - the choice "A place outside the US or not in the list" under the location picker (prompt BH, October 11, 2026). It shows one plain text box in place of the US list; the typed place and a place from
// the list are never both, so while the choice is on the picker's places are neither shown nor sent (and the page sends them cleared on an edit). Markup lives in register.html and edit.html
// (#locCatalog, #locOutside, #locTyped, #loctext and its error line). The rule and the words are js/place-text.js; everything shown is text.
import { $ } from "./dom.js?v=ff147636";
import { PLACE_WORDS, MAX_PLACE_TEXT } from "./place-text.js?v=cb5d7506";

// onChange(): called after the choice or the text changed (the edit page refreshes its unsaved bar)    -> { outside, text, set, reset, setLocked, focus }
export function mountPlaceChoice({ onChange } = {}) {
  const choice = $("#locOutside"), typed = $("#locTyped"), input = $("#loctext"), catalog = $("#locCatalog"), err = $('[data-error-for="loctext"]');
  const draw = () => { typed.hidden = !choice.checked; catalog.hidden = choice.checked; if (!choice.checked) { err.hidden = true; err.textContent = ""; input.setAttribute("aria-invalid", "false"); } };
  const changed = () => { if (typeof onChange === "function") onChange(); };
  // prompt BJ: a small live count ("37 of 100") and a sentence when typing or a paste meets the limit (the box itself stops at the limit, which used to be silent)
  const count = $("#loctextCount"), limit = $("#loctextLimit");
  const drawCount = () => { if (count) count.textContent = PLACE_WORDS.COUNT(input.value.length); };
  const say = (text) => { if (limit) { limit.textContent = text; limit.hidden = !text; } };
  input.addEventListener("beforeinput", (ev) => {
    if (!ev.inputType || ev.inputType.indexOf("insert") !== 0) return;
    const incoming = typeof ev.data === "string" ? ev.data : (ev.dataTransfer && typeof ev.dataTransfer.getData === "function" ? ev.dataTransfer.getData("text/plain") : "");
    const selected = Math.abs((input.selectionEnd || 0) - (input.selectionStart || 0));
    const room = MAX_PLACE_TEXT - (input.value.length - selected);
    if (incoming.length > room) say(incoming.length > 1 ? PLACE_WORDS.CUT : PLACE_WORDS.FULL);
  });
  choice.addEventListener("change", () => { draw(); if (choice.checked) input.focus(); changed(); });
  input.addEventListener("input", () => { err.hidden = true; err.textContent = ""; input.setAttribute("aria-invalid", "false"); drawCount(); if (input.value.length < MAX_PLACE_TEXT) say(""); changed(); });
  drawCount();
  draw();
  return {
    outside: () => choice.checked,
    text: () => input.value,
    // a stored place: the text (the choice is on and the box filled) or null (the list is shown)
    set(text) { const t = typeof text === "string" ? text : ""; choice.checked = t !== ""; input.value = t; say(""); drawCount(); draw(); },
    reset() { choice.checked = false; input.value = ""; say(""); drawCount(); draw(); },
    setLocked(on) { choice.disabled = on; input.disabled = on; },
    focus() { input.focus(); },
  };
}
