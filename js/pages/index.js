// index.js - the landing page is static; the only live part is the top-bar account area.
import { mountAccount } from "../app.js?v=6906dc3e";
import { $ } from "../dom.js?v=5c78a8cd";
import { wireInfoIcons } from "../info-icon.js?v=c3fb7b2b";
import { COMMENTS_VISIBLE } from "../config.js?v=cb962576";

wireInfoIcons();
if (!COMMENTS_VISIBLE) { const c = $("#cardComments"); if (c) c.hidden = true; }   // the example card's Comments link follows the one comments switch (js/config.js)
mountAccount($("#navAccount"));
