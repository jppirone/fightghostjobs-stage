// phone-text.js - every sentence of the phone entry, in one small file with no imports (prompt IB, November 3, 2026). The page chooses which sentence to show; nothing from the screenshot text is ever put in a sentence.
// The 13 sentences are John's words from section 5 of report HX, letter for letter. tests/phone-entry.unit.test.js and rule S103 of tests/site-check.js pin them: do not reword one here without the owner.
// Sentence 6 is a line with a button in it: the last three words are the button (MORE_BEFORE + MORE_BUTTON + MORE_AFTER is the whole sentence).

export const MORE_BEFORE = "Not the one you meant? ", MORE_BUTTON = "Pick another opening", MORE_AFTER = ".";

export const SENTENCES = {
  1: "Read from your screenshot. Check the boxes, then press Search.",
  2: "This looks cut off. Check it.",
  3: "Found in the title, not labelled. Check it.",
  4: "A word in the title looks broken. Type the title.",
  5: "Not found. Type it if the opening shows it.",
  6: MORE_BEFORE + MORE_BUTTON + MORE_AFTER,
  7: "Other openings on your screen:",
  8: "You picked this opening. Check the boxes.",
  9: "We could not find an opening in the screenshot. Type the company and the job title, the req number or the KIO ID.",
  10: "We could not read the text from your screenshot. Type the company and the job title, the req number or the KIO ID.",
  11: "Only the first part of the screenshot text was used.",
  12: "This page is for phones. On a computer, use the browser extension.",
  13: "We never receive your screenshot. Your phone reads the text and this page keeps it in the page only. Nothing is sent until you press Search. Then only the values in the boxes are sent, and the search is recorded like any other.",
};

// prompt JE (November 8, 2026): the note inside the search box when the reader had to guess which line is the job title and which is the company (the reader's flag orderAssumed). It is NOT one of the 13 sentences above (they stay letter for letter);
// John chose this sentence on November 8, 2026 (prompt JN; it replaces the longer starting sentence of November 7, 2026). "Search" is the label of the Search button. Shown above the optional line and Search, cleared when the person edits the company box or the title box.
export const ORDER_NOTE = "Check that the company and the job title are correct, then click Search.";

// the words of the one link that may follow sentence 12 (only when EXTENSION_PAGE_URL in js/config.js is an address on this site)
export const EXTENSION_LINK_TEXT = "Get the browser extension";
// one entry of the list of other openings: "Title at Company"
export const choiceText = (title, company) => title + " at " + company;
