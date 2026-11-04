// privacy.js - the privacy page has no logic of its own; it only mounts the shared account area in the top bar.
import { mountAccount } from "../app.js?v=251de542";
import { $ } from "../dom.js?v=5c78a8cd";

mountAccount($("#navAccount"));
