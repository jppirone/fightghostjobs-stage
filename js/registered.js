// registered.js - the "Registered" check mark rule on the page (October 9, 2026). Pure (no DOM, no network): tested in Node by tests/registered.unit.test.js.
//
// THE RULE IS THE DATABASE'S, NOT THE PAGE'S: an opening is registered when its organization has an active paid plan, or a pilot plan with an expiry date that has not passed (decided by public.org_is_registered, computed inside the search functions). The page receives ONE plain true or false
// per result row, is_registered, and nothing else about the organization's plan: no plan name, no source, no expiry. This file only turns that one value into "draw the mark or not".
// ONLY a real boolean true draws it. A missing value (an answer from before the database change), a string "true", a number, null: not registered, no mark. There is no "listed" label either: an opening that is not registered simply has no mark.
export const isRegistered = (row) => !!row && typeof row === "object" && row.is_registered === true;
