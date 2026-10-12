// link-panel.js - the "Destination links" rows panel (item 4): one row per stored application link, with Check link, Edit and Remove. The words and the rules are in js/link-panel-model.js; the rows and their
// behavior are the shared rows panel (js/row-panel.js, since prompt BC, October 10, 2026), which the recruiter firms (js/firm-panel.js) and the AI and hiring policy link (js/policy-panel.js) also use.
// This file is only the destination links PROFILE: which words, which rows, and which three api calls. Rules (tests/site-check.js S38 pins them, in this file and in js/row-panel.js):
//   * an address is NEVER on the page; Check link opens a one-time ticket link in a new tab; Remove and Edit ask first, in the row.
//   * the three row actions call exactly these api functions with the stored position: api.checkDestinationLink, api.editDestinationLink, api.removeDestinationLink.

import { checkWarnings } from "./edit-form.js?v=b5757c87";
import { LP, panelRows, rowMeta, rowsSignature, checkAria, editAria, removeAria, planEdit, confirmText, refusalFor, successText } from "./link-panel-model.js?v=af31acf3";
import { mountRowPanel } from "./row-panel.js?v=2ab133e1";

// ctx: { host, hintEl, noteEl, api, getPostingId, openBlank, schedule, now, isBlocked, onSessionEnded, onStale, onChanged }
//   api: needs checkDestinationLink, editDestinationLink, removeDestinationLink (the rest is the shared panel's: see js/row-panel.js)
export function mountLinkPanel(ctx) {
  const { api } = ctx;
  const profile = {
    words: LP,
    rows: panelRows,
    signature: rowsSignature,
    meta: rowMeta,
    canCheck: () => true,
    aria: { check: (row) => checkAria(row.position), edit: (row) => editAria(row.position), remove: (row) => removeAria(row.position) },
    openLabel: (position) => "Open Link " + position,
    edit: {
      title: (row) => LP.editTitle(row.position, row.label), help: LP.EDIT_HELP, addressAria: (row) => LP.addressAria(row.position), addressPlaceholder: LP.ADDRESS_PLACEHOLDER,
      second: { aria: (row) => LP.labelAria(row.position), placeholder: LP.LABEL_PLACEHOLDER, maxlength: 100, prefill: (row) => row.label || "" },      // the label is a private note, not a secret: it is prefilled
    },
    plan: (addressText, labelText, row) => { const p = planEdit(addressText, labelText, row.label); return { ...p, errors: { url: p.errors.url, second: p.errors.label } }; },
    confirmText: (row, plan) => confirmText(row.position, plan, row.label),
    removeText: (row) => LP.removeConfirm(row.position, row.label),
    runCheck: (row) => api.checkDestinationLink(ctx.getPostingId(), row.position),
    runEdit: (row, change) => api.editDestinationLink(ctx.getPostingId(), row.position, change),
    runRemove: (row) => api.removeDestinationLink(ctx.getPostingId(), row.position),
    refusal: (op, err) => { const f = refusalFor(op, err); return { ...f, where: f.where === "label" ? "second" : f.where }; },
    success: (op, data, plan) => successText(op, data, plan),
    editWarn: (data, row, plan) => (plan.replacesAddress ? checkWarnings(data.links.filter((x) => x.position === row.position)) : null),
  };
  return mountRowPanel({ ...ctx, profile });
}
