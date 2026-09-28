// analytics.js - the employer's own analytics dashboard (pass 24). An employer sees only their own six metrics: everything here comes from one call,
// employer-analytics, which the server scopes to the signed-in session's organization -- this page never asks for, stores, or displays anyone else's numbers.
// "Unmatched company-intent searches" (the sixth metric in the original brief) is not shown here: it is not computed yet (see pass24-migration.sql for why).

import { api, requirePoster, mountAccount, go, signOut, describeError, isAuthFailure } from "../app.js";
import { rememberNext } from "../session.js";
import { $, h, clear, alertBox } from "../dom.js";
import { waitText, plural } from "../format.js";
import { statusChip } from "../dashboard-model.js";
import { DEFAULT_RANGE_DAYS, rangeToDates, sharePctLabel, clickThroughPct, clickThroughLabel, searchModeBreakdown, linkBreakdown, isThinData } from "../analytics-model.js";

const state = { rangeDays: DEFAULT_RANGE_DAYS };

async function sessionEnded() { await signOut(); rememberNext("analytics.html", "poster"); go("employer-signin.html?reason=expired"); }

function failureText(err) {
  if (err.code === "rate_limited") return "Too many requests just now. Try again in " + waitText(err.retryAfter || 30) + ".";
  return describeError(err, { what: "Your analytics" });
}

function kpiCard(label, value, sub, caveat) {
  return h("div", { class: "kpi" },
    h("div", { class: "lbl" }, label),
    h("div", { class: "num" }, value),
    sub ? h("div", { style: "font-size:12px;color:var(--muted);margin-top:8px;" }, sub) : null,
    caveat ? h("div", { style: "font-size:11px;color:var(--faint);margin-top:6px;line-height:1.4;" }, caveat) : null);
}

// this metric only ever sees a click on the link WE gave the candidate: it is not a proxy for "applied" and it cannot see an application made any other way. Shown directly on the card, not a footnote.
const LINK_CLICK_CAVEAT = "Reflects activity on the link shown here, not a complete picture of where candidates applied. A candidate may have applied elsewhere without our visibility.";

function renderKpis(d) {
  const box = $("#kpiRow"); clear(box);
  box.append(
    kpiCard("Live postings", String(d.live_postings)),
    kpiCard("Searches that found you", String(d.searches)),
    kpiCard("Posting detail views", String(d.detail_views)),
    kpiCard("Destination link clicks", String(d.link_clicks), clickThroughLabel(d.detail_views, d.link_clicks) === "—" ? null : clickThroughLabel(d.detail_views, d.link_clicks) + " of viewers clicked through", LINK_CLICK_CAVEAT),
    kpiCard("Share of registry traffic", sharePctLabel(d.share_of_registry_pct), "Of all searches + detail views on the registry"),
  );
}

function postingRow(p) {
  const chip = statusChip(Object.assign({}, p, { bump_used: false }), Date.now());
  const ct = clickThroughLabel(p.detail_views, p.link_clicks);
  const w = clickThroughPct(p.detail_views, p.link_clicks) || 0;
  return h("tr", {},
    h("td", { style: "font-weight:600;" }, p.title, h("div", { style: "font-size:12px;font-weight:400;color:var(--muted);margin-top:3px;" }, h("span", { class: "status " + chip.cls, style: "padding:2px 8px;font-size:11px;" }, chip.text))),
    h("td", {}, String(p.searches)),
    h("td", {}, String(p.detail_views)),
    h("td", {}, String(p.link_clicks)),
    h("td", { style: "width:160px;" }, ct === "—" ? h("span", { style: "color:var(--faint);" }, "—") :
      h("div", { style: "display:flex;align-items:center;gap:8px;" },
        h("div", { class: "bar-track", style: "width:80px;" }, h("div", { class: "bar-fill", style: "width:" + w + "%;" })),
        h("span", { style: "font-size:13px;font-weight:600;" }, ct))));
}

function renderPostingTable(byPosting) {
  const body = $("#postingRows"); clear(body);
  const empty = $("#postingEmpty");
  if (byPosting.length === 0) {
    empty.hidden = false; clear(empty); empty.append("No postings recorded any activity in this date range.");
    $("#postingTable").hidden = true;
    return;
  }
  $("#postingTable").hidden = false; empty.hidden = true;
  for (const p of byPosting) body.append(postingRow(p));
}

function breakdownRow(label, count, pct, alt) {
  return h("div", {},
    h("div", { style: "display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px;" }, h("span", {}, label), h("span", { style: "font-weight:700;" }, count)),
    h("div", { class: "bar-track" }, h("div", { class: alt ? "bar-fill-alt" : "bar-fill", style: "width:" + pct + "%;" })));
}

function renderSearchModes(byMode) {
  const rows = searchModeBreakdown(byMode);
  const card = $("#modeCard"), empty = $("#modeEmpty");
  clear(card);
  if (rows.length === 0) { card.hidden = true; empty.hidden = false; clear(empty); empty.append("No searches matched one of your postings in this date range."); return; }
  card.hidden = false; empty.hidden = true;
  for (const r of rows) card.append(breakdownRow(r.label, r.pct + "%", r.pct, false));
}

function renderLinks(byLink) {
  const rows = linkBreakdown(byLink);
  const card = $("#linkCard"), empty = $("#linkEmpty");
  clear(card);
  if (rows.length === 0) { card.hidden = true; empty.hidden = false; clear(empty); empty.append("No destination link clicks recorded in this date range."); return; }
  card.hidden = false; empty.hidden = true;
  for (const l of rows) card.append(breakdownRow((l.source_label || (l.kind === "recruiter" ? l.firm_name : null) || "Untitled link"), plural(l.clicks, "click", "clicks"), l.widthPct, true));
}

function renderThinData(d) {
  const note = $("#thinDataNote");
  if (isThinData(d.platform_activity_total)) {
    note.hidden = false; clear(note);
    note.append(alertBox("notice", "Registry-wide activity is still limited in this date range, so the numbers above (especially share of registry traffic) may swing a lot from one period to the next. This will settle down as more candidates use the registry."));
  } else note.hidden = true;
}

async function load() {
  const box = $("#pageAlert"); box.hidden = true; clear(box);
  $("#loadNote").textContent = "Loading your analytics…";
  const { from, to } = rangeToDates(state.rangeDays, Date.now());
  const r = await api.employerAnalytics(from, to);
  if (!r.ok) {
    if (isAuthFailure(r.error)) return sessionEnded();
    $("#loadNote").textContent = "";
    box.hidden = false; box.append(alertBox("error", failureText(r.error) + " "), h("button", { type: "button", class: "btn btn-outline btn-sm", style: "margin-top:10px;", onclick: load }, "Try again"));
    return;
  }
  const d = r.data;
  renderKpis(d);
  renderPostingTable(d.by_posting);
  renderSearchModes(d.by_search_mode);
  renderLinks(d.by_link);
  renderThinData(d);
  $("#loadNote").textContent = "";
}

$("#rangeSelect").addEventListener("change", (ev) => { state.rangeDays = Number(ev.target.value) || DEFAULT_RANGE_DAYS; load(); });

(async () => {
  const ctx = await requirePoster("analytics.html");
  if (!ctx) return;
  await mountAccount($("#navAccount"), { cta: false });
  if (!ctx.info) { $("#pageAlert").hidden = false; $("#pageAlert").append(alertBox("error", describeError(ctx.error) + " Reload the page to try again.")); return; }
  $("#orgName").textContent = ctx.info.organization.name;
  await load();
})();
