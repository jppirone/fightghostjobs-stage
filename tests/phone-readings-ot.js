// phone-readings-ot.js - the readings added by prompts OT and OV (November 18, 2026): the three LinkedIn job cards John sent through the Shortcut, and the variants that matter for the page (reader-v5, tag commit 1927111).
//   kind REAL: "apple, John's Shortcut, November 18, 2026": the text Apple's Extract Text from Image really produced for the Burtch Works card and the OpenAI card, decoded from the two addresses John's Shortcut opened (prompt OV). Public job listings, no person's name in them.
//   kind REBUILT: "rebuilt from a screenshot, Apple's real text not seen": made up from a screenshot or from a real reading (the variants and the Slalom card).
//   expect: the state, the three boxes, the notes under the boxes (page sentence numbers), the flag orderAssumed (the page's own "check" line), and the other openings offered.
// The expected values are written by hand from what the screen shows: the company and the job title as a person reads them. The bullet is written as •, the middle dot as ·, the copyright sign as ©.
// In the real texts Apple reads the capital letters AI as Al (small L): "Al", "OpenAl". The reader corrects it in the title and in the company; the expected values here have AI.
const DOT = "·", BUL = "•", COPY = "©";
export const KIND_REAL = "apple, John's Shortcut, November 18, 2026";
export const KIND_REBUILT = "rebuilt from a screenshot, Apple's real text not seen";
const none = { company: null, query: null, req: null };
const row = (id, name, text, company, query, orderAssumed, kind = KIND_REBUILT, others = []) => ({ id, kind, name, text, expect: { state: "read", cut: false, company, query, req: "", notes: none, orderAssumed, others } });
const BW = "Director of AI Strategy + Adoption", BC = "Burtch Works", OT = "Applied AI Delivery Lead - Remote in AMER";
const bw = (id, name, line2, line3, before = "") => row(id, name, before + BW + "\n" + BC + " " + line2 + (line3 === null ? "" : "\n" + line3), BC, BW, false);
const oa = (id, name, text, title = OT) => row(id, name, text, "OpenAI", title, true);
// the REAL OpenAI card, line by line, and a builder for its variants
const OAR = { before: [], l1: "Applied Al Delivery Lead - Remote", l2: "in AMER", l3: "OpenAl " + BUL + " United States (Remote)", l4: "$234K-$335K / year", after: [] };
const oar = (o = {}) => { const v = { ...OAR, ...o }; return [...v.before, v.l1, v.l2, v.l3, ...(v.l4 === null ? [] : [v.l4]), ...v.after].join("\n"); };
const SLALOM = "Client Partner - Technology\nSlalom " + DOT + " Atlanta, GA\n16 school alumni";
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
  // the REAL Burtch Works text (four lines: a logo read as BW, the title with Al, the company line with a bullet, the pay)
  row("OT13", "REAL Burtch Works card as Apple read it (BW logo line, Al for AI, bullet)", "BW\nDirector of Al Strategy + Adoption\nBurtch Works " + BUL + " United States (Remote)\n$175K-$190K / year", BC, BW, false, KIND_REAL),
  // the REAL OpenAI text (four lines: the title wrapped after Remote, the company line with OpenAl and a bullet, the pay)
  row("OT20", "REAL OpenAI card as Apple read it (title wrapped after Remote, OpenAl, bullet, pay)", oar(), "OpenAI", OT, true, KIND_REAL),
  oa("OT21", "OpenAI (rebuilt): the shield read as a copyright sign after the wrapped line", "Applied AI Delivery Lead -\nRemote in AMER " + COPY + "\nOpenAI"),
  oa("OT22", "OpenAI (rebuilt): the shield read as an at sign after the wrapped line", "Applied AI Delivery Lead -\nRemote in AMER @\nOpenAI"),
  oa("OT23", "OpenAI (rebuilt): the shield read as a lone letter on its own line", "Applied AI Delivery Lead -\nRemote in AMER\nV\nOpenAI"),
  oa("OT24", "OpenAI (rebuilt): Viewed below the company", "Applied AI Delivery Lead -\nRemote in AMER\nOpenAI\nViewed"),
  oa("OT25", "OpenAI (rebuilt): a place line below the company", "Applied AI Delivery Lead -\nRemote in AMER\nOpenAI\nSan Francisco, CA"),
  oa("OT26", "OpenAI (rebuilt): a pay line below the company", "Applied AI Delivery Lead -\nRemote in AMER\nOpenAI\n$175K-$190K / year"),
  oa("OT27", "OpenAI (rebuilt): the wrapped line is Remote in EMEA", "Applied AI Delivery Lead -\nRemote in EMEA\nOpenAI", "Applied AI Delivery Lead - Remote in EMEA"),
  oa("OT28", "OpenAI (rebuilt): the first line ends with a comma", "Applied AI Delivery Lead,\nRemote in AMER\nOpenAI", "Applied AI Delivery Lead, Remote in AMER"),
  row("OT30", "Slalom card (the one that worked on November 17, 2026): it must keep working", SLALOM, "Slalom", "Client Partner - Technology", false),
  // variants of the REAL OpenAI text (prompt OV)
  oa("OT40", "OpenAI real layout: the pay line absent", oar({ l4: null })),
  oa("OT41", "OpenAI real layout: the place without the bracket", oar({ l3: "OpenAl " + BUL + " United States" })),
  oa("OT42", "OpenAI real layout: the bullet read as a bar", oar({ l3: "OpenAl | United States (Remote)" })),
  oa("OT43", "OpenAI real layout: the bullet read as a lone period", oar({ l3: "OpenAl . United States (Remote)" })),
  oa("OT44", "OpenAI real layout: the bullet read as a middle dot", oar({ l3: "OpenAl " + DOT + " United States (Remote)" })),
  oa("OT45", "OpenAI real layout: a logo line OA above the title", oar({ before: ["OA"] })),
  oa("OT46", "OpenAI real layout: a logo line O above the title", oar({ before: ["O"] })),
  oa("OT47", "OpenAI real layout: the continuation line reads In AMER", oar({ l2: "In AMER" }), "Applied AI Delivery Lead - Remote In AMER"),
  oa("OT48", "OpenAI real layout: the continuation line reads in North America", oar({ l2: "in North America" }), "Applied AI Delivery Lead - Remote in North America"),
  oa("OT49", "OpenAI real layout: the continuation line reads in EMEA", oar({ l2: "in EMEA" }), "Applied AI Delivery Lead - Remote in EMEA"),
  oa("OT50", "OpenAI real layout: the first line ends with - Hybrid", oar({ l1: "Applied Al Delivery Lead - Hybrid" }), "Applied AI Delivery Lead - Hybrid in AMER"),
  oa("OT51", "OpenAI real layout: the first line ends with - On-site", oar({ l1: "Applied Al Delivery Lead - On-site" }), "Applied AI Delivery Lead - On-site in AMER"),
  oa("OT52", "OpenAI real layout: the company spelled OpenAI (no Al) with the continuation line", oar({ l3: "OpenAI " + BUL + " United States (Remote)" })),
  oa("OT53", "OpenAI real layout: Viewed below", oar({ after: ["Viewed"] })),
  // controls: what must stay as it was
  row("OT60", "control: a lone Acme Corp - Remote under a title still reads Acme Corp", "Senior Analyst\nAcme Corp - Remote\n$90K/yr - $110K/yr", "Acme Corp", "Senior Analyst", false),
  row("OT61", "control: the real OpenAI card and the Slalom card in one text: the first card fills the boxes, the other is offered", oar() + "\n" + SLALOM, "OpenAI", OT, true, KIND_REBUILT, ["Client Partner - Technology at Slalom"]),
  row("OT62", "control: the company Al's Diner stays as written", "Line Cook\nAl's Diner\nBoston, MA\nViewed", "Al's Diner", "Line Cook", false),
  row("OT63", "control: the company Capital One stays as written", "Analyst\nCapital One\nMcLean, VA\nViewed", "Capital One", "Analyst", false),
];
