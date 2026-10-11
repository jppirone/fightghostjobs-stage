// link-rows.js - the two-box rows the register form and the edit page share: destination links (Address | Label, up to 10) and, since pass C, recruiter firms (Name | Address, up to 3).
// The rows are only inputs: what they hold is checked by checkLinks / checkFirms (edit-form.js) and sent by the page. One row is shown by default; the add button adds one, up to the cap.
import { $, h, clear } from "./dom.js?v=ff147636";
import { MAX_LINKS, MAX_URL, MAX_LABEL, MAX_FIRMS, MAX_FIRM_NAME } from "./edit-form.js?v=b5757c87";

const MODES = {
  links: { max: MAX_LINKS, keys: ["url", "label"], a: (i) => ({ type: "text", inputmode: "url", maxlength: MAX_URL, autocomplete: "off", spellcheck: "false", "aria-label": "Destination address " + (i + 1), placeholder: "Address, starting with https://" }), b: (i) => ({ type: "text", maxlength: MAX_LABEL, autocomplete: "off", "aria-label": "Label for link " + (i + 1) + " (optional)", placeholder: "Label (optional, for you only)" }), grid: "minmax(0,3fr) minmax(0,2fr)" },
  // prompt BG: the add form under the firm rows: ONE row (a name and an optional address) that adds one firm; the page's button does the adding
  firmAdd: { max: 1, keys: ["name", "url"], a: () => ({ type: "text", maxlength: MAX_FIRM_NAME, autocomplete: "organization", "aria-label": "Name of the firm to add", placeholder: "Firm name" }), b: () => ({ type: "text", inputmode: "url", maxlength: MAX_URL, autocomplete: "off", spellcheck: "false", "aria-label": "Address of the firm to add (optional)", placeholder: "Address (optional), starting with https://" }), grid: "minmax(0,2fr) minmax(0,3fr)" },
  firms: { max: MAX_FIRMS, keys: ["name", "url"], a: (i) => ({ type: "text", maxlength: MAX_FIRM_NAME, autocomplete: "organization", "aria-label": "Recruiter firm " + (i + 1), placeholder: "Firm name" }), b: (i) => ({ type: "text", inputmode: "url", maxlength: MAX_URL, autocomplete: "off", spellcheck: "false", "aria-label": "Address of firm " + (i + 1) + " (optional)", placeholder: "Address (optional), starting with https://" }), grid: "minmax(0,2fr) minmax(0,3fr)" },
};

// host: the element the rows go in; addBtn: the add button; mode: "links" (default) | "firms". -> { rows, add, reset, values, showErrors, focus, setLocked, checkAddresses }
// checkAddress (prompt BJ, optional; the register page passes edit-form.js addressProblem): text -> a sentence or null. With it, an address box is judged as soon as the person leaves it (a sentence under its own
// box), the sentence goes away when the box is edited, and the add button refuses to add a row while an address above is malformed (it shows the sentence and puts the cursor there). Without it nothing changes.
export function mountLinkRows({ host, addBtn, mode = "links", checkAddress = null }) {
  const M = MODES[mode] || MODES.links;
  const rows = [];   // [{ a, b, ae, be }]: the two inputs and the error line under each
  function add(first, second) {
    const i = rows.length;
    const a = h("input", M.a(i)), b = h("input", M.b(i));
    const ae = h("div", { class: "field-error", hidden: true }), be = h("div", { class: "field-error", hidden: true });
    a.value = first || ""; b.value = second || "";
    host.append(h("div", { style: "display:grid;grid-template-columns:" + M.grid + ";gap:12px;" }, h("div", {}, a, ae), h("div", {}, b, be)));
    const row = { a, b, ae, be, addr: M.keys[0] === "url" ? a : b, addrErr: M.keys[0] === "url" ? ae : be };
    rows.push(row);
    if (typeof checkAddress === "function") {
      row.addr.addEventListener("blur", () => judge(row));
      row.addr.addEventListener("input", () => { row.addrErr.hidden = true; row.addrErr.textContent = ""; row.addr.setAttribute("aria-invalid", "false"); });
    }
    if (addBtn) addBtn.disabled = rows.length >= M.max;
  }
  // one address box judged: nothing typed is no problem (a row may be unused); -> true when it has a problem (the sentence is shown under it)
  function judge(r) {
    if (typeof checkAddress !== "function") return false;
    const text = r.addr.value.trim();
    const p = text === "" ? null : checkAddress(text);
    r.addrErr.hidden = !p; r.addrErr.textContent = p || ""; r.addr.setAttribute("aria-invalid", p ? "true" : "false");
    return !!p;
  }
  // every address box judged now; -> the first row that has a problem (or null)
  function checkAddresses() { let first = null; for (const r of rows) if (judge(r) && first === null) first = r; return first; }
  function reset() { clear(host); rows.length = 0; add(); if (addBtn) addBtn.disabled = false; }
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
  function setLocked(on) { for (const r of rows) { r.a.disabled = on; r.b.disabled = on; } if (addBtn) addBtn.disabled = on || rows.length >= M.max; }
  if (addBtn) addBtn.addEventListener("click", () => {
    if (rows.length >= M.max) return;
    const bad = checkAddresses();
    if (bad) { bad.addr.focus(); return; }       // prompt BJ: a malformed address is told to the person before another row is added
    add(); rows[rows.length - 1].a.focus();
  });
  add();
  return { rows, add, reset, values, showErrors, focus, setLocked, checkAddresses };
}

// convenience for pages that only have the ids
export const mountLinkRowsById = (opts = {}) => mountLinkRows({ host: $("#linkRows"), addBtn: $("#addLinkBtn"), ...opts });
export const mountFirmRowsById = (opts = {}) => mountLinkRows({ host: $("#firmRows"), addBtn: $("#addFirmBtn"), mode: "firms", ...opts });
