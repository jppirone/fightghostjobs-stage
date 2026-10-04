// dirty-state.js - what the "Edit a posting" page counts as NOT SAVED YET, and what it says about it. Pure (no DOM): tested in Node (tests/unsaved.test.js).
// Two kinds of unsaved work live on that page:
//   * the main form, saved by Save changes (title, req number, locations, remote, description, the AI answers and notes, the recruiter toggle, req searchable, the exclusive toggle, the applicant cap);
//   * the sections that save through their OWN buttons (destination links, recruiter firms, the go-live time): Save changes does NOT save those, and the page says so.
// The main form is compared with a snapshot taken when the posting was last loaded or saved. The snapshot is built the way the save builds what it sends (values trimmed, an AI note counted only while its
// toggle is on, "one opening" counted only with two or more places), so a change followed by a revert to the same value is not a change, and neither is whitespace around a value.
// The change note is not part of the snapshot: a note with nothing changed is not saveable ("Nothing has changed.").

const trim = (t) => String(t == null ? "" : t).trim();
// the description as the browser hands it back: a text box reports line breaks as \n, whatever the stored text used
const lines = (t) => trim(String(t == null ? "" : t).replace(/\r\n?/g, "\n"));
// the applicant cap as the save reads it: digits compare as numbers ("007" is 7); anything else (a typo in progress) stays as typed, so it still counts as a change
export const capKey = (t) => { const s = trim(t); return /^[0-9]+$/.test(s) ? String(Number(s)) : s; };

// v: what the page collects ({ title, req, desc, locEntries, attested, remote, appcap, aiFilter, aiInterview, aiFilterNote, aiInterviewNote, recruiter, reqSearchable, exclusive }); -> a string that is equal for equal saves
export function snapshotOf(v) {
  const ids = (Array.isArray(v.locEntries) ? v.locEntries : []).map((e) => e.id);
  const tri = (x) => (x === true || x === false ? x : null);       // an AI answer never stated stays "not stated"
  return JSON.stringify({
    title: trim(v.title), req: trim(v.req), desc: lines(v.desc), loc: ids, remote: v.remote === true, attested: ids.length >= 2 && v.attested === true, appcap: capKey(v.appcap),
    aiFilter: tri(v.aiFilter), aiInterview: tri(v.aiInterview),
    aiFilterNote: v.aiFilter === true ? (trim(v.aiFilterNote) || null) : null, aiInterviewNote: v.aiInterview === true ? (trim(v.aiInterviewNote) || null) : null,
    recruiter: v.recruiter === true, reqSearchable: v.reqSearchable !== false, exclusive: typeof v.exclusive === "boolean" ? v.exclusive : null,
  });
}
// what the page puts in the form for a posting (the same values populate() uses): lets a test, or a caller without a form, build the snapshot straight from the posting.
// entries: the catalog entries for p.location_ids (only the ids are compared); planActive: whether the exclusive toggle is offered
export function valuesFromPosting(p, { planActive = false } = {}) {
  return { title: p.title, req: p.req_number || "", desc: p.description_text, locEntries: (p.location_ids || []).map((id) => ({ id })), attested: p.locations_attested === true, remote: p.is_remote === true,
    appcap: p.applicant_cap === null || p.applicant_cap === undefined ? "" : String(p.applicant_cap), aiFilter: p.ai_filtering, aiInterview: p.ai_interview_other,
    aiFilterNote: p.ai_filtering_note || "", aiInterviewNote: p.ai_interview_note || "", recruiter: p.third_party_recruiter === true, reqSearchable: p.req_searchable !== false,
    exclusive: planActive ? p.destination_links_exclusive === true : undefined };
}
export const formDirty = (baseline, v) => baseline !== null && baseline !== undefined && snapshotOf(v) !== baseline;

// rows: what link-rows.js values() returns ([{ url, label }] or [{ name, url }]): true when any box holds something other than blanks
export const rowsTyped = (rows) => (Array.isArray(rows) ? rows : []).some((r) => r && Object.values(r).some((x) => trim(x) !== ""));

// ---- the rules that used to be found only on Save, shown as soon as they apply
// orig: the loaded posting; v: the collected values; dirty: whether the main form has unsaved changes -> { noteRequired, noteMissing, titleRule }
//   noteRequired: a posting that is live or paused needs a change note for every edit (a draft does not); noteMissing: and it is still empty
//   titleRule: the title was changed on a live or paused posting, so the server's rule (a new title keeps at least 60% of the wording of the current one) applies
export function earlyRules(orig, v, dirty) {
  const notDraft = !!orig && orig.stored_status !== "draft";
  return { noteRequired: dirty && notDraft, noteMissing: dirty && notDraft && trim(v.note) === "", titleRule: notDraft && trim(v.title) !== trim(orig.title) };
}

