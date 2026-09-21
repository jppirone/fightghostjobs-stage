// index.js - the landing page is static; the only live part is the top-bar account area.
import { mountAccount } from "../app.js";
import { $ } from "../dom.js";

mountAccount($("#navAccount"));
