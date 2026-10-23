// tile-actions.js - what the buttons at the bottom of an opening tile are (prompt LM, October 23, 2026). Pure (no DOM): tested in Node.
// THE PRINCIPLE: everything that fits goes on the tile; the details window exists only for what cannot, the link rows (each is a one-time link made when the window opens) and the named recruiter firms.
// The counts are the ones the link pills use (js/link-pills.js linkCounts: one source), so the button and the pills can never disagree.
//   the opening has application links or named recruiter firms  -> mode "links": the main button "View links" opens the details window, and a small text link "Comments (n)" opens the comments page directly
//   it has neither                                              -> mode "comments": there is no details window and no empty one to reach; the main button slot holds "Comments (n)" (a link to the comments page)
//   the row carries no counts (an answer from before the database change) -> mode "legacy": the button is what it always was, "View opening details", and nothing else changes
// "(n)" is the number of visible comments when the row carries it (comment_count); a row without it says "Comments" and no number, never a guess. The comments page is the SAME page the details window links to
// (comments.html?ref=...): same thread, same Report and contest options, same rules. Nothing here ever holds a link address or a one-time link.
import { linkCounts } from "./link-pills.js?v=89324475";

export const VIEW_LINKS = "View links";
export const LEGACY_DETAILS = "View opening details";
export const MAX_COMMENT_COUNT = 1000000;

export const commentCountOf = (row) => (row && Number.isInteger(row.comment_count) && row.comment_count >= 0 && row.comment_count <= MAX_COMMENT_COUNT ? row.comment_count : null);
export function commentsText(row) { const n = commentCountOf(row); return n === null ? "Comments" : "Comments (" + n + ")"; }
export const commentsHref = (row) => "comments.html?ref=" + encodeURIComponent(row.posting_ref);

// -> { mode: "legacy" | "links" | "comments", main: string | null, comments: { text, href } | null }
export function tileActions(row, commentsVisible) {
  const c = linkCounts(row);
  if (c === null) return { mode: "legacy", main: LEGACY_DETAILS, comments: null };
  const comments = commentsVisible ? { text: commentsText(row), href: commentsHref(row) } : null;
  if (c.apply > 0 || c.firms > 0) return { mode: "links", main: VIEW_LINKS, comments };
  return { mode: "comments", main: null, comments };
}
