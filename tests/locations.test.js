// locations.test.js - the location catalog, the picker's rules and its search. Run: node --test tests/locations.test.js
// GRID is the answer for every combination of the enumeration below, written independently from the approved design (it is the same table the database trigger is tested against, one letter per case):
//   o ok, T more than 13, N nationwide with states, M states/nationwide on a non-remote posting, C more than 10 states, A more than 3 areas, S two or more locations without the statement.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { CAPS, verdict, problems, canAdd, MESSAGES } from "../js/location-rules.js";
import { normalize, search } from "../js/location-search.js";
import { loadCatalog } from "../js/location-catalog.js";
import { validateForm, buildCreateBody, mapServerErrors } from "../js/register-form.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GRID = "ooooooMMooMMNNNNoSMMNNNNoSMMNNNNCCMMNNNNoooooSMMoSMMNNNNoSMMNNNNoSMMNNNNCCMMNNNNoooooSMMoSMMNNNNoSMMNNNNoSMMNNNNCCMMNNNNoSoSoSMMoSMMNNNNoSMMNNNNoSMMNNNNCCMMTTTToooooSMMoSMMNNNNoSMMNNNNoSMMNNNNCCMMNNNNoSoSoSMMoSMMNNNNoSMMNNNNoSMMNNNNCCMMTTTToSoSoSMMoSMMNNNNoSMMNNNNoSMMNNNNCCMMTTTToSoSoSMMoSMMNNNNoSMMNNNNoSMMTTTTTTTTTTTToSoSoSMMoSMMNNNNoSMMNNNNoSMMNNNNCCMMTTTToSoSoSMMoSMMNNNNoSMMNNNNoSMMTTTTTTTTTTTToSoSoSMMoSMMNNNNoSMMNNNNoSMMTTTTTTTTTTTTAAAAAAMMAAMMNNNNAAMMNNNNTTTTTTTTTTTTTTTToSoSoSMMoSMMNNNNoSMMNNNNoSMMTTTTTTTTTTTTAAAAAAMMAAMMNNNNAAMMNNNNTTTTTTTTTTTTTTTTAAAAAAMMAAMMNNNNAAMMNNNNTTTTTTTTTTTTTTTTAAAAAAMMAAMMNNNNAAMMNNNNTTTTTTTTTTTTTTTTAAAAAAMMAAMMNNNNAAMMNNNNTTTTTTTTTTTTTTTTAAAAAAMMAAMMNNNNAAMMNNNNTTTTTTTTTTTTTTTTAAAAAAMMAAMMNNNNAAMMNNNNTTTTTTTTTTTTTTTTAAAAAAMMAAMMNNNNAAMMNNNNTTTTTTTTTTTTTTTT";

const mk = (kind, n) => Array.from({ length: n }, (_, i) => ({ id: kind + ":" + i, kind, display: kind + " " + i }));

test("the caps are the database's: 13 in all, 3 areas, 10 states", () => { assert.deepEqual(CAPS, { total: 13, areas: 3, states: 10 }); });

test("every combination of kinds, remote and statement gives the verdict the design says (800 cases)", () => {
  let i = 0, got = "";
  for (const a of [0, 1, 2, 3, 4]) for (const b of [0, 1]) for (const c of [0, 1]) for (const s of [0, 1, 2, 10, 11]) for (const nat of [0, 1]) for (const remote of [true, false]) for (const attested of [true, false]) {
    const entries = [].concat(mk("place", a), mk("metro", b), mk("micro", c), mk("state", s), mk("nationwide", nat));
    const v = verdict(entries, remote, attested); got += v === "ok" ? "o" : v; i++;
  }
  assert.equal(i, 800); assert.equal(GRID.length, 800);
  assert.equal(got, GRID);
});

