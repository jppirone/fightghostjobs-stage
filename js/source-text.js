// source-text.js - the words of the optional "where you found this job" field (prompt JD, November 7, 2026), in one small file with no imports. John approved this wording on November 7, 2026. The 13 pinned sentences of js/phone-text.js are not touched.
// The sentences state facts only: the field is optional, employers see the value exactly as typed, we do not check it, and the person should not type their own email address.

export const SOURCE_LABEL = "Where you found this job";
export const SOURCE_OPTIONAL = "Optional";
export const SOURCE_INSTRUCTION = "Site (ex. LinkedIn.com or LinkedIn) or email (ex. jobs@linkedin.com)";   // prompt JK (John, November 7, 2026): the short line replaces the long one approved in prompt JH
export const SOURCE_EMPLOYERS_SEE = "Employers see this exactly as you type it.";
// shown in the phone entry panel, under the privacy sentence, only when the phone entry has run
export const SOURCE_PHONE_SENTENCE = "Where you found the job is optional. Employers see it exactly as you type it, we do not check it, and you should not type your own email address.";
