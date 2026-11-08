// copy-reader.js - copies the phone reader of the browser extension into js/mobile/ (prompt IB, November 3, 2026). Nobody edits a copy by hand: to take a new reader, change MANIFEST below to the new manifest of the Extension Dev
// (tag, commit and the three SHA-256 values) and run  node tests/copy-reader.js  then the page tests.
// It reads the three files ONLY through  git show <tag>:<path>  in the extension repository (read only: no checkout, no branch change, nothing is written there), checks the tag still points at the commit of the manifest and that each file
// hashes to the manifest value, writes the copies with the folder layout of the extension (so no import line changes: mobile-reader/reader.js imports ../extractor.js and ../kio.js, extractor.js imports ./kio.js), writes
// js/mobile/FROM-EXTENSION.txt, and runs the version marker stamping tool (tests/stamp-versions.js) so the copies carry their ?v= markers like every other module.
// Not copied, on purpose: address.js, page.js, index.html, page.css and any picture reader.
// This file lives in tests/ (not in a tools folder): the repository is served whole by Pages, and everything outside tests/ is judged by the site rules.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const EXTENSION_REPO = process.env.FGJ_EXTENSION_REPO || path.resolve(ROOT, "..", "fightghostjobs", "extension");
// the manifest of the Extension Dev (prompt JC, fgx-jc-reader-v3-manifest.txt, November 7, 2026; before: prompt HY, reader-v1): the hashes are of the git show output (line breaks LF)
export const MANIFEST = {
  tag: "reader-v3",
  commit: "de03a113a57bf7a3de3b02454f1a308f211332ae",
  files: [
    { from: "mobile-reader/reader.js", to: "js/mobile/mobile-reader/reader.js", sha256: "f33a3fb3f9419ca4863a4b5366b2fc07bda6c88777dc34c90ffbaf83329be0c6" },
    { from: "extractor.js", to: "js/mobile/extractor.js", sha256: "f1c430a9406a36f4a829a39676abd92a2ea2e909b097107c2377df0c9c6978a5" },
    { from: "kio.js", to: "js/mobile/kio.js", sha256: "b15a133164cbb81490656aab01a0e5a7b5e91f18d051daa1110b0cbdbe367dfc" },
  ],
};
export const NOTE_FILE = "js/mobile/FROM-EXTENSION.txt";
export const MARKER = /\?v=[0-9a-f]{8}(?=["'`])/g;
// the hash of a copy or a source: no version markers, no carriage returns (a Windows checkout may turn the line breaks into CR LF)
export const sha256 = (text) => crypto.createHash("sha256").update(Buffer.from(String(text).replace(MARKER, "").replace(/\r/g, ""), "utf8")).digest("hex");

export function gitShow(repo, spec) {
  const r = spawnSync("git", ["-C", repo, "show", spec], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  if (r.status !== 0) throw new Error("git show " + spec + " failed in " + repo + ": " + String(r.stderr || "").trim().slice(0, 200));
  return r.stdout;
}
export function tagCommit(repo, tag) {
  const r = spawnSync("git", ["-C", repo, "rev-parse", tag + "^{commit}"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

export function noteText(date) {
  return [
    "These files are copies of the phone reader of the browser extension. Nobody edits them by hand.",
    "To take a new reader: change MANIFEST in tests/copy-reader.js to the new manifest, run  node tests/copy-reader.js  and then the page tests.",
    "tag: " + MANIFEST.tag,
    "commit: " + MANIFEST.commit,
    "copied on: " + date,
    ...MANIFEST.files.map((f) => "sha256 " + f.from + ": " + f.sha256),
    "(each hash is of the file with its version markers and carriage returns removed, which is also the hash of the extension file at the tag)",
    "",
  ].join("\n");
}

export function copyReader({ repo = EXTENSION_REPO, root = ROOT, date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10), stamp = true } = {}) {
  const tip = tagCommit(repo, MANIFEST.tag);
  if (tip !== MANIFEST.commit) throw new Error("the tag " + MANIFEST.tag + " is at " + tip + ", the manifest says " + MANIFEST.commit + ": nothing was copied");
  const texts = MANIFEST.files.map((f) => {
    const t = gitShow(repo, MANIFEST.tag + ":" + f.from);
    if (sha256(t) !== f.sha256) throw new Error(f.from + " at the tag does not hash to the manifest value: nothing was copied");
    return t;
  });
  MANIFEST.files.forEach((f, i) => { const p = path.join(root, f.to); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, texts[i]); });
  fs.writeFileSync(path.join(root, NOTE_FILE), noteText(date));
  if (stamp) {
    const r = spawnSync(process.execPath, [path.join(root, "tests", "stamp-versions.js")], { cwd: root, encoding: "utf8" });
    if (r.status !== 0) throw new Error("the stamping tool failed: " + String(r.stdout || r.stderr).slice(0, 300));
  }
  return MANIFEST.files.map((f) => f.to);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { for (const f of copyReader()) console.log("copied " + f); console.log("wrote " + NOTE_FILE + " and stamped the version markers"); }
  catch (e) { console.error(e.message); process.exit(1); }
}