test("problems() puts each message under the input it belongs to", () => {
  assert.deepEqual(problems([], false, false), {});
  assert.deepEqual(problems(mk("place", 1), false, false), {});
  assert.deepEqual(problems(mk("place", 2), false, false), { attest: MESSAGES.S });
  assert.deepEqual(problems(mk("place", 2), false, true), {});
  assert.deepEqual(problems(mk("place", 4), false, true), { locpicker: MESSAGES.A });
  assert.deepEqual(problems(mk("state", 1), false, true), { locpicker: MESSAGES.M });
  assert.deepEqual(problems(mk("state", 1), true, false), {});          // one location needs no statement
  assert.ok(MESSAGES.A.includes("3") && MESSAGES.C.includes("10") && MESSAGES.T.includes("13"));
});

test("canAdd refuses what could never be valid, and lets the person add what only needs a tick", () => {
  assert.equal(canAdd(mk("place", 3), { id: "gn:9", kind: "place", display: "x" }, false).ok, false);           // a 4th area
  assert.equal(canAdd(mk("place", 3), { id: "st:TX", kind: "state", display: "Texas" }, true).ok, true);        // states are not areas
  assert.equal(canAdd(mk("state", 10), { id: "st:ZZ", kind: "state", display: "z" }, true).ok, false);         // an 11th state
  assert.equal(canAdd(mk("state", 1), { id: "us:all", kind: "nationwide", display: "United States (nationwide)" }, true).ok, false);
  assert.equal(canAdd(mk("nationwide", 1), { id: "st:TX", kind: "state", display: "Texas" }, true).ok, false);
  assert.equal(canAdd([], { id: "st:TX", kind: "state", display: "Texas" }, false).ok, false);                  // states need a remote role
  assert.equal(canAdd([], { id: "st:TX", kind: "state", display: "Texas" }, true).ok, true);
  const place = { id: "gn:1", kind: "place", display: "a" };
  assert.equal(canAdd([place], place, true).ok, false);                                                          // no duplicates
  assert.equal(canAdd([].concat(mk("place", 3), mk("state", 10)), { id: "gn:x", kind: "state", display: "y" }, true).ok, false);
});

test("the catalog module builds exactly the entries the database seed holds (same ids, same display text)", async () => {
  const cat = await loadCatalog();
  const seed = JSON.parse(fs.readFileSync(path.join(root, "data", "location-catalog-" + cat.version + ".json"), "utf8"));
  const rows = Array.isArray(seed) ? seed : seed.entries || seed.rows;
  assert.ok(Array.isArray(rows) && rows.length === cat.entries.length, "seed rows: " + (rows && rows.length) + ", picker entries: " + cat.entries.length);
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const e of cat.entries) { const r = byId.get(e.id); assert.ok(r, "missing from seed: " + e.id); assert.equal(e.display, r.display, e.id); assert.equal(e.kind, r.kind, e.id); }
  assert.equal(new Set(cat.entries.map((e) => e.id)).size, cat.entries.length);
  assert.equal(new Set(cat.entries.map((e) => e.display)).size, cat.entries.length);          // display is unique in the database, so the picker must be unambiguous too
  const kinds = {}; for (const e of cat.entries) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  assert.deepEqual(kinds, { state: 51, nationwide: 1, metro: 387, micro: 538, place: 7130 });
});

test("the shipped catalog files are the ones recorded in the manifest", async () => {
  const cat = await loadCatalog();
  const man = JSON.parse(fs.readFileSync(path.join(root, "data", "location-catalog-" + cat.version + ".manifest.json"), "utf8"));
  const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
  assert.equal(man.catalog_version, cat.version);
  assert.equal(sha(path.join(root, "data", "location-catalog-" + cat.version + ".json")), man.seed_sha256);
  assert.equal(sha(path.join(root, "js", "data", "locations-us.js")), man.module_sha256);
  assert.equal(man.counts.total, cat.entries.length);
});

