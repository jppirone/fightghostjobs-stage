// link-pills.js - the two pills of the opening tile that say HOW MANY links the employer gave (October 23, 2026, prompt LK). Pure (no DOM): tested in Node.
// COUNTS ONLY. This module reads three numbers or flags of a search result and nothing else: apply_link_count (the application links), recruiter_firm_count (the named recruiter firms) and
// destination_links_exclusive (the employer's own statement that the links are the only way to apply). It never reads, keeps or prints an address, a firm address or a one-time link: the tile
// does not have one, and the one-time links are still issued only after the person opens the details (candidate-link-issue), exactly as before.
// The numbers are the ones the details page lists: the database counts the same rows (not retired; kind apply; kind recruiter only while the recruiter switch is on; the AI and hiring policy link is
// never counted; nothing at all while the organization's plan is lapsed), because it is the same rule. A result from before the database change has no counts: the application pill is then left out
// (the tile cannot say how many), and the recruiter pill says only what the switch says.
//   "3 official links" / "1 official link"      the employer has said the links are the only way to apply (the stored statement; FightGhostJobs does not check it)
//   "3 employer links" / "1 employer link"      links the employer gave, with no such statement
//   "No employer links"
//   recruiter: "No recruiter" (switch off, as always) / "2 recruiter links" / "1 recruiter link" (switch on, firms named) / "Recruiter involved" (switch on, no firm named)
// The words state what the employer disclosed. They never say that anything was checked.

export const TOOLTIP_OFFICIAL = "The employer says these are the only places to apply for this opening. FightGhostJobs does not check that.";
export const TOOLTIP_EMPLOYER = "Links the employer provided to apply for this opening. The employer has not said these are the only places to apply.";
export const MAX_APPLY_LINKS = 10;    // the most application links an opening can have (the same cap the details answer is checked against in js/api.js)
export const MAX_RECRUITER_FIRMS = 3; // the most named recruiter firms

const count = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;

// { apply, firms, exclusive } when the row carries the three values and they are well formed, else null (an answer from before the database change, or a broken one)
export function linkCounts(row) {
  if (!row || typeof row !== "object") return null;
  if (!count(row.apply_link_count, MAX_APPLY_LINKS) || !count(row.recruiter_firm_count, MAX_RECRUITER_FIRMS) || typeof row.destination_links_exclusive !== "boolean") return null;
  return { apply: row.apply_link_count, firms: row.recruiter_firm_count, exclusive: row.destination_links_exclusive };
}

// the application links pill: a chip spec { text, tooltip? }, or null when the row has no counts
export function applicationLinksChip(row) {
  const c = linkCounts(row);
  if (c === null) return null;
  if (c.apply === 0) return { text: "No employer links" };
  if (c.exclusive) return { text: c.apply + (c.apply === 1 ? " official link" : " official links"), tooltip: TOOLTIP_OFFICIAL };
  return { text: c.apply + (c.apply === 1 ? " employer link" : " employer links"), tooltip: TOOLTIP_EMPLOYER };
}

// the recruiter pill: the switch decides whether a recruiter is involved, the count only says how many firms the employer named. No tooltip (it has none today).
export function recruiterChip(row) {
  if (!row || row.third_party_recruiter !== true) return { text: "No recruiter" };
  const c = linkCounts(row);
  if (c !== null && c.firms > 0) return { text: c.firms + (c.firms === 1 ? " recruiter link" : " recruiter links") };
  return { text: "Recruiter involved" };
}

// The counts of an opening as its DETAILS answer lists them (the comments page has that answer, not a search row): the same three values, taken from the listed links.
// A link without a kind is an application link (older answers). The policy link is not counted. Returns {} when the answer has no list.
export function countsFromDetail(answer) {
  if (!answer || typeof answer !== "object" || !Array.isArray(answer.links)) return {};
  const kinds = answer.links.map((l) => (l && typeof l === "object" ? l.kind || "apply" : ""));
  return {
    apply_link_count: kinds.filter((k) => k === "apply").length,
    recruiter_firm_count: kinds.filter((k) => k === "recruiter").length,
    destination_links_exclusive: !!(answer.posting && answer.posting.destination_links_exclusive === true),
  };
}
