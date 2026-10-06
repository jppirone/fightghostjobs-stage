// code-entry.js - the short emailed code, typed in the SAME tab (October 6, 2026).
// The sign-in email carries a link and a short one-time code. The link opens in a new tab (or another browser), which is where the two-tab and cross-browser problems came from. This is the second way to finish: the person types the code
// into the page that asked for the link, and the Auth service answers with the session right there. Used by the search page (candidates) and the employer sign-in page; both keep the link exactly as it was.
// Nothing here stores the code or the address anywhere: they live in the form for as long as the page is open. The wording says "confirm", never "verify".

import { h } from "./dom.js";
import { EMAIL_CODE_ENTRY } from "./config.js";

export const CODE_ENABLED = EMAIL_CODE_ENTRY === true;

// what the person typed -> only the digits (spaces and dashes are allowed because emails and phones display codes in groups)
export const cleanCode = (raw) => String(raw === undefined || raw === null ? "" : raw).replace(/[\s-]/g, "");
// null when the code is acceptable to send (6 to 10 digits; the Auth service decides whether it is right), else the sentence to show
export function codeProblem(raw) {
  const c = cleanCode(raw);
  if (c === "") return "Type the code from the email.";
  return /^\d{6,10}$/.test(c) ? null : "The code is made of digits only, usually 6.";
}
export function failureText(result) {
  if (result && (result.status === 429 || /rate|seconds|after/i.test(result.message || ""))) return "Too many tries. Wait a minute and try again.";
  return "That code did not work. Check it, or ask for a new link.";
}

// Builds the form into `host` (already empty) and returns { focus }.
//   confirm(email, code) -> Promise<{ ok, status, message }>      onDone(): the sign-in is complete (the session is stored)      onStartOver(): the person wants a new link      hint: the sentence under the label
export function mountCodeEntry({ host, email, confirm, onDone, onStartOver, hint }) {
  const input = h("input", { id: "codeInput", type: "text", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "16", "aria-describedby": "codeHint codeError", spellcheck: "false", autocapitalize: "off" });
  const error = h("div", { id: "codeError", class: "field-error", hidden: true });
  const submit = h("button", { type: "submit", id: "codeSubmit", class: "btn btn-dark" }, "Confirm");
  const form = h("form", { id: "codeForm", novalidate: true, style: "margin-top:18px;" },
    h("label", { for: "codeInput" }, "Or type the code from the email"),
    h("p", { id: "codeHint", style: "font-size:13px;line-height:1.5;color:var(--muted);margin:0 0 8px 0;" }, hint),
    h("div", { class: "signin-row" }, h("div", {}, input), submit),
    error);
  const startOver = h("button", { type: "button", id: "codeStartOver", class: "btn btn-ghost btn-sm", style: "margin-top:14px;" }, "Send a new link or use another address");
  const say = (text) => { error.hidden = !text; error.textContent = text || ""; input.setAttribute("aria-invalid", text ? "true" : "false"); };
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const problem = codeProblem(input.value);
    if (problem) { say(problem); input.focus(); return; }
    say("");
    submit.disabled = true; const label = submit.textContent; submit.textContent = "Confirming…";
    let r;
    try { r = await confirm(email, cleanCode(input.value)); } catch { r = { ok: false, status: 0, message: "" }; }
    submit.disabled = false; submit.textContent = label;
    if (r.ok) { await onDone(); return; }
    say(failureText(r)); input.value = ""; input.focus();
  });
  startOver.addEventListener("click", () => onStartOver());
  host.append(form, startOver);
  return { focus: () => input.focus() };
}
