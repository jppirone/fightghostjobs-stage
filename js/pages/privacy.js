// privacy.js - the privacy page has no logic of its own; it only mounts the shared account area in the top bar.
import { mountAccount } from "../app.js";
import { $ } from "../dom.js";

mountAccount($("#navAccount"));