test("search: what people type finds what they mean", async () => {
  const { entries } = await loadCatalog();
  const top = (q, remote = false, n = 1) => search(entries, q, { remote }).slice(0, n).map((e) => e.display);
  assert.deepEqual(top("austin tx"), ["Austin, TX"]);
  assert.equal(top("austin")[0], "Austin, TX");
  assert.ok(top("bronx", false, 3).includes("The Bronx, NY"));
  assert.equal(top("new york")[0], "New York City, NY");
  assert.equal(top("nyc")[0], "New York City, NY");
  assert.equal(top("sf")[0], "San Francisco, CA");
  assert.equal(top("philly")[0], "Philadelphia, PA");
  assert.equal(top("vegas")[0], "Las Vegas, NV");
  assert.equal(top("saint louis")[0], "St. Louis, MO");            // saint/st are the same word
  assert.equal(top("st louis")[0], "St. Louis, MO");
  assert.equal(top("ft worth")[0], "Fort Worth, TX");
  assert.equal(top("o'fallon")[0], "O'Fallon, MO");                 // punctuation ignored
  assert.equal(top("AUSTIN,  tx ")[0], "Austin, TX");               // case, spaces, commas
  assert.equal(top("hollywood")[0], "Hollywood, CA");               // a curated neighbourhood
  assert.ok(search(entries, "portland", {}).some((e) => e.kind === "metro"));      // metro areas are offered
  assert.equal(search(entries, "   ", {}).length, 0);
  assert.equal(search(entries, "zzzzqq", {}).length, 0);
  assert.equal(search(entries, "portland", { limit: 3 }).length, 3);
});

test("search: states and nationwide are offered only for a remote role; chosen entries are not offered again", async () => {
  const { entries } = await loadCatalog();
  assert.equal(search(entries, "texas", { remote: false }).some((e) => e.kind === "state"), false);
  assert.equal(search(entries, "united", { remote: false }).length, 0);
  assert.equal(search(entries, "texas", { remote: true })[0].display, "Texas");
  assert.equal(search(entries, "united states", { remote: true })[0].id, "us:all");
  const austin = search(entries, "austin tx", {})[0];
  assert.equal(search(entries, "austin tx", { selectedIds: [austin.id] }).some((e) => e.id === austin.id), false);
  assert.equal(normalize("Café  São-Paulo, TX"), "cafe sao paulo tx");
});

test("the form sends catalog ids, the statement only from two locations on, and never free text", () => {
  const A = { id: "gn:4671654", kind: "place", display: "Austin, TX" }, B = { id: "gn:4684888", kind: "place", display: "Dallas, TX" };
  const base = { title: "T", req: "1", company: "C", remote: false, closeout: "x", desc: "y" };
  const one = buildCreateBody(Object.assign({}, base, { locEntries: [A] }));
  assert.deepEqual(one.location_ids, [A.id]); assert.equal("locations_attested" in one, false); assert.equal("locations" in one, false);
  const two = buildCreateBody(Object.assign({}, base, { locEntries: [A, B], attested: true }));
  assert.deepEqual(two.location_ids, [A.id, B.id]); assert.strictEqual(two.locations_attested, true);
  assert.deepEqual(validateForm(Object.assign({}, base, { locEntries: [A, B], attested: false })), { attest: MESSAGES.S });
  assert.deepEqual(validateForm(Object.assign({}, base, { locEntries: [A, B], attested: true })), {});
  assert.deepEqual(validateForm(Object.assign({}, base, { locEntries: [], remote: false })), { locpicker: "Choose a location from the list, or tick Remote role." });
  assert.deepEqual(Object.keys(validateForm(Object.assign({}, base, { locEntries: mk("place", 4), attested: true }))), ["locpicker"]);
});

test("a refusal from the server about locations lands under the picker (or the statement box)", () => {
  assert.deepEqual(mapServerErrors({ errors: [{ field: "location_ids", message: "You can choose at most 3 cities or metro areas" }] }).byField, { locpicker: "You can choose at most 3 cities or metro areas" });
  assert.deepEqual(mapServerErrors({ errors: [{ field: "locations_attested", message: "confirm" }] }).byField, { attest: "confirm" });
  assert.deepEqual(mapServerErrors({ errors: [{ field: "locations", message: "choose from the list" }] }).byField, { locpicker: "choose from the list" });
  assert.deepEqual(mapServerErrors({ errors: [{ field: "is_remote", message: "states need remote" }] }).byField, { locpicker: "states need remote" });
});
