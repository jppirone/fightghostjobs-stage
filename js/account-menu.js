// account-menu.js - the signed-in circle in the top bar (October 4, 2026, John's decision). The initials circle IS the control: it carries the employer's name and organization as its accessible name,
// shows them in a small label on mouse-over and on keyboard focus, and opens the same label on tap, Enter or Space (closes on Escape or a click elsewhere; Escape returns focus to the circle).
// The text used to be printed beside the circle ("John Pirone · Fight Ghost Jobs Pilot"); it wrapped into a tall narrow stack and squeezed the navigation. Nothing is lost: the full text is in the circle's
// accessible name (aria-label) and in the label. Everything is placed as TEXT (the name and organization are the employer's own words, but they are still placed as text, never as HTML).
//   accountText(name, org)            -> { name, org, label, hint }   the words, in one place
//   buildAccount(h, initials, name, org) -> { root, button, pop }     the elements (h is dom.js's h)
//   wireAccountMenu(parts, doc)       -> { isOpen, open, close }      the behaviour; wiring a second time (a page that mounts the account twice) removes the first wiring
export const ACCOUNT = { PREFIX: "Signed in as ", POP_ID: "accountPop" };

export function accountText(name, org) {
  const n = String(name === null || name === undefined ? "" : name).replace(/\s+/g, " ").trim() || "Employer";
  const o = String(org === null || org === undefined ? "" : org).replace(/\s+/g, " ").trim();
  return { name: n, org: o, label: ACCOUNT.PREFIX + n + (o ? ", " + o : "") };
}

export function buildAccount(h, initials, name, org) {
  const t = accountText(name, org);
  const button = h("button", { type: "button", class: "avatar avatar-btn", "aria-label": t.label, "aria-expanded": "false", "aria-controls": ACCOUNT.POP_ID }, initials(t.name));
  // the label is a visual mirror of the circle's accessible name, so a screen reader does not read the same words twice
  const pop = h("span", { id: ACCOUNT.POP_ID, class: "account-pop", "aria-hidden": "true" }, h("strong", { class: "account-pop-name", text: t.name }), t.org ? h("span", { class: "account-pop-org", text: t.org }) : null);
  const root = h("span", { class: "nav-account" }, button, pop);
  return { root, button, pop };
}

const contains = (a, b) => { for (let n = b; n; n = n.parentNode || n.parent) if (n === a) return true; return false; };
let previous = null;

export function wireAccountMenu(parts, doc) {
  if (previous) { previous(); previous = null; }
  const { root, button, pop } = parts;
  let isOpen = false;
  const set = (on, giveFocus) => {
    isOpen = on;
    pop.classList.toggle("open", on);
    if (on) pop.classList.remove("dismissed");
    button.setAttribute("aria-expanded", on ? "true" : "false");
    if (!on && giveFocus) button.focus();
  };
  const onClick = (ev) => { ev.preventDefault(); set(!isOpen, false); };
  // Escape closes the label (also the one shown by mouse-over or focus alone: it stays dismissed until the pointer or focus leaves) and puts focus back on the circle
  const onKey = (ev) => {
    if (ev.key !== "Escape") return;
    if (isOpen) { ev.preventDefault(); set(false, true); pop.classList.add("dismissed"); }
    else if (contains(root, doc.activeElement) || (root.matches && root.matches(":hover"))) pop.classList.add("dismissed");
  };
  const onDocClick = (ev) => { if (isOpen && !contains(root, ev.target)) set(false, false); };
  const onFocusOut = (ev) => { pop.classList.remove("dismissed"); if (isOpen && ev.relatedTarget && !contains(root, ev.relatedTarget)) set(false, false); };
  const onLeave = () => pop.classList.remove("dismissed");
  button.addEventListener("click", onClick);
  root.addEventListener("focusout", onFocusOut);
  root.addEventListener("mouseleave", onLeave);
  doc.addEventListener("keydown", onKey);
  doc.addEventListener("click", onDocClick);
  previous = () => { button.removeEventListener("click", onClick); root.removeEventListener("focusout", onFocusOut); root.removeEventListener("mouseleave", onLeave); doc.removeEventListener("keydown", onKey); doc.removeEventListener("click", onDocClick); };
  return { isOpen: () => isOpen, open: () => set(true, false), close: () => set(false, false) };
}
