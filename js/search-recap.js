// search-recap.js - the sentence of the search recap (October 5, 2026; Part C). After a search has actually run (it found postings, or found none) the three boxes are emptied and a read-only recap sits between the form and the results:
//   "You searched for: company X, title Y. Your results are below."
// A req number and a postID are NEVER shown in clear. The recap says only that one was entered; the kind is the one the page already works out for the search (js/search-input.js, resolveSearch): "req", "code" or "phrase".
// A plain title or the company name may be shown (the person typed them as words). One more case is kept private on purpose: a phrase of exactly twelve plain letters (resolveSearch marks it alsoTryCode) could be a postID that happens
// to have no digit, so it is described as "a postID was entered" and not printed.
//   recapSentence(company, search) -> the sentence       search: { kind: "req"|"code"|"phrase", value, alsoTryCode? }
export const RECAP = {
  LEAD: "You searched for: company ",
  TAIL: " Your results are below.",
  REQ: "a req number was entered",
  CODE: "an Opening ID was entered",
  KIO: "Opening ID ",              // prompt BS (October 12, 2026): a KIO ID is public by design, so the recap shows it, in the shown form (KIO-XXXX-XXXX-XXXX) however it was typed
};

const oneLine = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();

export function recapSentence(company, search) {
  // prompt BS: a KIO ID is shown (search.shown is its normalised shown form, the same one the results use); an old 12 character code, twelve plain letters and a req number are still never printed
  const what = search.kind === "req" ? RECAP.REQ : search.kind === "kio" && typeof search.shown === "string" && search.shown !== "" ? RECAP.KIO + search.shown : search.kind === "code" || search.kind === "kio" || search.alsoTryCode ? RECAP.CODE : "title " + oneLine(search.value);
  // prompt BQ: a lookup by the ID alone has no company to name
  const lead = search.kind === "kio" && oneLine(company) === "" ? "You searched for: " : RECAP.LEAD + oneLine(company) + ", ";
  return lead + what + "." + RECAP.TAIL;
}
