// about-text.js - the two explanation paragraphs that used to sit in the body of the details window (prompt LM, October 23, 2026). They now sit behind small "i" icons: the first behind the icon beside the
// Registered label (and, for an opening that is not Registered, beside the KIO ID line), the second behind the icon beside the "Links" heading. THE WORDS ARE MOVED, NOT REWRITTEN: both are exactly the text
// they were in the code before (search.js for the first, search.html for the second); tests/lm-cleanup.unit.test.js compares each one, byte for byte, with the text of the commit before this prompt.
// Pure (no DOM): the second paragraph is kept in three parts because one phrase of it is bold ("Report a wrong link").

export const ABOUT_TITLE = "About this information";
export const ABOUT_TEXT = "This opening was added through FightGhostJobs by the employer. The dates and disclosures are the employer's own. FightGhostJobs has not confirmed that the job exists, that the employer representative works for the company named, or that the employer will respond.";

export const LINKS_ABOUT_TITLE = "About these links";
export const LINKS_ABOUT_BEFORE = "These links look unusual on purpose: each one is a one-time link through FightGhostJobs, so it can be tracked and protected from scraping. Each goes wherever the employer told us to send you; the name on it says where it starts (a job board, an application system, the employer's own site) or that we could not check it. If a link does not lead to this job's own page or application, tell us with ";
export const LINKS_ABOUT_BOLD = "Report a wrong link";
export const LINKS_ABOUT_AFTER = " below (a person reads every report), and tell other candidates in the comments.";
// the same paragraph as the HTML it was (the bold phrase in a strong element), for the test that compares it with the old markup
export const LINKS_ABOUT_HTML = LINKS_ABOUT_BEFORE + "<strong>" + LINKS_ABOUT_BOLD + "</strong>" + LINKS_ABOUT_AFTER;

// the heading above the link rows, and the names of the icons (what a screen reader says)
export const LINKS_HEADING = "Links";
export const ABOUT_ICON_LABEL = "About this information";
export const LINKS_ICON_LABEL = "About these links";
