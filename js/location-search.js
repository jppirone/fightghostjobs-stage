// location-search.js - type-ahead over the location catalog. Pure (no DOM): tested in Node.
// Matching ignores case, accents and punctuation ("austin tx" finds "Austin, TX"; "bronx" finds "The Bronx, NY"), treats saint/st, fort/ft and mount/mt as the same word ("saint louis" finds "St. Louis, MO"),
// and knows four everyday nicknames (nyc, sf, philly, vegas).
// Ranking, best first: the whole name; a name whose first word is what was typed; a name that starts with it; a name with it as a whole word; a name with a word that starts with it; a name that contains it.
// Within a class, cities come before metro areas, micro areas, states and "nationwide", and cities keep the catalog's own order (largest first).

export function normalize(text) {
  return String(text == null ? "" : text).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();
}
const SYNONYM = { saint: "st", fort: "ft", mount: "mt" };
export const canon = (norm) => norm.split(" ").map((w) => SYNONYM[w] || w).join(" ");
const NICKNAME = { nyc: "new york city", sf: "san francisco", philly: "philadelphia", vegas: "las vegas" };
const KIND_ORDER = { place: 0, metro: 1, micro: 2, state: 3, nationwide: 4 };

function classify(k, q) {
  if (k === q) return 0;
  if (k.startsWith(q + " ")) return 1;
  if (k.startsWith(q)) return 2;
  if (k.includes(" " + q + " ") || k.endsWith(" " + q)) return 3;
  if (k.includes(" " + q)) return 4;
  if (k.includes(q)) return 5;
  return -1;
}

// entries: [{ id, kind, display, key }] in catalog order.   options: { selectedIds?: Set|array, remote?: boolean, limit?: number, allow?: (entry) => boolean }
export function search(entries, query, options = {}) {
  let q = normalize(query);
  if (q === "") return [];
  if (NICKNAME[q]) q = NICKNAME[q];
  const qc = canon(q);
  const limit = options.limit || 8, selected = new Set(options.selectedIds || []), allow = options.allow;
  const scored = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (selected.has(e.id)) continue;
    if (!options.remote && (e.kind === "state" || e.kind === "nationwide")) continue;         // states and "nationwide" exist only for remote roles
    if (allow && !allow(e)) continue;
    const k = e.key, kc = e.kc || (e.kc = canon(k)), a = classify(k, q), b = qc === q && kc === k ? -1 : classify(kc, qc);
    const cls = a < 0 ? b : b < 0 ? a : Math.min(a, b);
    if (cls < 0) continue;
    scored.push([cls, KIND_ORDER[e.kind], i, e]);
  }
  scored.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
  return scored.slice(0, limit).map((s) => s[3]);
}
