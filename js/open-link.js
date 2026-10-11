// open-link.js - the one word every row of links in the details window carries (prompt BG, October 10, 2026): "Open", then the standard external link icon, then text only a screen reader reads: "opens in a new tab".
// Every row that uses it really does open a new tab (window.open(address, "_blank", "noopener,noreferrer"), or the fallback link with target="_blank" rel="noopener noreferrer"); a row that opens nothing
// ("No link given") never gets the icon or the hidden text. The word and the icon are ONE unit that never breaks across lines (white-space: nowrap on .go-open in app.css).
// The icon is an inline SVG made with createElementNS (never HTML text), hidden from assistive technology.
import { h } from "./dom.js";

export const OPEN_WORD = "Open";
export const OPEN_HIDDEN = "opens in a new tab";
const SVG_NS = "http://www.w3.org/2000/svg";

export function externalIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  for (const [k, v] of [["viewBox", "0 0 24 24"], ["width", "14"], ["height", "14"], ["fill", "none"], ["stroke", "currentColor"], ["stroke-width", "2"], ["stroke-linecap", "round"], ["stroke-linejoin", "round"], ["aria-hidden", "true"], ["focusable", "false"], ["class", "go-icon"]]) svg.setAttribute(k, v);
  const path = document.createElementNS(SVG_NS, "path"); path.setAttribute("d", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6");
  const arrow = document.createElementNS(SVG_NS, "polyline"); arrow.setAttribute("points", "15 3 21 3 21 9");
  const line = document.createElementNS(SVG_NS, "line"); line.setAttribute("x1", "10"); line.setAttribute("y1", "14"); line.setAttribute("x2", "21"); line.setAttribute("y2", "3");
  svg.append(path, arrow, line);
  return svg;
}
// the unit: <span class="go-open">Open <svg aria-hidden/> <span class="sr-only"> opens in a new tab</span></span>
export const openUnit = () => h("span", { class: "go-open" }, OPEN_WORD, externalIcon(), h("span", { class: "sr-only" }, " " + OPEN_HIDDEN));
