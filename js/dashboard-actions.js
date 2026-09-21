// dashboard-actions.js - the row actions on "My postings": publish a draft, pause, resume, extend (the one-time bump) and close. Each one opens a small confirmation dialog that says what will happen,
// then calls the backend (which has already been verified: it decides who may do what to which posting and refuses anything else). Everything shown is text (dom.js), never HTML.
import { h } from "./dom.js";
import { isAuthFailure, describeError } from "./api.js";
import { checkBump, checkClose, MAX_BUMP_DAYS, MAX_REASON, MAX_CLOSE_DETAIL } from "./dashboard-model.js";
import { fmtClose } from "./format.js";

export const ACTION_LABEL = { publish: "Publish", pause: "Pause", resume: "Resume", extend: "Extend", close: "Close" };

function focusable(root) { return Array.from(root.querySelectorAll("button:not([disabled]), input:not([disabled]), textarea:not([disabled])")).filter((e) => !e.hidden && e.offsetParent !== null); }

// content: nodes shown above the buttons.  onSubmit(): Promise<{ error?: string } | undefined>; a returned error is shown in the dialog and it stays open.
function openDialog({ title, content, confirmLabel, onSubmit }) {
  const previous = document.activeElement;
  let busy = false;
  const errBox = h("div", { class: "alert alert-error", role: "alert", hidden: true, style: "margin-top:14px;" });
  const confirm = h("button", { type: "submit", class: "btn btn-primary btn-sm" }, confirmLabel);
  const cancel = h("button", { type: "button", class: "btn btn-outline btn-sm" }, "Cancel");
  const form = h("form", { novalidate: true }, content, errBox, h("div", { style: "display:flex;gap:10px;justify-content:flex-end;margin-top:20px;" }, cancel, confirm));
  const box = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title }, h("h2", { style: "font-size:20px;font-weight:700;margin-bottom:12px;" }, title), form);
  const backdrop = h("div", { class: "modal-backdrop open" }, box);
  const close = () => { backdrop.remove(); document.removeEventListener("keydown", onKey); if (previous && previous.focus) previous.focus(); };
  function onKey(ev) {
    if (ev.key === "Escape" && !busy) { ev.preventDefault(); close(); return; }
    if (ev.key !== "Tab") return;
    const f = focusable(box); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  }
  backdrop.addEventListener("mousedown", (ev) => { if (ev.target === backdrop && !busy) close(); });
  cancel.addEventListener("click", () => { if (!busy) close(); });
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault(); if (busy) return;
    busy = true; confirm.disabled = true; cancel.disabled = true; errBox.hidden = true;
    const r = await onSubmit();
    busy = false; confirm.disabled = false; cancel.disabled = false;
    if (r && r.error) { errBox.hidden = false; errBox.textContent = r.error; return; }
    close();
  });
  document.body.append(backdrop); document.addEventListener("keydown", onKey);
  (focusable(form)[0] || confirm).focus();
}

const para = (text) => h("p", { style: "font-size:14px;line-height:1.6;color:var(--muted);margin:0 0 12px 0;" }, text);
const label = (text, forId) => h("label", { for: forId, style: "display:block;margin-top:12px;" }, text);
const fieldError = (id) => h("div", { class: "field-error", id: "err-" + id, hidden: true });
function showFieldErrors(errors, ids) { for (const id of ids) { const el = document.getElementById("err-" + id); if (el) { el.hidden = !errors[id]; el.textContent = errors[id] || ""; } } }

