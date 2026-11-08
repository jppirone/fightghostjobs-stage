// info-panel.js - the box behind the "i" of the search page (prompt JB, November 7, 2026). It REUSES the box of prompt LM (js/info-box.js: the round "i", the window frame, the focus loop, Escape, the scroll lock) and adds only the
// contents: the sentences that used to sit on the search screen. THE WORDS ARE MOVED, NOT REWRITTEN. The sentences that belong to a box of the form stay in the page in the hidden element #infoSource (so a screen reader still reads them as
// the description of that box: a hidden element named by aria-describedby is read) and are copied from there each time the box opens; the rest of a "nothing found" note comes from js/search-input.js (the page shows its first
// sentence, this box shows the remainder); the two phone sentences are read from their own hidden elements once the phone entry has run (data-on="1"). Everything is built from text and copied nodes, never from HTML strings.
import { h } from "./dom.js?v=5c78a8cd";
import { infoBoxIcon } from "./info-box.js?v=2f309155";
import { NO_MATCH_SPLIT, NO_MATCH_REQ_SPLIT, MISS_MESSAGES, splitSentences } from "./search-input.js?v=96255d82";

export const INFO_TITLE = "About this search";
export const INFO_ICON_LABEL = "About this search page";
export const INFO_SECTIONS = Object.freeze({ how: "How to search", nothing: "When nothing is found", privacy: "Your privacy" });

// a paragraph made of copies of the child nodes of a hidden source element (links included); null when the element is not there
function copyOf(doc, id) {
  const el = doc.getElementById(id);
  if (!el) return null;
  return h("p", { class: "info-para" }, ...Array.from(el.childNodes).map((n) => n.cloneNode(true)));
}
const para = (text) => h("p", { class: "info-para" }, text);

// the nodes of the box, for this moment of the page
export function infoNodes(doc = document) {
  const how = [copyOf(doc, "guideKio"), copyOf(doc, "guideTitle"), copyOf(doc, "companyHintFull"), copyOf(doc, "reqHint"), copyOf(doc, "titleNote")].filter(Boolean);
  const nothing = [NO_MATCH_SPLIT().rest, splitSentences(MISS_MESSAGES.registered_no_match[1], 1).rest, NO_MATCH_REQ_SPLIT().rest].filter((t) => t !== "").map(para);
  const notice = doc.getElementById("searchNotice");
  const privacy = [];
  if (notice && notice.dataset.off !== "1") privacy.push(copyOf(doc, "searchNotice"));
  if (notice && notice.dataset.off !== "1") privacy.push(copyOf(doc, "sourceNote"));   // prompt JK (November 7, 2026): "Employers see this exactly as you type it." left the form and sits here, word for word (the staff search sends no source, so it is left out there like the record notice)
  privacy.push(copyOf(doc, "signinFull"));
  for (const id of ["phonePrivacy", "phoneSource"]) { const el = doc.getElementById(id); if (el && el.dataset.on === "1" && el.textContent) privacy.push(para(el.textContent)); }
  const section = (title, items) => items.length ? [h("h3", { class: "info-section" }, title), ...items] : [];
  return [...section(INFO_SECTIONS.how, how), ...section(INFO_SECTIONS.nothing, nothing), ...section(INFO_SECTIONS.privacy, privacy.filter(Boolean))];
}

// the "i" (one at the heading and one in the recap: both open this same box)
export const infoPanelIcon = () => infoBoxIcon({ label: INFO_ICON_LABEL, title: INFO_TITLE, body: () => infoNodes(document) });
