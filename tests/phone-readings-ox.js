// phone-readings-ox.js - the readings added by prompt OX (November 18, 2026): the LinkedIn test opening of John's own whose title carries a KIO ID, and the variants that matter for the page (reader-v6, tag commit 6d4df0a).
//   kind REAL: "apple, John's Shortcut, November 18, 2026": the text Apple's Extract Text from Image really produced, decoded from the address John's Shortcut opened at 1:26 AM on November 18, 2026 (a test opening, no person's name in it).
//   kind REBUILT: "rebuilt from the real text": the same four lines laid out in other ways (made up by hand from the real text, Apple's real text for those layouts not seen).
//   expect: written by hand from the page's own rule (js/phone-model.js boxesOf, lines 67 to 69): with a KIO ID the company box is filled, the ID goes in the query box (the title is not held and not sent), no req number goes with it, no check line.
export const KIND_REAL = "apple, John's Shortcut, November 18, 2026";
export const KIND_REBUILT = "rebuilt from the real text";
const none = { company: null, query: null, req: null };
const ID = "KIO-Q9GQ-QMXJ-EP8Y", CO = "FightGhostJobs", PL = "Sebastian, FL (On-site)";
const row = (id, name, text, company, query, req, notes, kind) => ({ id, kind, name, text, expect: { state: "read", cut: false, company, query, req, notes, orderAssumed: false, others: [] } });
const kio = (id, name, text, kind = KIND_REBUILT) => row(id, name, text, CO, ID, "", none, kind);
export const READINGS_OX = [
  // the REAL text (four lines): the title wrapped onto a second line and the ID after the closing bracket
  kio("OX01", "REAL card as Apple read it: title on two lines, (TEST ONLY), the ID at the end of the second line", "Chief Human Resources\nOfficer (TEST ONLY) " + ID + "\n" + CO + "\n" + PL, KIND_REAL),
  kio("OX02", "the title on ONE line with the ID after it", "Chief Human Resources Officer (TEST ONLY) " + ID + "\n" + CO + "\n" + PL),
  kio("OX03", "the ID on its own line below the title", "Chief Human Resources Officer (TEST ONLY)\n" + ID + "\n" + CO + "\n" + PL),
  kio("OX04", "the ID first on the title line", ID + " Chief Human Resources Officer (TEST ONLY)\n" + CO + "\n" + PL),
  kio("OX05", "the ID at the end of the FIRST wrapped line", "Chief Human Resources " + ID + "\nOfficer (TEST ONLY)\n" + CO + "\n" + PL),
  kio("OX06", "the ID after a dash at the end of the second line", "Chief Human Resources\nOfficer (TEST ONLY) - " + ID + "\n" + CO + "\n" + PL),
  kio("OX07", "the ID after a word with no brackets", "Chief Human Resources\nOfficer " + ID + "\n" + CO + "\n" + PL),
  kio("OX08", "the ID in small letters", "Chief Human Resources\nOfficer (TEST ONLY) " + ID.toLowerCase() + "\n" + CO + "\n" + PL),
  kio("OX09", "the ID on the company line", "Chief Human Resources\nOfficer (TEST ONLY)\n" + CO + " " + ID + "\n" + PL),
  // controls: readings that must not change (a word that only begins like KIO, a req number in brackets)
  row("OX30", "control: Kiosk Manager is a title, not an ID", "Kiosk Manager\n" + CO + "\n" + PL, CO, "Kiosk Manager", "", none, KIND_REBUILT),
  row("OX31", "control: KIOSK Operations Lead is a title, not an ID", "KIOSK Operations Lead\n" + CO + "\n" + PL, CO, "KIOSK Operations Lead", "", none, KIND_REBUILT),
  row("OX32", "control: a req number in brackets at the end of the title", "Chief Human Resources Officer (R12345)\n" + CO + "\n" + PL, CO, "Chief Human Resources Officer", "R12345", { company: null, query: null, req: 3 }, KIND_REBUILT),
];
