// search-origin.js - where a search came from, in one small place with no imports (prompts HM and IA). The search page reads the key o of its address (js/fragment-prefill.js) and sends the origin with the search; the saved search of the
// sign in hand-off (js/signin-handoff.js) carries it across the emailed link and reads it back through requestOrigin, so a saved origin is checked again the same way. It is a small file on purpose: js/session.js loads the hand-off on
// every page, and the hand-off must not pull in the whole address reader to check an origin.
//   o=e  the browser extension, with the host of the job page in h (cleaned below)      o=m  the phone entry: mobile, NEVER a host (an h that comes with it is ignored)      anything else: the site
// Both are only a tag the sender claims. Nothing here reads a page, stores anything or sends anything.

// prompt HM: the host (h) is cleaned the way the database cleans it: lower case, no scheme, path, query, fragment, user@, port, www. or trailing dots, and kept only when it is a plain host of at most 253 characters.
// A search that did not come from the extension never carries a host.
export function cleanHost(raw) {
  let t = String(raw == null ? "" : raw).trim().toLowerCase();
  t = t.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/[/?#].*$/, "").replace(/^[^@]*@/, "").replace(/:[0-9]*$/, "").replace(/\.+$/, "").replace(/^www\./, "");
  return t.length >= 1 && t.length <= 253 && /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(t) ? t : null;
}
export function originOf(o, h) {
  if (o === "e") return { origin: "extension", host: h == null ? null : cleanHost(h) };
  if (o === "m") return { origin: "mobile", host: null };   // the phone entry has no host, whatever h says
  return { origin: "site", host: null };
}
// the request fields for a read origin { origin, host }: site with nothing else, extension with its cleaned host (when there is a plain one), mobile with nothing else; anything else, or a damaged value, is the site
export function requestOrigin(o) {
  if (!o || typeof o !== "object") return { origin: "site" };
  if (o.origin === "extension") { const host = typeof o.host === "string" ? cleanHost(o.host) : null; return host ? { origin: "extension", origin_host: host } : { origin: "extension" }; }
  if (o.origin === "mobile") return { origin: "mobile" };
  return { origin: "site" };
}
