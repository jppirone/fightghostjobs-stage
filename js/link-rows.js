// link-rows.js - the two-box rows the register form and the edit page share: destination links (Address | Label, up to 10) and, since pass C, recruiter firms (Name | Address, up to 3).
// The rows are only inputs: what they hold is checked by checkLinks / checkFirms (edit-form.js) and sent by the page. One row is shown by default; the add button adds one, up to the cap.
import { $, h, clear } from "./dom.js";
import { MAX_LINKS, MAX_URL, MAX_LABEL, MAX_FIRMS, MAX_FIRM_NAME } from "./edit-form.js";

const MODES = {
  links: { max: MAX_LINKS, keys: ["url", "label"], a: (i) => ({ type: "text", inputmode: "url", maxlength: MAX_URL, autocomplete: "off", spellcheck: "false", "aria-label": "Destination address " + (i + 1), placeholder: "Address, starting with https://" }), b: (i) => ({ type: "text", maxlength: MAX_LABEL, autocomplete: "off", "aria-label": "Label for link " + (i + 1) + " (optional)", placeholder: "Label (optional, for you only)" }), grid: "minmax(0,3fr) minmax(0,2fr)" },
  firms: { max: MAX_FIRMS, keys: ["name", "url"], a: (i) => ({ type: "text", maxlength: MAX_FIRM_NAME, autocomplete: "organization", "aria-label": "Recruiter firm " + (i + 1), placeholder: "Firm name" }), b: (i) => ({ type: "text", inputmode: "url", maxlength: MAX_URL, autocomplete: "off", spellcheck: "false", "aria-label": "Address of firm " + (i + 1) + " (optional)", placeholder: "Address (optional), starting with https://" }), grid: "minmax(0,2fr) minmax(0,3fr)" },
};

// host: the element the rows go in; addBtn: the add button; mode: "links" (default) | "firms". -> { rows, add, reset, values, showErrors, focus, setLocked }
export function mountLinkRows({ host, addBtn, mode = "links" }) {
  const M = MODES[mode] || MODES.links;
  const rows = [];   // [{ a, b, ae, be }]: the two inputs and the error line under each
  function add(first, second) {
    const i = rows.length;
    const a = h("input", M.a(i)), b = h("input", M.b(i));
    const ae = h("div", { class: "field-error", hidden: true }), be = h("div", { class: "field-error", hidden: true });
    a.value = first || ""; b.value = second || "";
    host.append(h("div", { style: "display:grid;grid-template-columns:" + M.grid + ";gap:12px;" }, h("div", {}, a, ae), h("div", {}, b, be)));
    rows.push({ a, b, ae, be });
    addBtn.disabled = rows.length >= M.max;
  }
  function reset() { clear(host); rows.length = 0; add(); addBtn.disabled = false; }
  const values = () => rows.map((r) => ({ [M.keys[0]]: r.a.value, [M.keys[1]]: r.b.value }));
  function showErrors(byRow) {
    rows.forEach((r, i) => {
      const e = (byRow && byRow[i]) || {};
      for (const [inp, box, key] of [[r.a, r.ae, M.keys[0]], [r.b, r.be, M.keys[1]]]) { box.hidden = !e[key]; box.textContent = e[key] || ""; inp.setAttribute("aria-invalid", e[key] ? "true" : "false"); }
    });
  }
  // the first row that has an error gets the focus (its first box, or its second when only that one is wrong)
  function focus(errors) {
    const bad = Object.keys(errors || {})[0];
    if (bad !== undefined && rows[bad]) (errors[bad][M.keys[0]] ? rows[bad].a : rows[bad].b).focus(); else if (rows[0]) rows[0].a.focus();
  }
  function setLocked(on) { for (const r of rows) { r.a.disabled = on; r.b.disabled = on; } addBtn.disabled = on || rows.length >= M.max; }
  addBtn.addEventListener("click", () => { if (rows.length < M.max) { add(); rows[rows.length - 1].a.focus(); } });
  add();
  return { rows, add, reset, values, showErrors, focus, setLocked };
}

// convenience for pages that only have the ids
export const mountLinkRowsById = () => mountLinkRows({ host: $("#linkRows"), addBtn: $("#addLinkBtn") });
export const mountFirmRowsById = () => mountLinkRows({ host: $("#firmRows"), addBtn: $("#addFirmBtn"), mode: "firms" });
