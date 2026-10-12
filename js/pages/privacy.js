// privacy.js - the privacy page has no logic of its own; it only mounts the shared account area in the top bar.
import { mountAccount } from "../app.js?v=627686d1";
import { $ } from "../dom.js?v=ff147636";

mountAccount($("#navAccount"));
