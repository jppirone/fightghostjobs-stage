// schedule-form.js - the scheduled go-live control (register form and edit page): what the employer types, the checks made before it is sent, and what a refusal means. Pure (no DOM): tested in Node.
// The backend (schedule-posting) is the authority and refuses anything wrong; these checks only spare a round trip and say the same things the backend says.
// Rules held by the backend: only a DRAFT can carry a go-live time; the time must be at least 1 hour from now and at most 90 days after the draft was CREATED; the posting is published by the 15-minute scheduler, so it
// goes live between 0 and 15 minutes after the chosen time and its window is counted from the moment it actually goes live; a scheduled draft is exempt from the 14-day draft-age cap; removing the schedule reinstates the cap.

export const MIN_LEAD_MS = 3600000, MAX_DAYS = 90, SLACK_MS = 120000, DAY_MS = 86400000;

// the approved copy: shown under the control on the register form and on the edit page, word for word (tests/site-check.js S21)
export const GO_LIVE_HINT = "Choose a time between 1 hour and 90 days from now. Your posting goes live within 15 minutes after that time, and its closing date is counted from the moment it actually goes live, not from now. Until then it is a scheduled draft that candidates cannot see; you can change the time, remove it or publish it now from My postings.";

// text: the value of <input type="datetime-local"> ("2026-10-05T14:00": the browser's own time zone). createdMs: when the draft was saved (omit for a posting that is being registered right now).
// -> { ok: true, iso } (a UTC instant, the form the backend takes) | { ok: false, error }
export function checkGoLive(text, nowMs, createdMs) {
  const t = String(text == null ? "" : text).trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(t)) return { ok: false, error: "Choose a date and time." };
  const ms = new Date(t).getTime();
  if (!Number.isFinite(ms)) return { ok: false, error: "That is not a real date and time." };
  if (ms < nowMs + MIN_LEAD_MS + SLACK_MS) return { ok: false, error: "Choose a time at least 1 hour from now. For sooner, publish the posting instead." };
  const base = typeof createdMs === "number" && Number.isFinite(createdMs) ? createdMs : nowMs;
  if (ms > base + MAX_DAYS * DAY_MS - SLACK_MS) return { ok: false, error: typeof createdMs === "number" ? "Choose a time no more than 90 days after this draft was saved." : "Choose a time no more than 90 days from now." };
  return { ok: true, iso: new Date(ms).toISOString() };
}

// an instant -> the value <input type="datetime-local"> takes, in the browser's own time zone ("" when it is not a date)
export function toLocalInput(iso) {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
}

// A refusal from schedule-posting -> the words to show. `where`: "gldate" when it is about the time itself.
export function mapScheduleError(err) {
  if (!err) return { where: null, message: "Something went wrong." };
  if (err.code === "go_live_too_soon") return { where: "gldate", message: "That time is less than an hour away. Choose a later time, or publish the posting instead." };
  if (err.code === "go_live_too_late") return { where: "gldate", message: "That time is more than 90 days after this draft was saved. Choose an earlier time." };
  if (err.field === "status") return { where: null, message: "This posting is not a draft any more, so it cannot be scheduled." };
  if (err.field === "go_live_at") return { where: "gldate", message: err.message || "That time was not accepted." };
  return { where: null, message: null };
}
