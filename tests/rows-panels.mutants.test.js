// rows-panels.mutants.test.js - negative controls for the recruiter firms rows and the AI and hiring policy link row (prompts BC and BC1, October 10, 2026): each deliberate defect below is put into a COPY of the page code
// (js\) and the unit tests of the rows (tests/rows-panels.unit.test.js, tests/policy-link.unit.test.js, tests/linkpanel.test.js) must then FAIL. A defect that leaves them passing is MISSED and this file fails.
// Nothing here touches the real files. Run: node --test tests/rows-panels.mutants.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TESTS = ["rows-panels.unit.test.js", "policy-link.unit.test.js", "linkpanel.test.js"];

// [label, file, text to find (must occur once), text instead]
const MUTANTS = [
  ["Check link is drawn for a firm that has no address", "js/firm-panel.js", "canCheck: (row) => row.hasAddress,", "canCheck: () => true,"],
  ["Check link is drawn when no policy link is stored", "js/policy-link.js", "  if (!l) return [];\n  const c = l.check_status;", "  if (!l) return [{ position: 1, title: POLICY_TITLE, status: \"unchecked\", http: null, shownAs: null }];\n  const c = l.check_status;"],
  ["a firm's Edit changes an application link", "js/firm-panel.js", "runEdit: (row, change) => api.editRecruiterFirm(ctx.getPostingId(), row.position, change),", "runEdit: (row, change) => api.editDestinationLink(ctx.getPostingId(), row.position, change),"],
  ["the policy link's Edit changes an application link", "js/policy-panel.js", "runEdit: (row, change) => api.setPolicyLink(ctx.getPostingId(), change.url),", "runEdit: (row, change) => api.editDestinationLink(ctx.getPostingId(), 1, { url: change.url }),"],
  ["Edit replaces every firm (the whole-set call is used)", "js/firm-panel.js", "runEdit: (row, change) => api.editRecruiterFirm(ctx.getPostingId(), row.position, change),", "runEdit: (row, change) => api.setRecruiterFirms(ctx.getPostingId(), [{ name: change.name || row.name }]),"],
  ["a firm's Remove takes out an application link", "js/firm-panel.js", "runRemove: (row) => api.removeRecruiterFirm(ctx.getPostingId(), row.position),", "runRemove: (row) => api.removeDestinationLink(ctx.getPostingId(), row.position),"],
  ["Remove removes every firm (the whole-set call with none)", "js/firm-panel.js", "runRemove: (row) => api.removeRecruiterFirm(ctx.getPostingId(), row.position),", "runRemove: () => api.setRecruiterFirms(ctx.getPostingId(), []),"],
  ["the policy link's Remove takes out a firm", "js/policy-panel.js", "runRemove: () => api.setPolicyLink(ctx.getPostingId(), null),", "runRemove: () => api.removeRecruiterFirm(ctx.getPostingId(), 1),"],
  ["a firm's Check link asks for an application link", "js/firm-panel.js", "runCheck: (row) => api.checkRecruiterFirm(ctx.getPostingId(), row.position),", "runCheck: (row) => api.checkDestinationLink(ctx.getPostingId(), row.position),"],
  ["the policy link's Check link asks for an application link", "js/policy-panel.js", "runCheck: () => api.checkPolicyLink(ctx.getPostingId()),", "runCheck: () => api.checkDestinationLink(ctx.getPostingId(), 1),"],
  ["a firm's address is put on the page (in the row title)", "js/firm-panel-model.js", "title: firmTitle(x.position, x.firm),", "title: firmTitle(x.position, x.firm) + \" \" + (x.url || \"\"),"],
  ["the policy link's address is put on the page (in the row title)", "js/policy-link.js", "return [{ position: 1, title: POLICY_TITLE,", "return [{ position: 1, title: POLICY_TITLE + \" \" + (l.url || \"\"),"],
  ["the edit box is given the address", "js/row-panel.js", "const addr = h(\"input\", { type: \"text\", inputmode: \"url\", maxlength: \"2048\", autocomplete: \"off\",", "const addr = h(\"input\", { type: \"text\", value: \"https://stored.example/\", inputmode: \"url\", maxlength: \"2048\", autocomplete: \"off\","],
  ["the policy link is counted toward the ten destination links", "js/api.js", "n[l && l.kind === \"recruiter\" ? \"recruiter\" : l && l.kind === \"policy\" ? \"policy\" : \"apply\"]++;", "n[l && l.kind === \"recruiter\" ? \"recruiter\" : \"apply\"]++;"],
  ["the policy link is among the application links", "js/edit-form.js", "filter((x) => x.kind === undefined || x.kind === \"apply\")", "filter((x) => x.kind !== \"recruiter\")"],
  ["the policy link is sent to the Apply path (the candidate's application links include it)", "js/policy-link.js", "(Array.isArray(links) ? links : []).filter((x) => x && x.kind !== \"policy\")", "(Array.isArray(links) ? links : []).filter((x) => !!x)"],
  ["the limit of three firms is removed", "js/firm-panel-model.js", "x.position > 3 ||", "x.position > 30 ||"],
  ["a firm without a name is accepted by the edit form", "js/firm-panel-model.js", "if (name === \"\") errors.second = FP.NAME_REQUIRED;", "if (false) errors.second = FP.NAME_REQUIRED;"],
  ["the answer of a firm change may carry an address key", "js/api.js", "firmRow: (l) => isObj(l) && Object.keys(l).every((k) => LINK_ROW_KEYS.includes(k)) &&", "firmRow: (l) => isObj(l) &&"],
];

const childEnv = () => { const e = { ...process.env }; delete e.NODE_TEST_CONTEXT; return e; };
function copy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-rows-mut-"));
  fs.cpSync(path.join(ROOT, "js"), path.join(dir, "js"), { recursive: true });
  fs.mkdirSync(path.join(dir, "tests"));
  for (const f of [...TESTS, "fake-dom.js"]) fs.copyFileSync(path.join(ROOT, "tests", f), path.join(dir, "tests", f));
  fs.copyFileSync(path.join(ROOT, "package.json"), path.join(dir, "package.json"));
  return dir;
}
const run = (dir) => spawnSync(process.execPath, ["--test", ...TESTS.map((f) => path.join(dir, "tests", f))], { encoding: "utf8", env: childEnv() });

test("the unmodified copy passes the unit tests of the rows (so a failure below is the defect)", () => {
  const dir = copy();
  try { const r = run(dir); assert.equal(r.status, 0, r.stdout.slice(-1500)); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

for (const [label, file, from, to] of MUTANTS) {
  test("control: " + label, () => {
    const dir = copy();
    try {
      const p = path.join(dir, ...file.split("/"));
      const src = fs.readFileSync(p, "utf8");
      const n = src.split(from).length - 1;
      assert.equal(n, 1, "the text to damage must be in " + file + " exactly once (found " + n + "): " + from.slice(0, 70));
      fs.writeFileSync(p, src.replace(from, () => to), "utf8");
      const r = run(dir);
      assert.notEqual(r.status, 0, "MISSED: the unit tests still pass with this defect");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}
