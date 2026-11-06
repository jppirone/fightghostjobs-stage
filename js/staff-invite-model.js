// staff-invite-model.js - the pure logic of the staff page "Companies to invite" (staff-invite.html, prompt IV, November 6, 2026). No DOM, no network: tested in Node by tests/staff-invite.unit.test.js.
// WHAT THE PAGE IS: for a signed-in STAFF person only, the companies that people searched for and the system does not know (so staff know whom to invite), with the typed titles per company. The page asks the database two
// things with the person's own sign-in token: public.is_staff(), then public.staff_invite_list or public.staff_invite_list_titles. The database decides who is staff; this file and the page never do.
// Staff see every company's total, with no minimum of 5 (decision of October 29, 2026, staff views only). The company box needs the whole name: the database matches the whole company name (any letter case), not a part.

export const MAX_MONTHS = 36;          // the database refuses a range over 36 whole months (error FG400)
export const MAX_MIN_SEARCHES = 100000;

export const HEADING = "Companies to invite";
export const LEAD = "Companies that people searched for and the system does not know. Counts are exact except where a row says \"at least\".";
export const COMPANY_NOTE = "Type the company's name. The box matches the whole name, not part of it. Leave it empty to see every company.";
export const PEOPLE_NOTE = "\"At least\" means the count of different people could be higher: it is the largest single month figure for an earlier month.";
export const EMPTY_TEXT = "No searches for companies outside the system in this date range.";
export const TITLES_EMPTY_TEXT = "No titles to show for this company in this date range.";
export const SIGNED_OUT_TEXT = "Sign in to see this page. Sign in on the search page, then open this address again.";
export const NOT_AVAILABLE_TEXT = "This page is not available.";
export const CHECK_FAILED_TEXT = "Could not check your sign-in. Reload the page to try again.";
export const LOAD_FAILED_TEXT = "Could not load the list. Try again in a moment.";
export const TITLES_FAILED_TEXT = "Could not load the titles. Try again in a moment.";
export const RANGE_REFUSED_TEXT = "That date range is not accepted. Use dates where From is not after To and the range is at most 36 months.";
export const SESSION_ENDED_TEXT = "Your sign-in has ended. Sign in on the search page, then open this address again.";

const pad = (n) => String(n).padStart(2, "0");
export const isoDay = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

// the default window: the last 3 full calendar months, through the current date (today, in the person's own calendar)
export function defaultRange(now) {
  const d = now instanceof Date ? now : new Date();
  return { from: isoDay(new Date(d.getFullYear(), d.getMonth() - 3, 1)), to: isoDay(d) };
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function parseDay(s) {
  const m = DAY_RE.exec(String(s == null ? "" : s).trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], da = +m[3], d = new Date(y, mo - 1, da);
  return d.getFullYear() === y && d.getMonth() === mo - 1 && d.getDate() === da && y >= 2000 && y <= 2100 ? { y, mo, da } : null;
}

// -> { ok, errors: { from?, to?, min?, company? }, args?: { p_from, p_to, p_company, p_min_searches } }
export function checkInputs({ from, to, min, company }) {
  const errors = {}, f = parseDay(from), t = parseDay(to);
  if (!f) errors.from = "Enter the From date."; if (!t) errors.to = "Enter the To date.";
  if (f && t) {
    if ((f.y * 12 + f.mo) > (t.y * 12 + t.mo) || (f.y * 12 + f.mo === t.y * 12 + t.mo && f.da > t.da)) errors.to = "The To date cannot be before the From date.";
    else if ((t.y * 12 + t.mo) - (f.y * 12 + f.mo) > MAX_MONTHS - 1) errors.to = "Use a range of at most 36 months.";
  }
  const minText = String(min == null ? "" : min).trim();
  let m = 1;
  if (minText !== "") {
    if (!/^\d{1,6}$/.test(minText) || +minText < 1 || +minText > MAX_MIN_SEARCHES) errors.min = "Enter a whole number from 1 to " + MAX_MIN_SEARCHES + ".";
    else m = +minText;
  }
  const c = String(company == null ? "" : company).trim();
  if (c.length > 200) errors.company = "Keep the company name to 200 characters or fewer.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, errors, args: { p_from: String(from).trim(), p_to: String(to).trim(), p_company: c === "" ? null : c, p_min_searches: m } };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2026-08-01" -> "Aug 2026"; anything else is shown as it came (never an error)
export function monthLabel(iso) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(iso == null ? "" : iso));
  return m && +m[2] >= 1 && +m[2] <= 12 ? MONTHS[+m[2] - 1] + " " + m[1] : String(iso == null ? "" : iso);
}

// different people: a plain number when exact, "at least N" when the database says the figure may be low (people_exact false)
export const peopleText = (row) => (row.people_exact === false ? "at least " + row.different_people : String(row.different_people));
// the status as the database returned it; a company the system has no record of has none, and says so in two plain words
export const statusText = (row) => (typeof row.status === "string" && row.status !== "" ? row.status : "No match");

// the sort the person chose: "most" (default) or "fewest" by searches, ties by company key so the order never jumps; returns a new array
export function sortRows(rows, dir) {
  const sign = dir === "fewest" ? 1 : -1;
  return rows.slice().sort((a, b) => sign * (a.searches - b.searches) || (a.company_key < b.company_key ? -1 : a.company_key > b.company_key ? 1 : 0));
}

export const countText = (n) => (n === 1 ? "1 company" : n + " companies");

// the words for a failed call. Never the database's own text. { code, status } from js/api.js (rpc): 400 is a refused range, 401/403/404 means the sign-in no longer counts, everything else is a plain failure.
export function failureKind(r) {
  if (!r || r.ok) return null;
  const s = r.status;
  if (s === 400) return "range";
  if (s === 401 || s === 403 || s === 404 || (r.error && r.error.code === "no_session")) return "session";
  return "failed";
}
