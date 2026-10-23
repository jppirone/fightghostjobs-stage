// privacy.js - the privacy page has no logic of its own; it only mounts the shared account area in the top bar.
import { mountAccount } from "../app.js?v=b05cf5b9";
import { $ } from "../dom.js?v=5c78a8cd";

mountAccount($("#navAccount"));
