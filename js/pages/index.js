// index.js - the landing page is static; the only live part is the top-bar account area.
import { mountAccount } from "../app.js";
import { $ } from "../dom.js";
import { wireInfoIcons } from "../info-icon.js";
import { COMMENTS_VISIBLE } from "../config.js";

wireInfoIcons();
if (!COMMENTS_VISIBLE) { const c = $("#cardComments"); if (c) c.hidden = true; }   // the example card's Comments link follows the one comments switch (js/config.js)
mountAccount($("#navAccount"));
