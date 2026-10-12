// kio-block.js - the employer's ID block (prompt BQ, October 12, 2026): the opening's KIO ID, its short link and the lines to put in a job ad, each with a button that copies it. Shown on the opening's page and on the
// page that confirms a new opening, for every status including a draft (the ID exists from the moment the opening is saved). It is text, never a field: nothing in it can be edited.
//   kioBlock(stored, { live, win, idAttr }) -> a node.   stored: the postID the server sent (the KIO ID in its stored form, or an old 12 character code, which has no short link and no ad lines).
//   live: whether the short link is live (js/config.js KIO_SHORT_LINK_LIVE): while false the ad lines carry only the "KIO ID:" line.
import { h } from "./dom.js?v=ff147636";
import { displayId, shortLinkOf, adLines, isKioShown } from "./kio.js?v=80867368";
import { KIO_SHORT_LINK_LIVE } from "./config.js?v=9bf25cae";

export const COPY_FAILED = "Copying did not work in this browser. Select the text and copy it yourself.";

// copies text to the clipboard: the modern call first, then the old command on a hidden field. -> true when it worked
export async function copyText(text, win = window) {
  try {
    if (win.navigator && win.navigator.clipboard && typeof win.navigator.clipboard.writeText === "function") { await win.navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through to the old way */ }
  try {
    const doc = win.document, ta = doc.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.setAttribute("aria-hidden", "true"); ta.style.position = "fixed"; ta.style.top = "-1000px";
    doc.body.append(ta); ta.select();
    const ok = doc.execCommand && doc.execCommand("copy");
    ta.remove();
    return ok === true;
  } catch { return false; }
}

// idAttr: the id of the element that holds the ID text; idClass: its class (the confirmation page gives it the big "code-box" look)
export function kioBlock(stored, { live = KIO_SHORT_LINK_LIVE, win = window, idAttr = "postId", idClass = "mono kio-value" } = {}) {
  const shown = displayId(stored);
  const isKio = isKioShown(shown);
  const say = h("span", { class: "sr-only", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  const copyButton = (label, what, text) => {
    const b = h("button", { type: "button", class: "btn btn-outline btn-sm kio-copy", "data-copy": what }, label);
    b.addEventListener("click", async () => {
      const ok = await copyText(text, win);
      b.textContent = ok ? "Copied" : "Not copied";
      say.textContent = ok ? what === "id" ? "The ID was copied." : what === "link" ? "The short link was copied." : "The job ad lines were copied." : COPY_FAILED;
      if (!ok) b.title = COPY_FAILED;
      win.setTimeout(() => { b.textContent = label; say.textContent = ""; }, 2500);
    });
    return b;
  };
  const rows = [
    h("div", { class: "kio-row" },
      h("span", { class: "kio-label" }, "KIO ID"),
      h("span", { class: idClass, id: idAttr }, shown),
      isKio ? copyButton("Copy ID", "id", shown) : null),
  ];
  if (isKio) {
    const link = shortLinkOf(shown);
    rows.push(h("div", { class: "kio-row" },
      h("span", { class: "kio-label" }, "Short link"),
      h("span", { class: "mono kio-value", id: "kioShortLink" }, link),
      copyButton("Copy link", "link", link)));
    const lines = adLines(shown, live);
    rows.push(h("div", { class: "kio-ad" },
      h("div", { class: "kio-label" }, "Lines for your job ad"),
      h("div", { class: "kio-adlines mono", id: "kioAdLines" }, lines.map((l) => h("div", { class: "kio-adline" }, l))),
      copyButton("Copy these lines", "ad", lines.join("\n"))));
    rows.push(h("p", { class: "kio-note" }, "Put these lines in the job ad. Candidates can look the opening up with the ID. The ID never changes."));
  }
  return h("div", { class: "kio-block", id: "kioBlock" }, ...rows, say);
}
