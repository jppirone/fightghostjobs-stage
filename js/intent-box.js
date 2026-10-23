// intent-box.js - the "Kind of opening" choice on the register page and the opening editor (prompt ST1, October 14, 2026): one select (Not stated, or one of the four values the database offers) and a date box
// that is in the page ONLY for the two values that take a date. Markup lives in register.html and edit.html (#intentRow, #intentSelect, #intentMeaning, #intentDateRow, #intentDateLabel, #intentDate and its error
// line). The rule and the words are js/intent-statement.js; the labels come from the database's wording table (the page asks once), so staff can reword them with no deploy. Everything shown is text.
import { $, h } from "./dom.js?v=5c78a8cd";
import { INTENT_WORDS, optionsFor, takesDate, dateLabelFor } from "./intent-statement.js?v=d37f2b4b";

// onChange(): called after the choice or the date changed (the edit page refreshes its unsaved bar)    -> { get, set, setOptions, reset, hide, available, setLocked, focus }
export function mountIntentBox({ onChange } = {}) {
  const row = $("#intentRow"), sel = $("#intentSelect"), meaning = $("#intentMeaning"), dateRow = $("#intentDateRow"), dateLabel = $("#intentDateLabel"), date = $("#intentDate"), err = $('[data-error-for="intentDate"]');
  let options = optionsFor(null, ""), usable = true;
  const changed = () => { if (typeof onChange === "function") onChange(); };
  const clearError = () => { err.hidden = true; err.textContent = ""; date.setAttribute("aria-invalid", "false"); };
  const fill = () => { sel.replaceChildren(h("option", { value: "" }, INTENT_WORDS.NOT_STATED), ...options.map((o) => h("option", { value: o.code }, o.label))); };
  const draw = () => {
    const code = sel.value, o = options.find((x) => x.code === code);
    meaning.hidden = !o; meaning.textContent = o ? o.meaning : "";
    const needs = takesDate(code);
    dateRow.hidden = !needs;
    if (needs) dateLabel.textContent = dateLabelFor(code);
    else { date.value = ""; clearError(); }
  };
  sel.addEventListener("change", () => { draw(); changed(); });
  date.addEventListener("input", () => { clearError(); changed(); });
  fill(); draw();
  return {
    available: () => usable,
    // the value the form sends: code "" = not stated; date is the box's text (only while the value takes one)
    get: () => ({ code: usable ? sel.value : "", date: usable && takesDate(sel.value) ? date.value : "" }),
    // list: the database's answer (or null when it could not be read: the spec's wording is offered); current: the stored code, which stays selectable even if it is no longer offered
    setOptions(list, current) { options = optionsFor(list, current); const keep = sel.value; fill(); sel.value = options.some((o) => o.code === keep) ? keep : ""; draw(); },
    set(code, day) {
      const c = typeof code === "string" ? code : "";
      if (c !== "" && !options.some((o) => o.code === c)) { options = optionsFor(null, c); fill(); }
      sel.value = c; draw();
      date.value = takesDate(c) && typeof day === "string" ? day.slice(0, 10) : "";
      clearError();
    },
    reset() { sel.value = ""; date.value = ""; draw(); clearError(); },
    // the database cannot take the statement yet (an answer without the fields, or the list could not be read at all): the row is out of the page and nothing is sent for it
    hide() { usable = false; row.hidden = true; },
    show() { usable = true; row.hidden = false; },
    setLocked(on) { sel.disabled = on; date.disabled = on; },
    focus() { sel.focus(); },
  };
}
