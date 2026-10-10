// policy-link.js - the employer's AI and hiring policy link (prompt BA, October 10, 2026). One more destination link, in the Disclosures area of the opening editor, next to the two AI toggles.
// Pure (no DOM): the words, the address check, the editor's states and what a candidate is shown. Tested in Node (tests/policy-link.unit.test.js).
//
// What it is: a link to the employer's OWN page about how it uses AI in hiring. It is stored like every destination link (the address is write-only: the server keeps it encrypted and never sends it back),
// checked when it is saved (the address answers or it does not) and gated by the same tier. It is NOT an application destination: the apply path never uses it, it is not counted in the ten, and a candidate who
// opens it is not counted as an application click. FightGhostJobs checks only that the address answers; it does not read, judge or summarize the page.
import { planNotice, MAX_URL } from "./edit-form.js";

export const POLICY_LABEL = "Link to your AI and hiring policy (optional)";
export const POLICY_HINT = "Shown to candidates as a link to your own page. FightGhostJobs checks only that the address answers; it does not read or judge what the page says.";
export const POLICY_LOCKED = "Adding a link to your AI and hiring policy is part of the destination links tier. Your organization is not on it.";
export const POLICY_SALES = "Contact sales@fightghostjobs.com";
export const POLICY_REMOVE_CONFIRM = "Remove the AI and hiring policy link from this opening? You can add it again at any time.";
// the one line a candidate reads in the opening's details window, followed by where the link goes (the same text as for the other employer links)
export const POLICY_LINE_LABEL = "AI and hiring policy:";

export const isPolicy = (l) => !!l && l.kind === "policy";
// the stored entries of get-my-posting's destination_links, split by kind
export const policyLink = (list) => (Array.isArray(list) ? list : []).find(isPolicy) || null;

// raw: what was typed. -> { ok, url?, error? } (the same rules as the application links' address boxes: https, a real address, at most 2048 characters; the server judges the rest)
export function checkPolicyUrl(raw) {
  const url = String(raw == null ? "" : raw).trim();
  if (url === "") return { ok: false, error: "Enter the address of the page, or use Remove to take the link off." };
  if (url.length > MAX_URL) return { ok: false, error: "Keep the address to " + MAX_URL + " characters or fewer." };
  if (!/^https:\/\//i.test(url)) return { ok: false, error: "The address must start with https://" };
  let href = null;
  try { const u = new URL(url); if (u.protocol === "https:" && u.hostname !== "") href = u.href; } catch { /* not an address */ }
  if (href === null) return { ok: false, error: "That does not look like a web address." };
  return { ok: true, url };
}

// doc: what get-my-posting returned. -> what the editor draws
//   show: "locked" (not on the tier: the sales notice, no box, nothing can be saved) | "lapsed" (the tier ended: the stored link, if any, is kept and hidden) | "form" (on the tier)
//   status (form only): "empty" | "ok" (answered when it was saved) | "failed" (did not answer) | "unchecked" (could not be tried)
export function policyView(doc, nowMs) {
  const n = planNotice(doc && doc.plan, nowMs), link = policyLink(doc && doc.destination_links);
  if (n.state === "lapsed") return { show: "lapsed", stored: !!link, endsAt: n.endsAt };
  if (n.state !== "active") return { show: "locked", stored: !!link };
  if (!link) return { show: "form", stored: false, status: "empty", http: null, shownAs: null };
  const c = link.check_status;
  return { show: "form", stored: true, status: c === "ok" ? "ok" : c === "failed" ? "failed" : "unchecked", http: Number.isInteger(link.check_http) ? link.check_http : null, shownAs: typeof link.shown_as === "string" ? link.shown_as : null };
}

// the sentence under the box for a stored link: what candidates see, and why they do not when the check did not pass
export function policyStoredText(v) {
  if (!v || !v.stored) return "No AI and hiring policy link is saved.";
  if (v.status === "ok") return "A link is saved. Candidates see it as " + POLICY_LINE_LABEL + " " + (v.shownAs || "your link") + ". When we checked, the address answered.";
  if (v.status === "failed") return "A link is saved, but when we checked, the address did not answer" + (Number.isInteger(v.http) ? " (HTTP " + v.http + ")" : "") + ". Candidates are not shown it. Save it again once the page is up, and we will check it again.";
  return "A link is saved, but the address could not be checked just now, so candidates are not shown it yet. Save it again to check it once more.";
}
export function policyLapsedText(v) {
  return "Your destination links tier ended. " + (v && v.stored ? "The AI and hiring policy link you saved is kept but hidden from candidates until it is renewed." : "Adding an AI and hiring policy link is paused until it is renewed.") + " To renew, write to sales@fightghostjobs.com.";
}
// the message after a save that worked. r: what the server answered ({ changed, active_links, links })
export function policySavedText(r, removed) {
  if (removed) return r && r.changed === false ? "There was no AI and hiring policy link saved, so nothing was changed." : "Removed. No AI and hiring policy link is saved on this opening.";
  const l = r && Array.isArray(r.links) ? r.links.find(isPolicy) : null;
  if (r && r.changed === false) return "That is the link already saved, so nothing was changed.";
  if (l && l.check_status === "failed") return "Saved, but when we checked, the address did not answer" + (Number.isInteger(l.check_http) ? " (HTTP " + l.check_http + ")" : "") + ". Candidates are not shown it until a check answers. Make sure the address is right, then save it again.";
  if (l && l.check_status !== "ok") return "Saved, but the address could not be checked just now, so candidates are not shown it yet. Save it again to check it once more.";
  return "Saved. Candidates see it as " + POLICY_LINE_LABEL + " " + ((l && l.shown_as) || "your link") + ".";
}
// a refusal from set-destination-links -> { field, general, planRequired }
export function mapPolicyError(err) {
  if (!err) return { field: null, general: "Something went wrong.", planRequired: false };
  if (err.code === "plan_required") return { field: null, general: err.message || POLICY_LOCKED + " Nothing was changed.", planRequired: true };
  const list = Array.isArray(err.errors) && err.errors.length ? err.errors : err.field ? [{ field: err.field, message: err.message || "Not accepted." }] : [];
  for (const x of list) if (/^links\[0\]\.url$/.test(x.field)) return { field: x.message, general: null, planRequired: false };
  const g = list.length ? list[0].message : err.message;
  return { field: null, general: g || null, planRequired: false };
}

// what a candidate is shown (the details window): the one entry of kind policy, or null. The server sends it only while the organization is on the tier, the opening is live and the stored check answered;
// the page shows exactly what it is given, and nothing at all when there is no such entry. Never a summary, never a verdict.
export function candidatePolicyLine(links) {
  const l = (Array.isArray(links) ? links : []).find((x) => x && x.kind === "policy");
  if (!l || typeof l.label !== "string" || l.label === "") return null;
  return { position: l.position, label: POLICY_LINE_LABEL, where: l.label };
}
// the links a candidate may APPLY through (and report): everything except the policy link
export const applicationLinks = (links) => (Array.isArray(links) ? links : []).filter((x) => x && x.kind !== "policy");
