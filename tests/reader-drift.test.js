// reader-drift.test.js - the phone reader copied from the browser extension (js/mobile/, prompt IB, November 3, 2026) has not been edited by hand and still matches the extension.
//   Part 1 (always): each copy, with its version markers (and carriage returns) removed, hashes to the value written in js/mobile/FROM-EXTENSION.txt, and the note names the same tag, commit and files as tests/copy-reader.js.
//   Part 2 (when the extension repository is at its usual path, or at FGJ_EXTENSION_REPO): each manifest hash equals the hash of the same file at the tag, and the tag still points at the commit of the manifest. When the repository is not there
//   the output SAYS so and only part 1 counts; it is never skipped silently.
// Run: node --test tests/reader-drift.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, EXTENSION_REPO, MANIFEST, NOTE_FILE, sha256, gitShow, tagCommit } from "./copy-reader.js";

const MESSAGE = "the extension reader changed: copy it again with tools/copy-reader.js and run the page tests";
const note = () => fs.readFileSync(path.join(ROOT, NOTE_FILE), "utf8");
const noteHash = (text, from) => { const m = text.match(new RegExp("^sha256 " + from.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&") + ": ([0-9a-f]{64})$", "m")); return m ? m[1] : null; };

test("part 1: every copy hashes to the value in FROM-EXTENSION.txt (nobody edited a copy by hand)", () => {
  const n = note();
  assert.ok(n.includes("tag: " + MANIFEST.tag + "\n") && n.includes("commit: " + MANIFEST.commit + "\n"), "FROM-EXTENSION.txt must name the tag and the commit of the manifest in tests/copy-reader.js");
  for (const f of MANIFEST.files) {
    const p = path.join(ROOT, f.to);
    assert.ok(fs.existsSync(p), f.to + " is missing: run node tests/copy-reader.js");
    assert.equal(noteHash(n, f.from), f.sha256, "FROM-EXTENSION.txt holds another hash for " + f.from + " than the manifest in tests/copy-reader.js");
    assert.equal(sha256(fs.readFileSync(p, "utf8")), f.sha256, f.to + " is not the file of the tag any more (a copy was edited by hand, or the copy tool was not run): run node tests/copy-reader.js");
  }
  // only these three files are copied: none of the extension's page files may be in js/mobile/
  const names = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else names.push(path.relative(path.join(ROOT, "js", "mobile"), p).split(path.sep).join("/")); } };
  walk(path.join(ROOT, "js", "mobile"));
  assert.deepEqual(names.sort(), ["FROM-EXTENSION.txt", "extractor.js", "kio.js", "mobile-reader/reader.js"], "js/mobile/ holds files that are not the three copies and the note");
});

test("part 2: the extension at the tag still matches the manifest (when the extension repository is present)", (t) => {
  if (!fs.existsSync(path.join(EXTENSION_REPO, ".git")) && !fs.existsSync(EXTENSION_REPO)) {
    console.log("DRIFT PART 2 NOT RUN: the extension repository is not at " + EXTENSION_REPO + " (set FGJ_EXTENSION_REPO). Only part 1 counted.");
    return;
  }
  const tip = tagCommit(EXTENSION_REPO, MANIFEST.tag);
  assert.equal(tip, MANIFEST.commit, MESSAGE + " (the tag " + MANIFEST.tag + " is at " + tip + ", the manifest says " + MANIFEST.commit + ")");
  for (const f of MANIFEST.files) assert.equal(sha256(gitShow(EXTENSION_REPO, MANIFEST.tag + ":" + f.from)), f.sha256, MESSAGE + " (" + f.from + ")");
  console.log("DRIFT PART 2 RAN: tag " + MANIFEST.tag + " at " + tip.slice(0, 8) + ", three hashes equal");
});
