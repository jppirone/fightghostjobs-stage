// roster.test.js - the Team page's pure logic (js/roster-model.js) and the roster answers the page accepts.
import test from "node:test";
import assert from "node:assert/strict";
import { checkAdd, successorChoices, actionsFor, mapRosterError, MAX_ROSTER } from "../js/roster-model.js";
import { shapes, createApi } from "../js/api.js";

const ID1 = "3f1d5b1e-0000-4000-8000-000000000001", ID2 = "3f1d5b1e-0000-4000-8000-000000000002", ID3 = "3f1d5b1e-0000-4000-8000-000000000003";
const row = (o) => Object.assign({ poster_id: ID1, full_name: "Ann", email: "ann@acme.example", is_org_admin: true, status: "active", added_at: "2026-09-01T00:00:00Z", first_signin_at: null, last_verified_at: null }, o || {});

test("adding a person: a work email and a name are required, trimmed; the admin flag is a plain boolean", () => {
  const ok = checkAdd(" bob@acme.example ", "  Bob Lee ", true); assert.equal(ok.ok, true); assert.deepEqual(ok.body, { email: "bob@acme.example", full_name: "Bob Lee", is_org_admin: true });
  assert.equal(checkAdd("bob@acme.example", "Bob", "yes").body.is_org_admin, false);
  assert.ok(checkAdd("", "Bob").errors.email); assert.ok(checkAdd("not an address", "Bob").errors.email); assert.ok(checkAdd("bob@acme.example", " ").errors.name); assert.ok(checkAdd("bob@acme.example", "x".repeat(121)).errors.name);
});

test("row actions: never remove yourself here; the last admin cannot be demoted; a member can be promoted", () => {
  const me = row(), other = row({ poster_id: ID2, full_name: "Bob", is_org_admin: false }), admin2 = row({ poster_id: ID3, full_name: "Cy" });
  assert.deepEqual(actionsFor(me, ID1, [me, other]), []);                                  // the only admin, and it is me
  assert.deepEqual(actionsFor(other, ID1, [me, other]), ["remove", "promote"]);
  assert.deepEqual(actionsFor(admin2, ID1, [me, other, admin2]), ["remove", "demote"]);      // two admins: this one can be demoted
  assert.deepEqual(actionsFor(me, ID1, [me, other, admin2]), ["demote"]);
  assert.deepEqual(successorChoices([me, other, admin2], ID2).map((p) => p.poster_id), [ID1, ID3]);
});

test("refusals in words: every code the roster functions answer with", () => {
  for (const c of ["cannot_add", "roster_full", "last_admin", "successor_required", "forbidden", "not_found", "rate_limited"]) assert.ok(mapRosterError({ code: c }).length > 20, c);
  assert.match(mapRosterError({ code: "roster_full" }), new RegExp(String(MAX_ROSTER)));
  assert.equal(mapRosterError({ code: "server_error" }), null); assert.equal(mapRosterError({ code: "x", message: "m" }), "m");
});

test("the roster answers the page accepts, and only those", () => {
  assert.equal(shapes.roster({ posters: [row(), row({ poster_id: ID2, status: "invited", is_org_admin: false })] }), true);
  assert.equal(shapes.roster({ posters: [] }), true);
  assert.equal(shapes.roster({ posters: [row({ status: "removed" })] }), false); assert.equal(shapes.roster({ posters: [row({ email: null })] }), false); assert.equal(shapes.roster({}), false);
  assert.equal(shapes.rosterAdded({ poster_id: ID2, status: "invited" }), true); assert.equal(shapes.rosterAdded({ poster_id: ID2, status: "active" }), false);
  assert.equal(shapes.rosterRemoved({ removed: true, transferred: 2 }), true); assert.equal(shapes.rosterRemoved({ transferred: "2" }), false);
  assert.equal(shapes.rosterAdmin({ changed: false }), true); assert.equal(shapes.rosterAdmin({}), false);
});

test("the roster calls send exactly the documented bodies (never an identity)", async () => {
  const calls = []; const api = createApi({ baseUrl: "https://x.example", key: "k", getToken: async () => "T", fetchImpl: async (url, init) => { calls.push([url.split("/").pop(), JSON.parse(init.body)]); return { ok: true, status: 200, headers: new Map(), text: async () => JSON.stringify({ posters: [], poster_id: ID2, status: "invited", transferred: 0, changed: true }) }; } });
  await api.rosterList(); await api.rosterAdd({ email: "b@acme.example", full_name: "B", is_org_admin: false }); await api.rosterRemove(ID2, null); await api.rosterRemove(ID2, ID3); await api.rosterSetAdmin(ID2, true);
  assert.deepEqual(calls, [["poster-roster-list", {}], ["poster-roster-add", { email: "b@acme.example", full_name: "B", is_org_admin: false }], ["poster-roster-remove", { target_poster_id: ID2 }], ["poster-roster-remove", { target_poster_id: ID2, successor_poster_id: ID3 }], ["poster-roster-set-admin", { target_poster_id: ID2, is_org_admin: true }]]);
  assert.equal(JSON.stringify(calls).includes("organization_id"), false);
});
