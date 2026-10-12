// kio-receive.js - the page that RECEIVES a short link (prompt BQ, October 12, 2026). 404.html is what GitHub Pages serves for any path this site has no file for, so an address such as
//   https://<this site>/KIO-7K3M-9Q2X-W4T9
// lands here. When the path is a KIO ID that passes the check, the browser is sent on to the search page with the ID in the fragment (search.html#k=KIO7K3M9Q2XW4T9): the page fills the ID box and the person presses Search, as
// with the extension. Nothing is searched here, nothing is sent anywhere, no company or title is known. A path that has the shape of an ID but fails the check says so; every other path keeps the page's usual words.
// What John configures for the short address knowitsopen.com (a 301 to this site's /<ID> path) is in the BQ report; until it is done the receiving page works for the site's own address.
import { kioFromPath, looksLikeKio } from "./kio.js?v=80867368";

const stored = kioFromPath(location.pathname);
if (stored !== null) {
  location.replace("/search.html#k=" + stored);
} else {
  let seg = "";
  try { seg = decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, "")); } catch { seg = ""; }
  const note = document.getElementById("notFoundText");
  if (seg !== "" && looksLikeKio(seg) && note) {
    const h = document.querySelector("h1");
    if (h) h.textContent = "That ID is not valid";
    note.textContent = "That ID is not valid. Check it and try again.";
  }
}
