// location-rules.js - the location rules the picker enforces BEFORE anything is sent. Pure (no DOM): tested in Node, and against the same 800-case grid as the backend's independent model.
// These MIRROR the database trigger enforce_posting_locations, which is the authority (the backend refuses anything that breaks them, whatever this page did; tests/site-check.js keeps the numbers in step):
//   * at most 13 locations in all;  at most 3 "areas" (a city/town, a metro area or a micro area);  at most 10 states
//   * states and "United States (nationwide)" only on a REMOTE role;  "nationwide" never together with individual states
//   * two or more locations of any kind require the statement that this is ONE opening that can be filled from any of them (one posting = one real opening)
export const CAPS = { total: 13, areas: 3, states: 10 };
const AREA_KINDS = ["place", "metro", "micro"];

// entries: [{ id, kind, display }]
export function tally(entries) {
  const t = { n: entries.length, areas: 0, states: 0, nat: 0 };
  for (const e of entries) { if (AREA_KINDS.includes(e.kind)) t.areas += 1; else if (e.kind === "state") t.states += 1; else if (e.kind === "nationwide") t.nat += 1; }
  return t;
}

// One letter, in the same precedence the backend uses: T too many, N nationwide with states, M states need remote, C too many states, A too many areas, S attestation missing, "ok".
export function verdict(entries, remote, attested) {
  const t = tally(entries);
  if (t.n === 0) return "ok";
  if (t.n > CAPS.total) return "T";
  if (t.nat > 0 && t.states > 0) return "N";
  if ((t.states > 0 || t.nat > 0) && !remote) return "M";
  if (t.states > CAPS.states) return "C";
  if (t.areas > CAPS.areas) return "A";
  if (t.n >= 2 && !attested) return "S";
  return "ok";
}

export const MESSAGES = {
  T: "You can choose at most " + CAPS.total + " locations.",
  N: "\"United States (nationwide)\" cannot be combined with individual states: choose one or the other.",
  M: "States and \"United States (nationwide)\" can only be chosen for a remote role. Tick \"Remote role\", or remove them.",
  C: "You can choose at most " + CAPS.states + " states. For more than that, choose \"United States (nationwide)\" instead.",
  A: "You can choose at most " + CAPS.areas + " cities or metro areas. One posting is one opening: register separate openings separately.",
  S: "Confirm that this is one opening that can be filled from any of these locations.",
};

// -> { locpicker?: text, attest?: text }  (the input ids the messages belong under)
export function problems(entries, remote, attested) {
  const v = verdict(entries, remote, attested);
  if (v === "ok") return {};
  return v === "S" ? { attest: MESSAGES.S } : { locpicker: MESSAGES[v] };
}

// Would adding `entry` to `entries` break a cap or a rule that the person cannot fix by ticking a box? -> { ok: true } | { ok: false, reason }
export function canAdd(entries, entry, remote) {
  if (entries.some((e) => e.id === entry.id)) return { ok: false, reason: "already chosen" };
  const next = entries.concat([entry]); const t = tally(next);
  if (t.n > CAPS.total) return { ok: false, reason: MESSAGES.T };
  if (t.nat > 0 && t.states > 0) return { ok: false, reason: MESSAGES.N };
  if (t.states > CAPS.states) return { ok: false, reason: MESSAGES.C };
  if (t.areas > CAPS.areas) return { ok: false, reason: MESSAGES.A };
  if ((entry.kind === "state" || entry.kind === "nationwide") && !remote) return { ok: false, reason: MESSAGES.M };
  return { ok: true };
}
