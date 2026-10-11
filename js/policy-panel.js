// policy-panel.js - the AI and hiring policy link as a row (prompt BC, October 10, 2026): once a link is stored it is one row, with Check link, Edit and Remove, like the destination links and the recruiter
// firms. The rows and their behavior are the shared rows panel (js/row-panel.js); this file is only the policy link PROFILE. Nothing about the candidate line, the tier gate or the stored check changes.
// Rules (tests/site-check.js S72 pins them): the address is never on the page; Check link is api.checkPolicyLink; Edit and Remove are the whole-set call api.setPolicyLink (one address, or null), never an
// application link's call; the policy link is its own kind and is not an application link.

import { LP, refusalFor } from "./link-panel-model.js?v=b98fb34c";
import { mountRowPanel } from "./row-panel.js?v=2ab133e1";
import { isPolicy, policyRows, policySignature, policyRowMeta, policyRowNotice, planPolicyEdit, policySavedText, policyAria, POLICY_ROW_HINT, POLICY_EDIT_HELP, POLICY_ADDRESS_ARIA, POLICY_EDIT_TITLE,
  POLICY_CONFIRM_REPLACE, POLICY_REMOVE_CONFIRM, POLICY_OPEN_LABEL } from "./policy-link.js?v=f2ea9573";

export { POLICY_ROW_HINT };

// ctx: { host, hintEl, api, getPostingId, openBlank, schedule, now, isBlocked, onSessionEnded, onStale, onChanged }
//   api: needs checkPolicyLink, setPolicyLink
export function mountPolicyPanel(ctx) {
  const { api } = ctx;
  const profile = {
    words: { ...LP, EMPTY: null },                 // with no link stored the box and its Save button are shown instead (no sentence here)
    rows: policyRows,
    signature: policySignature,
    meta: policyRowMeta,
    rowNotice: policyRowNotice,
    canCheck: () => true,
    aria: { check: () => policyAria.check, edit: () => policyAria.edit, remove: () => policyAria.remove },
    openLabel: () => POLICY_OPEN_LABEL,
    edit: { title: () => POLICY_EDIT_TITLE, help: POLICY_EDIT_HELP, addressAria: () => POLICY_ADDRESS_ARIA, addressPlaceholder: LP.ADDRESS_PLACEHOLDER, second: null },
    plan: (addressText) => planPolicyEdit(addressText),
    confirmText: () => POLICY_CONFIRM_REPLACE,
    removeText: () => POLICY_REMOVE_CONFIRM,
    runCheck: () => api.checkPolicyLink(ctx.getPostingId()),
    runEdit: (row, change) => api.setPolicyLink(ctx.getPostingId(), change.url),
    runRemove: () => api.setPolicyLink(ctx.getPostingId(), null),
    refusal: (op, err) => { const f = refusalFor(op, err); return { ...f, where: f.where === "label" ? "second" : f.where }; },
    success: (op, data) => policySavedText(data, op === "remove"),
    editWarn: () => null,
    editKind: (data) => { const saved = Array.isArray(data.links) ? data.links.find(isPolicy) : null; return !saved || saved.check_status === "ok" ? "ok" : "notice"; },
  };
  return mountRowPanel({ ...ctx, profile });
}
