// auth-callback.js - where the emailed sign-in link lands. The Auth client (see session.js) reads the session out of the URL fragment on start-up and stores it;
// this page then works out WHICH kind of session it got and sends the person on. An employer-intent link that did not produce an employer session (the address is not on a roster,
// or the 10-minute consent window had passed) is explained, never silently treated as a candidate sign-in.

import { api, go, signOut, describeError, posterInfo, forgetLocalState } from "../app.js";
import { currentSession, takeNext } from "../session.js";
import { $, h, clear } from "../dom.js";

const hashError = (() => {
  // read BEFORE the Auth client tidies the fragment away
  const p = new URLSearchParams(location.hash.replace(/^#/, ""));
  return p.get("error") ? { code: p.get("error_code") || p.get("error"), text: p.get("error_description") || "" } : null;
})();

const title = $("#title"), message = $("#message"), actions = $("#actions");
function say(t, m, buttons) {
  title.textContent = t; message.textContent = m; clear(actions);
  for (const b of buttons || []) actions.append(b);
}
const link = (text, href, cls = "btn btn-dark") => h("a", { class: cls, href }, text);
const button = (text, fn, cls = "btn btn-ghost") => h("button", { type: "button", class: cls, onclick: fn }, text);

(async () => {
  const { next, kind: askedFor } = (() => { const t = takeNext(""); return { next: t.next, kind: t.kind }; })();

  if (hashError) {
    const expired = /expired|invalid|used/i.test(hashError.code + " " + hashError.text);
    say(expired ? "That link has expired" : "We could not sign you in",
      expired ? "Sign-in links work once and expire quickly. Request a new one." : "Something went wrong with that link. Request a new one.",
      [link(askedFor === "candidate" ? "Back to search" : "Employer sign-in", askedFor === "candidate" ? "search.html" : "employer-signin.html")]);
    return;
  }

  const session = await currentSession();
  if (!session) {
    say("Nothing to complete here", "This page finishes an email sign-in. Request a sign-in link first.", [link("Employer sign-in", "employer-signin.html"), link("Search postings", "search.html", "btn btn-outline")]);
    return;
  }

  // What did they ask to sign in as? (Missing when the link was opened on a different device: fall back on what the session actually is.)
  const wantsPoster = askedFor === "poster" || (askedFor === "" && session.isPoster && !session.isCandidate);

  if (wantsPoster) {
    if (!session.isPoster) {
      say("Signed in, but not as an employer",
        "The link worked, but this email address is not an active member of an organization's roster (or the sign-in request had expired). Employer access is by invitation. Ask your organization's admin to add your work email address, then request a new link.",
        [link("Try again", "employer-signin.html"), button("Continue as a candidate", () => go("search.html")), button("Sign out", async () => { await signOut(); go("index.html"); })]);
      return;
    }
    forgetLocalState();
    const r = await posterInfo(session, { fresh: true });
    if (!r.ok) {
      say("Signed in, but your access could not be confirmed", r.error.code === "unauthorized" ? "Your organization membership is not active. Ask your organization's admin." : describeError(r.error),
        [link("Employer sign-in", "employer-signin.html"), button("Sign out", async () => { await signOut(); go("index.html"); })]);
      return;
    }
    say("Signed in", "Welcome, " + r.data.poster.full_name + ".", []);
    go(next || "register.html");
    return;
  }

  // candidate
  if (!session.isCandidate) {
    say("Signed in, but not as a verified candidate", "This session is an employer session. Sign out to search as a candidate with a different email address.",
      [button("Sign out", async () => { await signOut(); go("search.html"); }), link("Back", "register.html", "btn btn-outline")]);
    return;
  }
  say("Email verified", "You can search now.", []);
  go(next || "search.html");
})();
