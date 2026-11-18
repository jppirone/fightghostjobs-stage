// phone-readings-ot.js - the readings added by prompt OT (November 18, 2026): the three LinkedIn job cards John sent through the Shortcut on November 17, 2026, and the variants that matter for the page (reader-v4, tag commit 95f6a1c).
//   kind rebuilt: REBUILT FROM A SCREENSHOT. Apple's real text for these cards was NOT seen; the lines are the most likely reading. They are not kind apple.
//   No person's name is in any of them (public job listings).
//   expect: the state, the three boxes, the notes under the boxes (page sentence numbers), the flag orderAssumed (the page's own "check" line), and the other openings offered.
// The expected values are written by hand from what the screen shows: the company and the job title as a person reads them. The middle dot is written as ·, the bullet as •, the copyright sign as ©.
const DOT = "·", BUL = "•", COPY = "©";
const none = { company: null, query: null, req: null };
const row = (id, name, text, company, query, orderAssumed) => ({ id, kind: "rebuilt", name, text, expect: { state: "read", cut: false, company, query, req: "", notes: none, orderAssumed, others: [] } });
const BW = "Director of AI Strategy + Adoption", BC = "Burtch Works", OT = "Applied AI Delivery Lead - Remote in AMER";
const bw = (id, name, line2, line3, before = "") => row(id, name, before + BW + "\n" + BC + " " + line2 + (line3 === null ? "" : "\n" + line3), BC, BW, false);
const oa = (id, name, text, title = OT) => row(id, name, text, "OpenAI", title, true);
export const READINGS_OT = [
  bw("OT01", "Burtch Works card: company, middle dot, place with (Remote), pay", DOT + " United States (Remote)", "$175K-$190K / year"),
  bw("OT02", "Burtch Works: the dot read as a bullet", BUL + " United States (Remote)", "$175K-$190K / year"),
  bw("OT03", "Burtch Works: the dot read as a bar", "| United States (Remote)", "$175K-$190K / year"),
  bw("OT04", "Burtch Works: the dot read as a lone period", ". United States (Remote)", "$175K-$190K / year"),
  bw("OT05", "Burtch Works: (Hybrid) instead of (Remote)", DOT + " United States (Hybrid)", "$175K-$190K / year"),
  bw("OT06", "Burtch Works: place Atlanta, GA (Remote)", DOT + " Atlanta, GA (Remote)", "$175K-$190K / year"),
  bw("OT07", "Burtch Works: place Greater Boston Area (On-site)", DOT + " Greater Boston Area (On-site)", "$175K-$190K / year"),
  bw("OT08", "Burtch Works: Viewed instead of the pay line", DOT + " United States (Remote)", "Viewed"),
  bw("OT09", "Burtch Works: Actively recruiting instead of the pay line", DOT + " United States (Remote)", "Actively recruiting"),
  bw("OT10", "Burtch Works: no third line", DOT + " United States (Remote)", null),
  bw("OT11", "Burtch Works: a status bar line above the card", DOT + " United States (Remote)", "$175K-$190K / year", "9:41\n"),
  bw("OT12", "Burtch Works: a close mark line above the card", DOT + " United States (Remote)", "$175K-$190K / year", "x\n"),
  oa("OT20", "OpenAI card: the title wrapped onto a second line, the company below, nothing under it", "Applied AI Delivery Lead -\nRemote in AMER\nOpenAI"),
  oa("OT21", "OpenAI: the shield read as a copyright sign after the wrapped line", "Applied AI Delivery Lead -\nRemote in AMER " + COPY + "\nOpenAI"),
  oa("OT22", "OpenAI: the shield read as an at sign after the wrapped line", "Applied AI Delivery Lead -\nRemote in AMER @\nOpenAI"),
  oa("OT23", "OpenAI: the shield read as a lone letter on its own line", "Applied AI Delivery Lead -\nRemote in AMER\nV\nOpenAI"),
  oa("OT24", "OpenAI: Viewed below the company", "Applied AI Delivery Lead -\nRemote in AMER\nOpenAI\nViewed"),
  oa("OT25", "OpenAI: a place line below the company", "Applied AI Delivery Lead -\nRemote in AMER\nOpenAI\nSan Francisco, CA"),
  oa("OT26", "OpenAI: a pay line below the company", "Applied AI Delivery Lead -\nRemote in AMER\nOpenAI\n$175K-$190K / year"),
  oa("OT27", "OpenAI: the wrapped line is Remote in EMEA", "Applied AI Delivery Lead -\nRemote in EMEA\nOpenAI", "Applied AI Delivery Lead - Remote in EMEA"),
  oa("OT28", "OpenAI: the first line ends with a comma", "Applied AI Delivery Lead,\nRemote in AMER\nOpenAI", "Applied AI Delivery Lead, Remote in AMER"),
  row("OT30", "Slalom card (the one that worked on November 17, 2026): it must keep working", "Client Partner - Technology\nSlalom " + DOT + " Atlanta, GA\n16 school alumni", "Slalom", "Client Partner - Technology", false),
];
