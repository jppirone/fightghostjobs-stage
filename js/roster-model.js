// roster-model.js - the Team page's pure logic: what it sends to poster-roster-add / -remove / -set-admin, checked before anything is sent, and the words for a refusal. Tested in Node.
// The backend is the authority (admin only; one active poster per address across organizations; at most 50 active posters; an organization keeps at least one admin; a poster who owns postings
// needs a successor); these checks only spare a round trip and say the same things.

export const MAX_ROSTER = 50, MAX_NAME = 120;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// -> { ok, errors: { email?, name? }, body?: { email, full_name, is_org_admin } }
export function checkAdd(emailText, nameText, isAdmin) {
  const errors = {}, email = String(emailText == null ? "" : emailText).trim(), name = String(nameText == null ? "" : nameText).trim();
  if (email === "" || !EMAIL_RE.test(email) || email.length > 320) errors.email = "Enter the person's work email address.";
  if (name === "") errors.name = "Enter the person's name."; else if (name.length > MAX_NAME) errors.name = "Keep the name to " + MAX_NAME + " characters or fewer.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, errors, body: { email, full_name: name, is_org_admin: isAdmin === true } };
}

// Who may be named as a successor for a removal: every OTHER active or invited member (the backend refuses anything else).
export const successorChoices = (roster, targetId) => roster.filter((p) => p.poster_id !== targetId);

// The row's own labels
export const statusText = (p) => (p.status === "active" ? "Active" : "Invited (has not signed in yet)");
export const roleText = (p) => (p.is_org_admin ? "Admin" : "Member");

// Can this row be acted on by the signed-in admin? (The backend decides for real; this only hides what would certainly be refused.)
export function actionsFor(p, me, roster) {
  const admins = roster.filter((x) => x.is_org_admin).length;
  const out = [];
  if (p.poster_id !== me) out.push("remove");
  if (p.is_org_admin ? admins > 1 : true) out.push(p.is_org_admin ? "demote" : "promote");      // the last admin cannot be demoted
  return out;
}

// A refusal from any roster call -> words. field/code come from the API error.
export function mapRosterError(err) {
  if (!err) return "Something went wrong.";
  switch (err.code) {
    case "cannot_add": return "That address cannot be added: it already belongs to a roster (here or at another organization).";
    case "roster_full": return "Your organization has reached the maximum of " + MAX_ROSTER + " active posters.";
    case "last_admin": return "An organization must keep at least one admin. Make someone else an admin first.";
    case "successor_required": return "This person owns postings. Choose who takes them over, then remove them.";
    case "forbidden": return "Only an admin of your organization can manage the roster.";
    case "not_found": return "That person is not on your roster any more. Reload the page.";
    case "rate_limited": return "Too many requests just now. Try again in a moment.";
    default: return err.message || null;
  }
}
