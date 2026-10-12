// johns-screen.js - the test setup that matches John's real screen (prompt BP, October 11, 2026), shared by the browser tests of My openings.
// Facts measured in prompt BP (Step 1e): the test browser is Chrome for Windows (headless) and has the same site fonts as a real Chrome (Work Sans and Space Grotesk are the site's own files, font-src 'self'), and its
// page has the classic 15 pixel scroll bar. What was NOT the same as John's screen was the width in CSS pixels (his table looked like a window of about 1000 to 1100 CSS pixels, with two pairs of action words, the
// date broken from its time and a 98 pixel row), so the tests ask for a window of the width John reads (1354), a page with a classic bar, the fonts loaded, AND 5 percent less (1289), plus 1366 and 1100.
//   johnsBrowser()                  -> a browser with overlay scroll bars turned off (a classic 15 pixel bar, the way a real Windows Chrome draws it)
//   await johnsWindow(tab, width)   -> sets the window; -> { inner, client, bar }: the page's real bar width (innerWidth - clientWidth), so a test can confirm the bar is classic
//   johnsRows(extra)                -> fake-site options with the rows of the My openings tests
//   MEASURE                         -> the page expression that reads the table
import { launchBrowser } from "./cdp-tabs.js";

export const JOHN_WIDTH = 1354, SPARE_WIDTH = Math.round(1354 / 1.05), BAR = 15;
export const johnsBrowser = () => launchBrowser({ args: ["--disable-features=OverlayScrollbar"] });
export async function johnsWindow(tab, width, height = 900) {
  await tab.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await tab.send("Emulation.setTouchEmulationEnabled", { enabled: false });
}
export const barOf = (tab) => tab.eval("({ inner: window.innerWidth, client: document.documentElement.clientWidth, bar: window.innerWidth - document.documentElement.clientWidth })");

export const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();
// the rows: the BN rows (a remote opening with a typed place and an extended close date, a long title, an expired draft with its note, a closed one, a scheduled draft, a draft with a Publish by line),
// John's Junior Project Manager (four list places), and the rows that carry the flag: a live opening closing in 3 days, a draft with 5 days left of its window, a paused one closing in 4 days
export function johnsRows(now = Date.now()) {
  return {
    plan: "verified",
    mineOverrides: [
      { title: "Associate Product Manager", is_remote: true, locations: [], location_ids: [], source_location_text: "Paris, France", bump_used: true, bump_days: 15 },   // live, closes in 33 days
      { title: "Nurse Practitioner Specialist, Evenings and Weekends" },                                                                                                    // paused, closes in 9 days
      {}, {}, {},                                                                                                                                                          // scheduled, draft, expired
    ],
    mineExtra: [
      { title: "Junior Project Manager", is_remote: true, locations: ["Boston, MA", "Providence, RI", "Springfield, MA", "Worcester, MA"], location_ids: [] },
      { title: "Expired Draft Opening", status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: iso(now - 3 * DAY), created_at: iso(now - 17 * DAY) },
      { title: "Closed Opening", status: "closed", stored_status: "closed", closed_reason: "filled", expiration_date: iso(now + 5 * DAY) },
      { title: "Closing In Three Days", status: "live", stored_status: "live", expiration_date: iso(now + 3 * DAY + 3600000), created_at: iso(now - 30 * DAY) },
      { title: "Draft Near The End", status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: iso(now + 5 * DAY + 3600000), created_at: iso(now - 9 * DAY) },
      { title: "Paused Closing In Four Days", status: "paused", stored_status: "paused", expiration_date: iso(now + 4 * DAY + 3600000), created_at: iso(now - 12 * DAY) },
      { title: "Closing Past Seven Days", status: "live", stored_status: "live", expiration_date: iso(now + 7 * DAY + 23 * 3600000), created_at: iso(now - 25 * DAY) },       // 7 days and 23 hours: just outside the flag (a constant of 8 would flag it)
    ],
  };
}

// what the table looks like right now (a page expression). Every row: its height, the lines of its action words and of its Closes value, the widths of the Actions and Closes cells and their spare room.
export const MEASURE = `(() => {
  const card = document.querySelector('.card.flush'), cr = card.getBoundingClientRect();
  const ths = Array.from(document.querySelectorAll('thead th')).map((t) => ({ name: t.textContent.trim().replace(/\\s+/g, ' '), w: Math.round(t.getBoundingClientRect().width) }));
  const tops = (els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size;
  const spare = (cell, sel) => { const kids = Array.from(cell.querySelectorAll(sel)).filter((k) => !k.closest('.act-note')); if (!kids.length) return null; const r = cell.getBoundingClientRect(), pad = parseFloat(getComputedStyle(cell).paddingRight) + parseFloat(getComputedStyle(cell).paddingLeft); const used = Math.max(...kids.map((k) => k.getBoundingClientRect().right)) - r.left - parseFloat(getComputedStyle(cell).paddingLeft); return { cellW: Math.round(r.width), contentW: Math.round(r.width - pad), usedW: Math.round(used) }; };
  const rows = Array.from(document.querySelectorAll('tbody tr')).map((tr) => {
    const c = (l) => tr.querySelector('td[data-label="' + l + '"]');
    const act = c('Actions'), clo = c('Closes'), title = c('Title');
    const words = Array.from(act.children).filter((e) => e.classList.contains('row-action'));
    const lefts = words.map((w) => w.getBoundingClientRect());
    const note = act.querySelector('.act-note'), nr = note ? note.getBoundingClientRect() : null;
    return { title: title.firstChild.textContent.trim(), h: Math.round(tr.getBoundingClientRect().height), words: words.map((w) => ({ t: w.textContent.trim(), left: Math.round(lefts[words.indexOf(w)].left), right: Math.round(lefts[words.indexOf(w)].right), top: Math.round(lefts[words.indexOf(w)].top), h: Math.round(lefts[words.indexOf(w)].height), lines: w.getClientRects().length })),
      actLines: tops(words), closesLines: tops(Array.from(clo.querySelectorAll('.nb'))), closes: Array.from(clo.querySelectorAll('.nb')).map((e) => ({ t: e.textContent.trim(), top: Math.round(e.getBoundingClientRect().top), lines: e.getClientRects().length })),
      closesText: clo.querySelector('.dt') ? clo.querySelector('.dt').textContent.replace(/\\s+/g, ' ').trim() : clo.innerText.replace(/\\s+/g, ' ').trim(), flag: (clo.querySelector('[data-part="flag"]') || {}).textContent || '',
      placeLine: (title.querySelector('[data-part="place"]') || {}).textContent || null, addedLine: (title.querySelector('[data-part="added"]') || {}).textContent || null,
      actSpare: spare(act, '.row-action'), closesSpare: spare(clo, '.nb'), note: nr ? { w: Math.round(nr.width), h: Math.round(nr.height) } : null, cells: Array.from(tr.querySelectorAll('td')).map((td) => td.getAttribute('data-label')) };
  });
  return { inner: window.innerWidth, client: document.documentElement.clientWidth, cardW: Math.round(cr.width), cardRight: Math.round(cr.right), sideScroll: card.scrollWidth > card.clientWidth + 1,
    pageScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, ths, rows, lastTh: Math.round(document.querySelector('thead th:last-child').getBoundingClientRect().right),
    pills: Array.from(document.querySelectorAll('#filters .filter-pill')).map((b) => b.textContent.trim() + (b.classList.contains('on') ? '*' : '')) };
})()`;