// deps: { api, done(message) (called after a successful action), sessionEnded() }
export function runAction(kind, p, deps) {
  const { api } = deps;
  const finish = async (r, okText) => {
    if (r.ok) { deps.done(okText(r.data)); return undefined; }
    if (isAuthFailure(r.error)) { deps.sessionEnded(); return { error: "Please sign in again." }; }
    if (r.error.code === "rate_limited") return { error: "Too many requests just now. Try again in a moment." };
    return { error: describeError(r.error, { what: "That posting" }) };
  };
  const posting = (d) => (d && d.posting && typeof d.posting === "object" ? d.posting : d);
  const title = "“" + p.title + "”";

  if (kind === "publish") {
    return openDialog({ title: "Publish this posting?", confirmLabel: "Publish now",
      content: [para(title + " goes live for candidates right away, and its " + p.window_days + "-day window starts now. The exact close date and time are shown once it is live.")],
      onSubmit: async () => finish(await api.publishPosting(p.id), (d) => title + " is live. It closes " + fmtClose(posting(d).expiration_date) + ".") });
  }
  if (kind === "pause") {
    return openDialog({ title: "Pause this posting?", confirmLabel: "Pause",
      content: [para("Candidates will see " + title + " as paused. The close date does not move: the clock keeps running while it is paused. You can resume it at any time.")],
      onSubmit: async () => finish(await api.pausePosting(p.id), () => title + " is paused.") });
  }
  if (kind === "resume") {
    return openDialog({ title: "Resume this posting?", confirmLabel: "Resume",
      content: [para(title + " goes back to live. The close date does not change.")],
      onSubmit: async () => finish(await api.resumePosting(p.id), () => title + " is live again.") });
  }
  if (kind === "extend") {
    const days = h("input", { id: "bumpDays", type: "text", inputmode: "numeric", maxlength: "2", autocomplete: "off", placeholder: "1 to " + MAX_BUMP_DAYS, "aria-describedby": "err-bumpDays" });
    const reason = h("input", { id: "bumpReason", type: "text", maxlength: String(MAX_REASON), autocomplete: "off", "aria-describedby": "err-bumpReason" });
    return openDialog({ title: "Extend this posting", confirmLabel: "Extend",
      content: [para("Every posting can be extended once, by 1 to " + MAX_BUMP_DAYS + " days, added to its current close date. This cannot be undone, and the reason is recorded."), label("Days to add", "bumpDays"), days, fieldError("bumpDays"), label("Reason", "bumpReason"), reason, fieldError("bumpReason")],
      onSubmit: async () => {
        const c = checkBump(days.value, reason.value); showFieldErrors(c.errors, ["bumpDays", "bumpReason"]);
        if (!c.ok) return { error: "Fix the highlighted field and try again." };
        return finish(await api.bumpPosting(p.id, c.body.bump_days, c.body.bump_reason), (d) => title + " now closes " + fmtClose(posting(d).expiration_date) + ".");
      } });
  }
  if (kind === "close") {
    const radio = (value, text, checked) => h("label", { class: "radio-row" }, h("input", { type: "radio", name: "closeReason", value, checked }), h("span", {}, text));
    const filled = radio("filled", "Filled: the role was filled", true), withdrawn = radio("withdrawn", "Withdrawn: the role is no longer being hired for", false);
    const detail = h("textarea", { id: "closeDetail", rows: "3", maxlength: String(MAX_CLOSE_DETAIL), "aria-describedby": "err-closeDetail" });
    const detailBox = h("div", { hidden: true }, label("Detail (optional, kept private, never shown to candidates)", "closeDetail"), detail, fieldError("closeDetail"));
    const chosen = () => (withdrawn.querySelector("input").checked ? "withdrawn" : "filled");
    const sync = () => { detailBox.hidden = chosen() !== "withdrawn"; };
    filled.addEventListener("change", sync); withdrawn.addEventListener("change", sync);
    return openDialog({ title: "Close this posting?", confirmLabel: "Close posting",
      content: [para("Closing is permanent: a closed posting cannot be reopened. Candidates will see " + title + " as closed, with the reason you choose."), filled, withdrawn, detailBox],
      onSubmit: async () => {
        const c = checkClose(chosen(), detail.value); showFieldErrors(c.errors, ["closeDetail"]);
        if (!c.ok) return { error: "Fix the highlighted field and try again." };
        return finish(await api.closePosting(p.id, c.body.closed_reason, c.body.closed_detail), () => title + " is closed.");
      } });
  }
  return undefined;
}
