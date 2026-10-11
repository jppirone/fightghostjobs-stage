// firm-panel.js - the "Recruiter firms" rows (prompt BC, October 10, 2026): one row per named firm, with Check link, Edit and Remove. The rows and their behavior are the shared rows panel (js/row-panel.js);
// this file is only the recruiter firms PROFILE: which words (js/firm-panel-model.js), which rows, and which three api calls. A firm saved without an address has no Check link button and says so.
// Rules (tests/site-check.js S72 pins them): the address is never on the page; the three row actions call api.checkRecruiterFirm, api.editRecruiterFirm and api.removeRecruiterFirm with the stored position.

import { isAuthFailure } from "./api.js?v=71ed1680";
import { FP, firmRows, firmMeta, firmSignature, planFirmEdit, firmConfirmText, firmRefusal, firmSuccess, firmWarn, checkAria, editAria, removeAria } from "./firm-panel-model.js?v=2265604c";
import { mountRowPanel } from "./row-panel.js?v=2ab133e1";

// ctx: { host, hintEl, api, getPostingId, openBlank, schedule, now, isBlocked, onSessionEnded, onStale, onChanged }
//   api: needs checkRecruiterFirm, editRecruiterFirm, removeRecruiterFirm
export function mountFirmPanel(ctx) {
  const { api } = ctx;
  const profile = {
    words: FP,
    rows: firmRows,
    signature: firmSignature,
    meta: firmMeta,
    canCheck: (row) => row.hasAddress,
    aria: { check: (row) => checkAria(row.position), edit: (row) => editAria(row.position), remove: (row) => removeAria(row.position) },
    openLabel: (position) => FP.openLabel(position),
    edit: {
      title: (row) => FP.editTitle(row.position, row.name), help: FP.EDIT_HELP, addressAria: (row) => FP.addressAria(row.position), addressPlaceholder: FP.ADDRESS_PLACEHOLDER,
      second: { aria: (row) => FP.nameAria(row.position), placeholder: FP.NAME_PLACEHOLDER, maxlength: 200, prefill: (row) => row.name },       // a firm's name is shown to candidates: it is prefilled
    },
    plan: (addressText, nameText, row) => planFirmEdit(addressText, nameText, row.name),
    confirmText: (row, plan) => firmConfirmText(row.position, plan, row.name),
    removeText: (row) => FP.removeConfirm(row.position, row.name),
    runCheck: (row) => api.checkRecruiterFirm(ctx.getPostingId(), row.position),
    runEdit: (row, change) => api.editRecruiterFirm(ctx.getPostingId(), row.position, change),
    runRemove: (row) => api.removeRecruiterFirm(ctx.getPostingId(), row.position),
    refusal: (op, err) => firmRefusal(op, err, isAuthFailure),
    success: (op, data, plan) => firmSuccess(op, data, plan),
    editWarn: (data, row, plan) => (plan.replacesAddress ? firmWarn(data, row.position) : null),
  };
  return mountRowPanel({ ...ctx, profile });
}
