// policy-pill.js - the "AI hiring policy" pill on the opening tile (prompt LM, October 23, 2026). Pure (no DOM): tested in Node.
// The pill is drawn only when the search row says the employer set an AI and hiring policy link that candidates may be shown: one plain true in has_policy_link (the database function that gives the link
// counts decides it with the same rule the details window uses: the plan is active, the stored check answered). It carries NO address: the one-time link is created when the person presses the pill, never
// before (js/pages/search.js asks candidate-link-issue at that moment and opens the policy entry it gets back). A row without the key, or with anything but a real true, has no pill.
export const POLICY_PILL_TEXT = "AI hiring policy";
export const hasPolicyPill = (row) => !!row && typeof row === "object" && row.has_policy_link === true;
// a chip spec { text, leaves: true, policy: true }, or null; the page gives it the press handler
export function policyPillChip(row) {
  return hasPolicyPill(row) ? { text: POLICY_PILL_TEXT, leaves: true, policy: true } : null;
}
