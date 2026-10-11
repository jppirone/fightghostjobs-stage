// row-panel.js - the ONE rows panel behind three areas of the opening editor (prompt BC, October 10, 2026): Destination links (js/link-panel.js), Recruiter firms (js/firm-panel.js) and the AI and hiring policy
// link (js/policy-panel.js). One row per stored item, with Check link, Edit and Remove. What differs between the three (the words, the rows, the edit boxes, the calls) is a PROFILE passed in; the behavior is here once.
// Rules this file keeps (tests/site-check.js S38 and S72 pin them):
//   * an address is NEVER on the page: a row is built from what the profile's rows() reads (position, a name or label, what candidates see, the save-time check result); the address box of the edit form is created
//     empty, is never given a value, has autocomplete off, is read once when a request is sent, and is emptied as soon as the request has been answered. Nothing the person typed is kept in a variable.
//     (The page also asks hasPending(): a yes/no answer, worked out from whether the boxes hold anything, so it can warn before an unsaved edit is lost. Nothing is copied out of the boxes.)
//   * Check link asks the server for a one-time ticket link (profile.check) and uses the answer ONLY as the place a new tab goes to. A tab is opened blank inside the click itself (before any wait, so a
//     browser does not take it for a pop-up), then pointed at the ticket link when the answer arrives; its opener is cut first. If the browser refused the tab, the ticket link is offered as a link to click (one minute).
//     The ticket link is never fetched, never shown as text and never stored. A row without an address (profile.canCheck false) has no Check link button.
//   * Remove and Edit ask first, in the row, in plain words; nothing is sent before the person confirms. One request at a time.
// Everything is built with h() (text nodes only; no HTML is ever parsed).

import { h, clear, alertBox } from "./dom.js?v=ff147636";

