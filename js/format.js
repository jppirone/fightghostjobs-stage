// format.js - pure display helpers (no DOM, no network): tested in Node by tests/unit.test.js.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Sep 2" in the viewer's own time zone (tz = "UTC" is accepted so tests are deterministic).
export function fmtDate(iso, tz) {
  if (typeof iso !== "string") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (tz === "UTC") return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate();
  return MONTHS[d.getMonth()] + " " + d.getDate();
}

// "Sep 18, 2026 · 4:12 PM" (comments)
export function fmtStamp(iso, tz) {
  if (typeof iso !== "string") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const utc = tz === "UTC";
  const y = utc ? d.getUTCFullYear() : d.getFullYear(), mo = utc ? d.getUTCMonth() : d.getMonth(), da = utc ? d.getUTCDate() : d.getDate();
  let hr = utc ? d.getUTCHours() : d.getHours(); const mi = utc ? d.getUTCMinutes() : d.getMinutes();
  const ap = hr >= 12 ? "PM" : "AM"; hr = hr % 12; if (hr === 0) hr = 12;
  return MONTHS[mo] + " " + da + ", " + y + " · " + hr + ":" + String(mi).padStart(2, "0") + " " + ap;
}

// The short name of the time zone a date is being read in ("EDT", "EST", "GMT+1"). It is the zone of the moment shown, so it can differ between two dates of one posting
// (daylight-saving change). tz = "UTC" is accepted so tests are deterministic.
export function tzLabel(iso, tz) {
  if (typeof iso !== "string") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (tz === "UTC") return "UTC";
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(d).find((x) => x.type === "timeZoneName");
    return part ? part.value : "";
  } catch { return ""; }
}

// "Sep 20 (EDT)": a date together with the zone it is read in, so the same moment is not read as two different days by two people.
export function fmtDateTz(iso, tz) {
  const s = fmtDate(iso, tz), z = tzLabel(iso, tz);
  return s === "" ? "" : z === "" ? s : s + " (" + z + ")";
}

// "Nov 4, 9:08 PM EST": the exact moment, in the viewer's zone. Used for the close date, which is an instant (45 x 24 hours after go-live), not a calendar day.
export function fmtClose(iso, tz) {
  if (typeof iso !== "string") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const utc = tz === "UTC";
  let hr = utc ? d.getUTCHours() : d.getHours(); const mi = utc ? d.getUTCMinutes() : d.getMinutes();
  const ap = hr >= 12 ? "PM" : "AM"; hr = hr % 12; if (hr === 0) hr = 12;
  const z = tzLabel(iso, tz);
  return fmtDate(iso, tz) + ", " + hr + ":" + String(mi).padStart(2, "0") + " " + ap + (z === "" ? "" : " " + z);
}

// The employer sees their own full postID (the 12-character code), grouped for reading: XXXX-XXXX-XXXX
export function groupCode(code) {
  return typeof code === "string" && /^[0-9A-Z]{12}$/.test(code) ? code.slice(0, 4) + "-" + code.slice(4, 8) + "-" + code.slice(8) : String(code || "");
}

// "Remote", "Tampa, FL", "Remote · Tampa, FL"
export function locationLine(isRemote, locations) {
  const parts = [];
  if (isRemote === true) parts.push("Remote");
  if (Array.isArray(locations)) for (const l of locations) if (typeof l === "string" && l.trim() !== "") parts.push(l.trim());
  return parts.length ? parts.join(" · ") : "Location not stated";
}

export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

// Seconds -> "45 seconds" / "3 minutes"
export function waitText(seconds) {
  const s = Math.max(1, Math.round(Number(seconds) || 1));
  return s < 90 ? plural(s, "second", "seconds") : plural(Math.ceil(s / 60), "minute", "minutes");
}
