// location-catalog.js - turns the generated catalog module (js/data/locations-us.js, ~90 KB compressed) into the entries the picker searches. Loaded LAZILY, the first time the picker is used, by a dynamic import:
// that is a script load from this site, so the Content-Security-Policy is unchanged and pages that never open the picker never download the list.
// The database holds the SAME catalog (public.location_catalog) and refuses anything that is not in it; the display strings built here are exactly the ones it stores.
import { normalize } from "./location-search.js";

// -> { version, entries: [{ id, kind, display, key }], byId: Map }
export function buildEntries(m) {
  const entries = [];
  const add = (id, kind, display) => entries.push({ id, kind, display, key: normalize(display) });
  for (const [c, n] of m.STATES) add("st:" + c, "state", n);
  add(m.NATIONWIDE[0], "nationwide", m.NATIONWIDE[1]);
  for (const [i, n] of m.METROS) add("cbsa:" + i, "metro", n + " metro area");
  for (const [i, n] of m.MICROS) add("cbsa:" + i, "micro", n + " micro area");
  for (const [i, n, st, cty] of m.PLACES) add("gn:" + i, "place", n + ", " + st + (cty ? " (" + cty + ")" : ""));
  return { version: m.CATALOG_VERSION, entries, byId: new Map(entries.map((e) => [e.id, e])) };
}

let pending = null;
export function loadCatalog() {
  if (!pending) pending = import("./data/locations-us.js").then(buildEntries).catch((err) => { pending = null; throw err; });
  return pending;
}
