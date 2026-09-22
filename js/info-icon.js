// info-icon.js - the small "i" tooltips. The stylesheet shows a tooltip on mouse-over and on keyboard focus; this adds the third way, a tap or click,
// which is the only one a touch screen has. One open at a time; Escape closes it.
import { $$ } from "./dom.js";

export function wireInfoIcons(root = document) {
  const icons = $$(".info-icon", root);
  const closeAll = (except) => { for (const i of icons) if (i !== except) { i.classList.remove("open"); i.setAttribute("aria-expanded", "false"); } };
  for (const icon of icons) {
    icon.setAttribute("role", "button"); icon.setAttribute("aria-expanded", "false");
    if (!icon.getAttribute("aria-label")) icon.setAttribute("aria-label", "What this means");
    icon.addEventListener("click", (ev) => { ev.preventDefault(); const open = !icon.classList.contains("open"); closeAll(icon); icon.classList.toggle("open", open); icon.setAttribute("aria-expanded", open ? "true" : "false"); });
    icon.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { icon.classList.remove("open"); icon.setAttribute("aria-expanded", "false"); } else if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); icon.click(); } });
  }
  document.addEventListener("click", (ev) => { if (!icons.some((i) => i.contains(ev.target))) closeAll(null); });
  return icons.length;
}