// ctx: { host, hintEl, noteEl, profile, openBlank, schedule, now, isBlocked, onSessionEnded, onStale, onChanged }
//   host: the element the rows go in; hintEl / noteEl: the panel's sentence and the address-bar note (shown only while there are rows);
//   profile: {
//     words: { CHECK, EDIT, REMOVE, SAVE, CONTINUE, CANCEL, GO_BACK, OPENED, BLOCKED, EXPIRED, EMPTY (or null: no sentence when there is nothing), NOTHING_CHANGED }
//     rows(list) -> [{ position, title, ... }] in the order to draw them      signature(rows) -> string      meta(row) -> string or [string]      rowNotice(row) -> { kind, text } or null (always shown in the row)
//     canCheck(row)       aria: { check(row), edit(row), remove(row) }     openLabel(position) -> the words of the fallback link
//     edit: { title(row), help, addressAria(row), addressPlaceholder, second: null | { aria(row), placeholder, maxlength, prefill(row) } }
//     plan(addressText, secondText, row) -> { ok, errors: { url?, second? }, change, replacesAddress }     confirmText(row, plan)     removeText(row)
//     runCheck(row), runEdit(row, change), runRemove(row) -> the api answers ({ ok, data } or { ok: false, error })
//     refusal(op, err) -> { text, where: "url" | "second" | "row" | "panel", sessionEnded, stale }     success(op, data, plan, row) -> string     editWarn(data, row, plan) -> string | null
//     editKind(data, plan, row) -> "ok" | "notice" (optional: when the saved row itself needs the amber notice, as for a check that did not answer)
//   }
//   openBlank(): opens an empty tab and returns it, or null when the browser refused; schedule(ms, fn): a timer (injected so tests can run it); now(): milliseconds
//   isBlocked(): true while something else on the page is saving (a row action then does nothing); onSessionEnded(): the session is over; onStale(): reload the posting from the server;
//   onChanged(list, said): the stored items after an edit or a remove, and what was said about it ({ op, kind: "ok" | "notice", text }) for a section that must say it somewhere else when its row is gone
export function mountRowPanel(ctx) {
  const { host, hintEl, noteEl, profile: P } = ctx;
  const W = P.words;
  const schedule = ctx.schedule || ((ms, fn) => setTimeout(fn, ms)), now = ctx.now || (() => Date.now());
  const openBlank = ctx.openBlank || (() => { try { return window.open("about:blank", "_blank"); } catch { return null; } });
  let rows = [], signature = null, busy = false, panelNote = null, panelBox = null, buttons = [], lastList = [], pendingChecks = [];
  const notes = new Map();      // position -> { kind, text } or { position, link }: the last thing said about a row (kept across a redraw)
  const noteBoxes = new Map();  // position -> the element that shows it

  const setBusy = (on) => { busy = on; for (const b of buttons) b.disabled = on; };
  const canAct = () => !busy && !(ctx.isBlocked && ctx.isBlocked());

  function noteNode(note) {
    if (!note) return null;
    if (note.link) {
      // the browser refused the new tab: the ticket link as a link to click (a navigation target only, never shown as text), good for the minute it lives
      return h("div", { class: "alert alert-notice", role: "status" }, W.BLOCKED, h("a", { href: note.link, target: "_blank", rel: "noopener noreferrer", class: "link-open" }, P.openLabel(note.position)));
    }
    return alertBox(note.kind, note.text);
  }
  function setNote(position, note) { if (note) notes.set(position, note); else notes.delete(position); const box = noteBoxes.get(position); if (box) { clear(box); const n = noteNode(note) || stored(position); if (n) box.append(n); } }
  function setPanelNote(kind, text) { panelNote = text ? { kind, text } : null; if (panelBox) { clear(panelBox); const n = noteNode(panelNote); if (n) panelBox.append(n); } }
  // what the row always says about itself when nothing else was said (profile.rowNotice: for example the check that did not answer)
  function stored(position) { const r = rows.find((x) => x.position === position); const s = r && P.rowNotice ? P.rowNotice(r) : null; return s ? alertBox(s.kind, s.text) : null; }

  // a refusal: the sentence goes where it belongs (under the address or second box, in the open form, in the row, or for the whole panel); the page is told what it must do (sign in again, reload)
  //   target: { url, second, form }: the elements of an open edit form (optional)
  async function refused(op, err, row, target) {
    const f = P.refusal(op, err);
    if (f.sessionEnded) { await ctx.onSessionEnded(); return; }
    if (f.stale) await ctx.onStale();       // first: the page redraws from the server (and the old notes go), then what is said below stays
    if (f.text) {
      const box = target && (f.where === "url" || f.where === "second") ? target[f.where] : target && f.where === "row" ? target.form : null;
      if (f.where === "panel") setPanelNote("error", f.text);
      else if (box) { box.textContent = f.text; box.hidden = false; }
      else setNote(row.position, { kind: "error", text: f.text });
    }
  }

  // ---- Check link
  async function doCheck(row) {
    if (!canAct()) return;
    const w = openBlank();                  // FIRST, synchronously inside the click: a tab opened after a wait is taken for a pop-up
    setBusy(true); setNote(row.position, null); setPanelNote("ok", "");
    try {
      const r = await P.runCheck(row);
      if (!r.ok) { if (w) { try { w.close(); } catch { /* already gone */ } } await refused("check", r.error, row); return; }
      const opened = !!w && w.closed !== true;
      if (opened) {
        try { w.opener = null; } catch { /* a browser that does not allow it: the tab still only goes to the ticket link */ }
        w.location = r.data.go_url;
        setNote(row.position, { kind: "notice", text: W.OPENED });
      } else {
        const expires = Date.parse(r.data.expires_at), link = r.data.go_url;
        setNote(row.position, { kind: "notice", position: row.position, link });
        const wait = Number.isFinite(expires) ? Math.max(0, expires - now()) : 60000;
        schedule(wait, () => { const cur = notes.get(row.position); if (cur && cur.link === link) setNote(row.position, { kind: "notice", text: W.EXPIRED }); });
      }
    } finally { setBusy(false); }
  }

  // ---- Remove
  function removeBox(row, refs) {
    const text = h("p", { class: "link-confirm-text", tabindex: "-1" }, P.removeText(row));
    const yes = h("button", { type: "button", class: "btn btn-dark btn-sm", "aria-label": P.aria.remove(row) }, W.REMOVE);
    const no = h("button", { type: "button", class: "btn btn-ghost btn-sm" }, W.CANCEL);
    const box = h("div", { class: "link-confirm link-remove", hidden: true }, text, h("div", { class: "contest-actions" }, yes, no));
    refs.removeText = text;
    buttons.push(yes, no);
    no.addEventListener("click", () => { box.hidden = true; refs.removeTrigger.setAttribute("aria-expanded", "false"); refs.removeTrigger.focus(); });
    yes.addEventListener("click", async () => {
      if (!canAct()) return;
      setBusy(true); setNote(row.position, null);
      try {
        const r = await P.runRemove(row);
        if (!r.ok) { await refused("remove", r.error, row); return; }
        setItems(r.data.links, true);
        const said = P.success("remove", r.data, null, row);
        setPanelNote("ok", said);
        if (panelBox) panelBox.focus();         // the row the focus was in is gone: the sentence about it takes the focus
        await ctx.onChanged(r.data.links, { op: "remove", kind: "ok", text: said });
      } finally { setBusy(false); }
    });
    return box;
  }

  // ---- Edit
  function editBox(row, refs) {
    const E = P.edit, S = E.second;
    const addr = h("input", { type: "text", inputmode: "url", maxlength: "2048", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": E.addressAria(row), placeholder: E.addressPlaceholder });   // NEVER given a value
    const secondBox = S ? h("input", { type: "text", maxlength: String(S.maxlength), autocomplete: "off", "aria-label": S.aria(row), placeholder: S.placeholder }) : null;
    if (secondBox) secondBox.value = S.prefill(row);       // a label or a name is not a secret: it is prefilled so a change of only that needs no retyping
    const addrErr = h("div", { class: "field-error", hidden: true }), secondErr = h("div", { class: "field-error", hidden: true }), formErr = h("div", { class: "field-error", role: "alert", hidden: true });
    const next = h("button", { type: "submit", class: "btn btn-dark btn-sm" }, W.CONTINUE), cancel = h("button", { type: "button", class: "btn btn-ghost btn-sm" }, W.CANCEL);
    const fields = h("div", { class: "contest-fields" }, h("div", { class: "link-edit-title" }, E.title(row)), h("p", { class: "field-hint", style: "margin:0;" }, E.help),
      h("div", {}, addr, addrErr), secondBox ? h("div", {}, secondBox, secondErr) : null, h("div", { class: "contest-actions" }, next, cancel));
    const confirmTextEl = h("p", { class: "link-confirm-text", tabindex: "-1" }, "");
    const save = h("button", { type: "button", class: "btn btn-dark btn-sm" }, W.SAVE), back = h("button", { type: "button", class: "btn btn-ghost btn-sm" }, W.GO_BACK);
    const confirm = h("div", { class: "link-confirm", hidden: true }, confirmTextEl, h("div", { class: "contest-actions" }, save, back));
    const form = h("form", { class: "link-edit contest-form", novalidate: true, hidden: true, "aria-label": E.title(row) }, fields, confirm, formErr);
    refs.addr = addr;
    buttons.push(next, cancel, save, back);
    // an open edit form holding something not saved: a typed address, or a second box that differs from the stored one (a yes/no answer; nothing is copied out of the boxes)
    pendingChecks.push(() => !form.hidden && (addr.value.trim() !== "" || (!!secondBox && secondBox.value.trim() !== S.prefill(row))));

    const showErrors = (errors) => {
      for (const [box, input, key] of [[addrErr, addr, "url"], [secondErr, secondBox, "second"]]) { if (!input) continue; box.hidden = !errors[key]; box.textContent = errors[key] || ""; input.setAttribute("aria-invalid", errors[key] ? "true" : "false"); }
    };
    const step = (n) => { fields.hidden = n !== 1; confirm.hidden = n !== 2; };
    const close = () => { form.hidden = true; refs.editTrigger.setAttribute("aria-expanded", "false"); step(1); showErrors({}); formErr.hidden = true; addr.value = ""; refs.editTrigger.focus(); };
    refs.closeEdit = close;
    cancel.addEventListener("click", close);
    back.addEventListener("click", () => { step(1); addr.focus(); });
    form.addEventListener("submit", (ev) => {
      ev.preventDefault(); if (!canAct()) return;
      formErr.hidden = true;
      const plan = P.plan(addr.value, secondBox ? secondBox.value : "", row);
      showErrors(plan.errors);
      if (!plan.ok) { (plan.errors.url || !secondBox ? addr : secondBox).focus(); return; }
      if (!plan.change) { close(); setNote(row.position, { kind: "notice", text: W.NOTHING_CHANGED }); return; }
      confirmTextEl.textContent = P.confirmText(row, plan); step(2); confirmTextEl.focus();
    });
    save.addEventListener("click", async () => {
      if (!canAct()) return;
      const plan = P.plan(addr.value, secondBox ? secondBox.value : "", row);       // read again now: the boxes are the only copy
      if (!plan.ok || !plan.change) { step(1); showErrors(plan.errors); return; }
      setBusy(true); setNote(row.position, null); formErr.hidden = true;
      let r;
      try { r = await P.runEdit(row, plan.change); } finally { addr.value = ""; }     // emptied the moment the request is answered, whatever the answer
      try {
        if (!r.ok) { step(1); await refused("edit", r.error, row, { url: addrErr, second: secondErr, form: formErr }); return; }
        const text = P.success("edit", r.data, plan, row);
        const warn = r.data.changed === false ? null : P.editWarn(r.data, row, plan);
        setItems(r.data.links, true);
        const kind = P.editKind ? P.editKind(r.data, plan, row) : warn || r.data.changed === false ? "notice" : "ok";
        setNote(row.position, { kind, text: text + (warn ? " " + warn : "") });
        if (noteBoxes.get(row.position)) noteBoxes.get(row.position).focus();       // the form that had the focus is gone: the sentence about the change takes it
        await ctx.onChanged(r.data.links, { op: "edit", kind, text: text + (warn ? " " + warn : "") });
      } finally { setBusy(false); }
    });
    return form;
  }

  // ---- the rows
  function rowNode(row) {
    const refs = {};
    const check = P.canCheck(row) ? h("button", { type: "button", class: "btn btn-outline btn-sm", "aria-label": P.aria.check(row) }, W.CHECK) : null;
    const edit = h("button", { type: "button", class: "btn btn-outline btn-sm", "aria-expanded": "false", "aria-label": P.aria.edit(row) }, W.EDIT);
    const remove = h("button", { type: "button", class: "btn btn-outline btn-sm", "aria-expanded": "false", "aria-label": P.aria.remove(row) }, W.REMOVE);
    refs.editTrigger = edit; refs.removeTrigger = remove;
    buttons.push(...(check ? [check] : []), edit, remove);
    const noteBox = h("div", { tabindex: "-1" }, noteNode(notes.get(row.position)) || stored(row.position)); noteBoxes.set(row.position, noteBox);
    const meta = P.meta(row), metaLines = Array.isArray(meta) ? meta : [meta];
    const el = h("div", { class: "link-row", "data-position": String(row.position) },
      h("div", { class: "link-row-top" }, h("div", { class: "link-row-main" }, h("div", { class: "link-row-title" }, row.title), ...metaLines.map((m) => h("div", { class: "link-row-meta" }, m))),
        h("div", { class: "link-row-actions" }, ...(check ? [check] : []), edit, remove)), noteBox);
    const form = editBox(row, refs), rbox = removeBox(row, refs);
    el.append(form, rbox);
    if (check) check.addEventListener("click", () => doCheck(row));
    edit.addEventListener("click", () => {
      if (!canAct()) return;
      if (form.hidden) { rbox.hidden = true; remove.setAttribute("aria-expanded", "false"); form.hidden = false; edit.setAttribute("aria-expanded", "true"); refs.addr.focus(); } else refs.closeEdit();
    });
    remove.addEventListener("click", () => {
      if (!canAct()) return;
      if (rbox.hidden) { if (!form.hidden) refs.closeEdit(); rbox.hidden = false; remove.setAttribute("aria-expanded", "true"); refs.removeText.focus(); } else { rbox.hidden = true; remove.setAttribute("aria-expanded", "false"); }
    });
    return el;
  }

  // list: get-my-posting's destination_links (or an answer's links); force: redraw even when what is shown is the same
  function setItems(list, force) {
    lastList = Array.isArray(list) ? list : [];
    const next = P.rows(list), sig = P.signature(next), has = next.length > 0;
    if (hintEl) hintEl.hidden = !has;
    if (noteEl) noteEl.hidden = !has;
    if (!force && sig === signature) return;
    if (!force) { notes.clear(); panelNote = null; }        // the page redrew the rows from the server (not after this panel's own change): what was said before is out of date
    signature = sig; rows = next;
    for (const p of Array.from(notes.keys())) if (!rows.some((r) => r.position === p)) notes.delete(p);
    clear(host); buttons = []; noteBoxes.clear(); pendingChecks = [];
    panelBox = h("div", { tabindex: "-1" }, noteNode(panelNote)); host.append(panelBox);
    if (!has) { if (W.EMPTY) host.append(h("div", { style: "font-size:14px;line-height:1.6;color:#4A453F;" }, W.EMPTY)); return; }
    for (const r of rows) host.append(rowNode(r));
    if (busy) for (const b of buttons) b.disabled = true;
  }

  // hasPending: an edit form is open with something typed that is not saved; discard: draw the rows again from the stored items (every open edit form and its text are gone)
  return { render: (list) => setItems(list, false), isBusy: () => busy, rows: () => rows.slice(), hasPending: () => pendingChecks.some((f) => f()), discard: () => setItems(lastList, true) };
}
