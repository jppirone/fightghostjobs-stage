// analytics-model.js - the pure display logic behind the Analytics page (pass 24): the date-range menu, the three breakdown charts, and the thin-data threshold.
// Every COUNT here comes straight from employer-analytics (already re-validated by api.js); this file only turns those counts into percentages, bar widths and labels. Pure (no DOM): tested in Node.

const DAY_MS = 86400000;

export const RANGE_OPTIONS = [["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["365", "Last 12 months"]];
export const DEFAULT_RANGE_DAYS = 30;

// -> { from, to } as ISO-8601 instants: [now - days, now). nowMs is injectable so tests are deterministic.
export function rangeToDates(days, nowMs) {
  const n = Number(days);
  const to = new Date(nowMs);
  const from = new Date(nowMs - (Number.isFinite(n) && n > 0 ? n : DEFAULT_RANGE_DAYS) * DAY_MS);
  return { from: from.toISOString(), to: to.toISOString() };
}

// a share of registry activity is either a percentage or "not enough platform data yet" (never a fabricated 0% or 100%; see pass24-migration.sql)
export function sharePctLabel(pct) {
  return typeof pct === "number" && Number.isFinite(pct) ? pct + "%" : "Not enough platform data yet";
}

// click-through = detail views that led to a link click, i.e. link_clicks / detail_views. null (not 0%) when there were no detail views to divide by.
export function clickThroughPct(detailViews, linkClicks) {
  if (!Number.isInteger(detailViews) || detailViews <= 0) return null;
  return Math.round((100 * Math.max(0, linkClicks || 0)) / detailViews);
}
export function clickThroughLabel(detailViews, linkClicks) {
  const pct = clickThroughPct(detailViews, linkClicks);
  return pct === null ? "—" : pct + "%";
}

// a bar's width relative to the largest value in its group (the mock's own convention: the top row reads 100%, the rest scale under it). 0 when there is nothing to compare.
export function barWidthPct(value, max) {
  if (!(max > 0) || !(value > 0)) return 0;
  return Math.max(2, Math.min(100, Math.round((100 * value) / max)));      // a sliver (2%) stays visible for a real but tiny value, instead of rendering as nothing
}

const VIA_LABEL = { phrase: "Company name + job title", code: "Company name + postID (from a job ad)", req: "Company name + req number" };
const VIA_ORDER = ["phrase", "code", "req"];

// by_search_mode ({via: count}) -> [{ key, label, count, pct }], sorted by count desc (ties keep VIA_ORDER), pct of the sum of all three modes (0 when nothing searched this range)
export function searchModeBreakdown(byMode) {
  const total = VIA_ORDER.reduce((s, k) => s + (Number.isInteger(byMode?.[k]) ? byMode[k] : 0), 0);
  return VIA_ORDER.map((k) => ({ key: k, label: VIA_LABEL[k], count: Number.isInteger(byMode?.[k]) ? byMode[k] : 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || VIA_ORDER.indexOf(a.key) - VIA_ORDER.indexOf(b.key))
    .map((r) => ({ ...r, pct: total > 0 ? Math.round((100 * r.count) / total) : 0 }));
}

// by_link -> the rows for "Destination link performance", sorted by clicks desc (server already sorts this way; re-sorted here defensively), with each row's bar width relative to the top link
export function linkBreakdown(byLink) {
  const rows = Array.isArray(byLink) ? byLink.slice().sort((a, b) => b.clicks - a.clicks) : [];
  const max = rows.length ? rows[0].clicks : 0;
  return rows.map((l) => ({ ...l, widthPct: barWidthPct(l.clicks, max) }));
}

// true when there is too little platform-wide activity in the range for the numbers to mean much (the page must say so plainly instead of showing a misleadingly bare chart)
export const THIN_DATA_THRESHOLD = 20;
export function isThinData(platformActivityTotal) {
  return !Number.isInteger(platformActivityTotal) || platformActivityTotal < THIN_DATA_THRESHOLD;
}
