// place-choice.js - the choice "A place outside the US or not in the list" under the location picker (prompt BH, October 11, 2026). It shows one plain text box in place of the US list; the typed place and a place from
// the list are never both, so while the choice is on the picker's places are neither shown nor sent (and the page sends them cleared on an edit). Markup lives in register.html and edit.html
// (#locCatalog, #locOutside, #locTyped, #loctext and its error line). The rule and the words are js/place-text.js; everything shown is text.
import { $ } from "./dom.js?v=ff147636";

// onChange(): called after the choice or the text changed (the edit page refreshes its unsaved bar)    -> { outside, text, set, reset, setLocked, focus }
export function mountPlaceChoice({ onChange } = {}) {
  const choice = $("#locOutside"), typed = $("#locTyped"), input = $("#loctext"), catalog = $("#locCatalog"), err = $('[data-error-for="loctext"]');
  const draw = () => { typed.hidden = !choice.checked; catalog.hidden = choice.checked; if (!choice.checked) { err.hidden = true; err.textContent = ""; input.setAttribute("aria-invalid", "false"); } };
  const changed = () => { if (typeof onChange === "function") onChange(); };
  choice.addEventListener("change", () => { draw(); if (choice.checked) input.focus(); changed(); });
  input.addEventListener("input", () => { err.hidden = true; err.textContent = ""; input.setAttribute("aria-invalid", "false"); changed(); });
  draw();
  return {
    outside: () => choice.checked,
    text: () => input.value,
    // a stored place: the text (the choice is on and the box filled) or null (the list is shown)
    set(text) { const t = typeof text === "string" ? text : ""; choice.checked = t !== ""; input.value = t; draw(); },
    reset() { choice.checked = false; input.value = ""; draw(); },
    setLocked(on) { choice.disabled = on; input.disabled = on; },
    focus() { input.focus(); },
  };
}
