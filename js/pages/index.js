// index.js - the landing page is static; the only live part is the top-bar account area.
import { mountAccount } from "../app.js?v=b3915a14";
import { $ } from "../dom.js?v=ff147636";
import { wireInfoIcons } from "../info-icon.js?v=66958a58";
import { COMMENTS_VISIBLE } from "../config.js?v=f3dc1a31";

wireInfoIcons();
if (!COMMENTS_VISIBLE) { const c = $("#cardComments"); if (c) c.hidden = true; }   // the example card's Comments link follows the one comments switch (js/config.js)
mountAccount($("#navAccount"));