// ---- the words (owner review: listed in the report)
export const UNSAVED = {
  HEAD: "You have unsaved changes",
  FORM_DETAIL: "They take effect only when you press Save changes.",
  SAVE: "Save changes", DISCARD: "Discard",
  CONFIRM_DISCARD: "Discard your unsaved changes? The saved values will be put back.",
  DISCARDED: "Your unsaved changes were discarded. The saved values are back.",
  noteRequired: (status) => "This posting is " + status + ", so a change to it needs a note. Say what changed and why.",
  noteAdd: (status) => "This posting is " + status + ", so add a note saying what changed and why.",
  titleRule: (status) => "On a " + status + " posting, a new title must keep at least 60% of the wording of the current one. A bigger change needs a new posting.",
  // the leave prompt
  LEAVE_SAVE_AND_LEAVE: "Save and leave", LEAVE_SAVE: "Save changes", LEAVE_DISCARD: "Discard and leave", LEAVE_STAY: "Stay on this page",
};
// the sections that save through their own button
export const PANEL = { LINKS: "destination links", FIRMS: "recruiter firms", GOLIVE: "go-live time" };
const ORDER = [PANEL.LINKS, PANEL.FIRMS, PANEL.GOLIVE];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const joinNames = (names) => names.length <= 1 ? (names[0] || "") : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];

// m: { form: bool, panels: [names], status: "live" | "paused" | "draft", noteMissing: bool, noteRequired: bool }
// -> { any, showSave, headline, detail, liveText, dialogTitle, dialogText, leaveCanSave, leaveSaveLabel, panelNames }
//   headline / detail: what the bar shows (detail changes as the note is typed); liveText: what a screen reader is told (it does not change while the note is typed, so it is not repeated);
//   showSave: the bar offers Save changes only when the main form has something to save: the sections below save through their own buttons
export function summarize(m) {
  const panels = ORDER.filter((n) => Array.isArray(m.panels) && m.panels.includes(n));
  const form = m.form === true, any = form || panels.length > 0, n = panels.length;
  const out = { any, showSave: form, headline: "", detail: "", liveText: "", dialogTitle: "", dialogText: "", leaveCanSave: form, leaveSaveLabel: form && n === 0 ? UNSAVED.LEAVE_SAVE_AND_LEAVE : UNSAVED.LEAVE_SAVE, panelNames: panels };
  if (!any) return out;
  const named = joinNames(panels), status = m.status || "live";
  const itThem = n === 1 ? "it" : "them", section = n === 1 ? "that section" : "each section";
  const panelsLine = cap(named) + " not saved yet. Save changes does not save " + itThem + ": use the button in " + section + ".";
  if (form) {
    out.headline = UNSAVED.HEAD;
    out.detail = [n ? panelsLine : UNSAVED.FORM_DETAIL, m.noteMissing ? UNSAVED.noteAdd(status) : ""].filter(Boolean).join(" ");
    out.liveText = [UNSAVED.HEAD + ".", n ? panelsLine : UNSAVED.FORM_DETAIL, m.noteRequired ? UNSAVED.noteRequired(status) : ""].filter(Boolean).join(" ");
    out.dialogTitle = UNSAVED.HEAD;
    out.dialogText = n ? "If you leave this page now, your changes to this posting and what you typed in the " + named + (n === 1 ? " section" : " sections") + " are lost. Save changes saves the posting only."
      : "If you leave this page now, your changes to this posting are lost.";
  } else {
    out.headline = cap(named) + " not saved yet";
    out.detail = "Save changes does not save " + itThem + ". Use the button in " + section + ", or press Discard.";
    out.liveText = out.headline + ". " + out.detail;
    out.dialogTitle = out.headline;
    out.dialogText = "If you leave this page now, what you typed in the " + named + (n === 1 ? " section" : " sections") + " is lost. " + (n === 1 ? "It is" : "They are") + " saved with " + (n === 1 ? "its own button" : "their own buttons") + ", not with Save changes.";
  }
  return out;
}

// does a click on a link take the person off this page? ev: the click event's flags; info: { href, target, download } of the link
export function linkLeaves(ev, info) {
  if (!ev || ev.defaultPrevented) return false;
  if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return false;            // a new tab or window, or a download: this page stays
  if (ev.button !== undefined && ev.button !== null && ev.button !== 0) return false;
  const href = trim(info && info.href), target = trim(info && info.target).toLowerCase();
  if (href === "" || href.startsWith("#")) return false;                                // the skip link and in-page anchors
  if (/^(mailto|tel|sms|javascript):/i.test(href)) return false;
  if (target !== "" && target !== "_self") return false;
  if (info && info.download) return false;
  return true;
}
