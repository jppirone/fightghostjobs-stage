// location-picker.js - the location picker on the register form: type a place, choose it from the list. Locations are CHOSEN from the catalog (never typed as free text) and are sent as catalog ids.
// The rules it warns about (at most 3 cities/metro areas, 10 states, 13 in all; states only on a remote role; two or more need the one-opening statement) are the same ones the database enforces (js/location-rules.js).
// Markup lives in register.html (#locq, #locList, #locChips, #locStatus, #attestRow, #attest). Everything shown is text (dom.js), never HTML.
import { $, h, clear } from "./dom.js";
import { loadCatalog } from "./location-catalog.js";
import { search, normalize } from "./location-search.js";
import { canAdd, problems } from "./location-rules.js";

const TAG = { state: "State", nationwide: "Nationwide" };

// isRemote(): whether "Remote role" is ticked right now.   -> { get, reset, refresh, setLocked, focusFor }
export function mountLocationPicker({ isRemote }) {
  const input = $("#locq"), list = $("#locList"), chipBox = $("#locChips"), status = $("#locStatus");
  const attestRow = $("#attestRow"), attest = $("#attest"), err = $('[data-error-for="locpicker"]'), attestErr = $('[data-error-for="attest"]');
  let catalog = null, loading = null, chosen = [], shown = [], active = -1, locked = false;

  const warn = (text) => { err.hidden = !text; err.textContent = text || ""; input.setAttribute("aria-invalid", text ? "true" : "false"); };

  function ensure() {
    if (catalog) return Promise.resolve(catalog);
    if (!loading) {
      status.textContent = "Loading the location list…";
      loading = loadCatalog().then((c) => { catalog = c; status.textContent = ""; return c; })
        .catch(() => { loading = null; status.textContent = ""; warn("The location list could not be loaded. Reload the page and try again."); return null; });
    }
    return loading;
  }

  function close() { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; }
  function setActive(i) {
    active = i;
    shown.forEach((_, k) => list.children[k].setAttribute("aria-selected", k === i ? "true" : "false"));
    if (i >= 0) { input.setAttribute("aria-activedescendant", "locopt-" + i); list.children[i].scrollIntoView({ block: "nearest" }); } else input.removeAttribute("aria-activedescendant");
  }

  function renderList() {
    clear(list); shown = []; active = -1; status.textContent = "";
    if (!catalog || normalize(input.value) === "") { close(); return; }
    const remote = isRemote();
    const selectedIds = chosen.map((c) => c.id);
    shown = search(catalog.entries, input.value, { selectedIds, remote });
    // states and "nationwide" are for remote roles only: when one would have matched, say so instead of leaving it out silently
    const hiddenState = !remote && search(catalog.entries, input.value, { selectedIds, remote: true, limit: 1, allow: (e) => e.kind === "state" || e.kind === "nationwide" }).length > 0;
    if (hiddenState) status.textContent = "States and \"United States (nationwide)\" are for remote roles: tick Remote role to choose one.";
    if (!shown.length) {
      close();
      if (!hiddenState) status.textContent = "No match. The list has cities and towns of 5,000 people or more, and metro and micro areas: try a larger nearby city or its metro area.";
      return;
    }
    shown.forEach((e, i) => list.append(h("li", { id: "locopt-" + i, role: "option", "aria-selected": "false", onmousedown: (ev) => { ev.preventDefault(); choose(e); } }, h("span", { text: e.display }), TAG[e.kind] ? h("span", { class: "loc-tag", text: TAG[e.kind] }) : null)));
    list.hidden = false; input.setAttribute("aria-expanded", "true");
    setActive(0);
  }

  function choose(entry) {
    if (locked) return;
    const r = canAdd(chosen, entry, isRemote());
    if (!r.ok) { warn(r.reason); return; }
    chosen.push(entry); input.value = ""; close(); status.textContent = ""; refresh(); input.focus();
  }
  function remove(id) { if (locked) return; chosen = chosen.filter((c) => c.id !== id); refresh(); input.focus(); }

  // Re-draw the chosen locations and the statement box, and warn (softly) about anything the backend would refuse. Called after every change, and by the page when "Remote role" changes.
  function refresh() {
    clear(chipBox);
    for (const c of chosen) chipBox.append(h("span", { class: "loc-chip" }, h("span", { text: c.display }), h("button", { type: "button", class: "loc-remove", "aria-label": "Remove " + c.display, disabled: locked, onclick: () => remove(c.id) }, "×")));
    attestRow.hidden = chosen.length < 2;
    if (chosen.length < 2) attest.checked = false;
    attestErr.hidden = true; attestErr.textContent = "";
    warn(problems(chosen, isRemote(), true).locpicker || "");        // attested passed as true: the missing statement is only reported when the form is submitted
    if (catalog && input.value) renderList();
  }

  input.addEventListener("focus", () => { ensure(); });
  input.addEventListener("input", () => { if (locked) return; ensure().then(() => { if (catalog) renderList(); }); });
  input.addEventListener("blur", close);
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      if (!shown.length) return;
      ev.preventDefault();
      if (list.hidden) { list.hidden = false; input.setAttribute("aria-expanded", "true"); }
      setActive(ev.key === "ArrowDown" ? (active + 1) % shown.length : (active <= 0 ? shown.length - 1 : active - 1));
    } else if (ev.key === "Enter") {
      ev.preventDefault();                                                    // never submit the form from this field
      if (!list.hidden && shown.length) choose(shown[active >= 0 ? active : 0]);
    } else if (ev.key === "Escape") {
      if (!list.hidden) { ev.preventDefault(); close(); }
    } else if (ev.key === "Backspace" && input.value === "" && chosen.length && !locked) {
      chosen.pop(); refresh();
    }
  });
  attest.addEventListener("change", () => { if (attest.checked) { attestErr.hidden = true; attestErr.textContent = ""; } });

  refresh();
  return {
    get: () => ({ entries: chosen.slice(), attested: chosen.length >= 2 && attest.checked }),
    refresh,
    reset() { chosen = []; attest.checked = false; input.value = ""; close(); status.textContent = ""; refresh(); },
    setLocked(on) { locked = on; refresh(); },
    focusFor(id) { (id === "attest" ? attest : input).focus(); },
  };
}
