// header-order.js - the Tab order of the top bar follows what is drawn (October 5, 2026; John's keyboard-only pass on stage, October 4, 2026).
// Why: the stylesheet moves the three parts of the bar around with CSS "order" (app.css: at 1080 pixels and below the links drop to the last row; at 640 and below the initials circle and Sign out come
// right after the logo and My postings, Analytics and Team move to a row of their own). CSS "order" changes what is DRAWN, not the order a keyboard visits things, so Tab went logo, the bottom links, the
// middle buttons, and only then the initials circle and Sign out. The look is not touched. Instead this file puts the elements into the same order in the page itself, for the width the window has now:
//   wide (above 1080):  logo, the three links, then the account area (My postings, Analytics, Team, the initials circle, Sign out)
//   middle (641 to 1080): logo, the account area (same order inside), then the three links (they are the last row)
//   phone (640 and below): logo, the account area with the initials circle and Sign out FIRST and then My postings, Analytics, Team, then the three links
// The window is watched with the very same media queries the stylesheet uses, so the two cannot drift apart by a pixel; moving elements is done only when the order is not already right, and the element
// that had the keyboard focus gets it back (moving an element in the page drops its focus).
//   headerMode(phone, middle)                 -> "wide" | "middle" | "phone"                    (pure; tested in Node)
//   wantedOrder(mode, parts, accountKids)     -> { top: [...], account: [...] }                  (pure; parts: { logo, links, account }; accountKids: [{ el, kind }] with kind "link" | "circle" | "signout")
//   orderHeader(doc, win)                     -> true when something was moved
//   watchHeaderOrder(doc, win)                starts watching once per page (a second call does nothing)
export const PHONE_QUERY = "(max-width:640px)", MIDDLE_QUERY = "(max-width:1080px)";

export const headerMode = (phone, middle) => (phone ? "phone" : middle ? "middle" : "wide");

const RANK_NORMAL = { link: 1, circle: 2, signout: 3 };
const RANK_PHONE = { circle: 1, signout: 2, link: 3 };

export function wantedOrder(mode, parts, accountKids) {
  const top = mode === "wide" ? [parts.logo, parts.links, parts.account] : [parts.logo, parts.account, parts.links];
  const rank = mode === "phone" ? RANK_PHONE : RANK_NORMAL;
  // a stable sort: kids of the same kind keep the order they have
  const account = accountKids.map((k, i) => ({ k, i })).sort((a, b) => (rank[a.k.kind] - rank[b.k.kind]) || (a.i - b.i)).map((x) => x.k.el);
  return { top: top.filter(Boolean), account };
}

// what a child of the account area is, by what it is (not by where it sits)
function kindOf(el) {
  const tag = String(el.tagName || "").toUpperCase();
  if (tag === "A") return "link";
  if (tag === "BUTTON") return "signout";
  return "circle";      // the initials circle's wrapper, or the plain words "Email confirmed" of a candidate
}

function place(parent, wanted, doc) {
  const set = new Set(wanted), have = Array.from(parent.children).filter((c) => set.has(c));
  if (have.length === wanted.length && have.every((c, i) => c === wanted[i])) return false;
  const active = doc.activeElement, queue = wanted.slice();
  // the wanted elements take the slots the same elements had: anything else inside the parent stays where it is
  const slots = Array.from(parent.children).map((c) => (set.has(c) ? queue.shift() : c));
  for (const c of slots) parent.appendChild(c);
  if (active && active !== doc.body && doc.activeElement !== active && active.isConnected && active.focus) active.focus({ preventScroll: true });
  return true;
}

export function orderHeader(doc, win) {
  const nav = doc.querySelector("header.nav");
  if (!nav || !win.matchMedia) return false;
  const q = (s) => Array.from(nav.children).find((c) => c.matches(s)) || null;
  const parts = { logo: q(".nav-logo"), links: q(".nav-links"), account: q("#navAccount") };
  if (!parts.logo || !parts.links || !parts.account) return false;
  const mode = headerMode(win.matchMedia(PHONE_QUERY).matches, win.matchMedia(MIDDLE_QUERY).matches);
  const want = wantedOrder(mode, parts, Array.from(parts.account.children).map((el) => ({ el, kind: kindOf(el) })));
  const a = place(nav, want.top.slice(), doc), b = place(parts.account, want.account.slice(), doc);
  return a || b;
}

let watching = false;
export function watchHeaderOrder(doc, win) {
  if (watching || !win.matchMedia) return;
  watching = true;
  for (const query of [PHONE_QUERY, MIDDLE_QUERY]) {
    const m = win.matchMedia(query), on = () => orderHeader(doc, win);
    if (m.addEventListener) m.addEventListener("change", on); else if (m.addListener) m.addListener(on);
  }
  orderHeader(doc, win);
}
