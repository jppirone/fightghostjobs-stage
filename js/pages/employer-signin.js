// employer-signin.js - asks for an emailed one-time sign-in link for an employer.
// Two steps, in this order (the backend requires it): (1) poster-login-intent records "this address is about to sign in" (a 10-minute consent stamp; it answers the same 202 whether or not the address is
// on any roster, so this page can never be used to find out who is a customer); (2) the Auth service emails the link. The page never says whether the address is on a roster either.

import { api, mountAccount, go, describeError } from "../app.js";
import { requestLink, currentSession, watchOtherTabSignIn, rememberedNext, confirmEmailCode } from "../session.js";
import { CODE_ENABLED, mountCodeEntry } from "../code-entry.js";
import { $, h, clear, alertBox } from "../dom.js";
import { waitText } from "../format.js";

mountAccount($("#navAccount"), { cta: false });

const REASONS = {
  signin: ["notice", "Sign in to continue."],
  expired: ["notice", "Your session ended. Please sign in again."],
  notposter: ["error", "That sign-in was not an employer sign-in. Employer access is by invitation: ask your organization's admin to add your work email address, then request a new link here."],
};
const reason = REASONS[new URLSearchParams(location.search).get("reason")];
if (reason) { const b = $("#banner"); b.hidden = false; b.append(alertBox(reason[0], reason[1])); }

const form = $("#form"), input = $("#email"), send = $("#send"), errorEl = $("#emailError"), sent = $("#sent");
let stopWatch = null;   // stops the "signed in in another tab" watch when the code typed here finishes the sign-in

(async () => {
  const s = await currentSession();
  if (!(s && s.isPoster)) {
    // the emailed link opens in a NEW tab: when the sign-in is completed there, this tab moves on by itself (no reload) to where a signed-in employer goes
    stopWatch = watchOtherTabSignIn(() => go(rememberedNext() || "register.html"), (x) => x.isPoster);
  }
  if (s && s.isPoster) {
    form.hidden = true;
    const box = $("#already"); box.hidden = false;
    box.append(h("h2", { style: "font-size:22px;font-weight:700;margin-bottom:8px;" }, "You are already signed in"),
      h("p", { style: "font-size:14px;line-height:1.6;color:var(--muted);margin:0 0 18px 0;" }, "This browser already has an employer session."),
      h("a", { class: "btn btn-dark", href: "register.html" }, "Continue →"));
  }
})();

const fieldError = (text) => { errorEl.hidden = !text; errorEl.textContent = text || ""; input.setAttribute("aria-invalid", text ? "true" : "false"); };

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const email = input.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) { fieldError("Enter your work email address."); return; }
  fieldError("");
  send.disabled = true; const label = send.textContent; send.textContent = "Sending…";
  try {
    const intent = await api.posterLoginIntent(email);
    if (!intent.ok) {
      fieldError(intent.error.code === "rate_limited" ? "Too many sign-in attempts. Try again in " + waitText(intent.error.retryAfter || 60) + "." : describeError(intent.error));
      return;
    }
    // a page that sent the person here to sign in (rememberNext) is where they come back to; otherwise the employer area
    const r = await requestLink(email, "poster", rememberedNext() || "register.html");
    if (!r.ok) {
      fieldError(r.status === 429 || /rate|seconds|after/i.test(r.message) ? "A sign-in email was just sent to this address or too many were requested. Wait a minute and try again." : "We could not send the email. Please try again in a moment.");
      return;
    }
    form.hidden = true; sent.hidden = false; clear(sent);
    sent.append(h("h2", { style: "font-size:22px;font-weight:700;margin-bottom:8px;" }, "Check your email"),
      h("p", { style: "font-size:14px;line-height:1.6;color:var(--muted);margin:0 0 12px 0;" }, "If this address belongs to an organization on FightGhostJobs, a sign-in link is on its way. Open it in the next 10 minutes."),
      h("p", { style: "font-size:13px;line-height:1.6;color:var(--faint);margin:0;" }, "Nothing arrived? Check spam, then ask your organization's admin to confirm your address is on your roster."));
    // the same email carries a short code: typed here it finishes the sign-in in THIS tab. The page then does what the emailed link's landing page does (auth-callback.js, which explains a session that is not an employer's) without its "you can close this tab" note
    if (CODE_ENABLED) { const host = $("#signCode"); clear(host); host.hidden = false; mountCodeEntry({ host, email, confirm: confirmEmailCode, hint: "No need to open the link. The code is 6 digits, works once, and must be used within 10 minutes.", onDone: () => { if (stopWatch) { stopWatch(); stopWatch = null; } go("auth-callback.html?via=code"); }, onStartOver: () => { clear(host); host.hidden = true; clear(sent); sent.hidden = true; form.hidden = false; input.focus(); } }); }
  } finally {
    send.disabled = false; send.textContent = label;
  }
});
