// link-rows.js - the destination-link rows (Address | Label) that the register form and the edit page share. The rows are only inputs: what they hold is
// checked by checkLinks (edit-form.js) and sent by the page. One row is shown by default; "Add another link" adds one, up to MAX_LINKS.
import { $, h, clear } from "./dom.js";
import { MAX_LINKS, MAX_URL, MAX_LABEL } from "./edit-form.js";

// host: the element the rows go in; addBtn: the "Add another link" button. -> { rows, add, reset, values, showErrors, focus, setLocked }
export function mountLinkRows({ host, addBtn }) {
  const rows = [];   // [{ u, l, ue, le }]: the address input, the label input, and the error line under each
  function add(url, label) {
    const i = rows.length;
    const u = h("input", { type: "text", inputmode: "url", maxlength: MAX_URL, autocomplete: "off", spellcheck: "false", "aria-label": "Destination address " + (i + 1), placeholder: "Address, starting with https://" });
    const l = h("input", { type: "text", maxlength: MAX_LABEL, autocomplete: "off", "aria-label": "Label for link " + (i + 1) + " (optional)", placeholder: "Label (optional)" });
    const ue = h("div", { class: "field-error", hidden: true }), le = h("div", { class: "field-error", hidden: true });
    u.value = url || ""; l.value = label || "";
    host.append(h("div", { style: "display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:12px;" }, h("div", {}, u, ue), h("div", {}, l, le)));
    rows.push({ u, l, ue, le });
    addBtn.disabled = rows.length >= MAX_LINKS;
  }
  function reset() { clear(host); rows.length = 0; add(); addBtn.disabled = false; }
  const values = () => rows.map((r) => ({ url: r.u.value, label: r.l.value }));
  function showErrors(byRow) {
    rows.forEach((r, i) => {
      const e = (byRow && byRow[i]) || {};
      for (const [inp, box, key] of [[r.u, r.ue, "url"], [r.l, r.le, "label"]]) { box.hidden = !e[key]; box.textContent = e[key] || ""; inp.setAttribute("aria-invalid", e[key] ? "true" : "false"); }
    });
  }
  // the first row that has an error gets the focus (its address box, or its label box when only the label is wrong)
  function focus(errors) {
    const bad = Object.keys(errors || {})[0];
    if (bad !== undefined && rows[bad]) (errors[bad].url ? rows[bad].u : rows[bad].l).focus(); else if (rows[0]) rows[0].u.focus();
  }
  function setLocked(on) { for (const r of rows) { r.u.disabled = on; r.l.disabled = on; } addBtn.disabled = on || rows.length >= MAX_LINKS; }
  addBtn.addEventListener("click", () => { if (rows.length < MAX_LINKS) { add(); rows[rows.length - 1].u.focus(); } });
  add();
  return { rows, add, reset, values, showErrors, focus, setLocked };
}

// convenience for pages that only have the ids
export const mountLinkRowsById = () => mountLinkRows({ host: $("#linkRows"), addBtn: $("#addLinkBtn") });
