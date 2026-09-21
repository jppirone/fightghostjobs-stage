# fightghostjobs-stage

The **staging** site for FightGhostJobs, served at https://stage.fightghostjobs.com/. It is the real front end wired to the real backend (Supabase project `tpmvkjuhbbwftqoodzcn`), used to try everything end to end before the public launch.
The public-launch repo (`fightghostjobs-alpha`, alpha.fightghostjobs.com) is separate and is not touched by this one.

Plain HTML, CSS and ES modules. **No build step, no framework, no CDN**: what is in this repo is exactly what is served.

## Pages

| Page | Who | What it does |
|---|---|---|
| `index.html` | everyone | landing page |
| `search.html` | verified candidates | company + job title (or req code) lookup, posting details, destination links; sign-in by emailed link |
| `employer-signin.html` | employers | "invitation only" copy and the emailed sign-in link request (roster-gated on the server) |
| `register.html` | employers (signed in) | register a posting: create, then publish (standard tier) |
| `auth-callback.html` | both | where the emailed link lands; sorts out which kind of session it got |
| `404.html` | | not found |

Pages still to come, in this order: employer "My postings" + edit, close a posting, candidate comments, team (roster), import.

## How it is put together

* `js/config.js` – the only place the browser learns where the backend is. The publishable key in it is **public by design**; it holds no secret and must never be replaced by one.
* `js/api.js` – every call to the backend, in one place. Checks each answer against the exact shape the pages rely on and **fails closed** (an unexpected answer is reported, never rendered). Runs unchanged in Node, which is how it is tested.
* `js/session.js` – the sign-in session (Supabase Auth, emailed one-time link, no passwords). Employer sessions carry `poster_id`, candidate sessions `candidate_identity_id`; the server checks the token again on every call.
* `js/dom.js` – the only way text reaches the page (`textContent`); there is **no `innerHTML` anywhere**, because posting titles and comments are written by strangers.
* `vendor/` – the Auth client, bundled from the audited npm package (see `vendor/README.md`); `tests/vendor-hash.txt` pins its hash.
* `styles.css` is the reference design's stylesheet (plus self-hosted fonts); `app.css` holds only what the reference did not have.

## Security rules that are enforced by a program (`tests/site-check.js`)

Content-Security-Policy on every page (scripts only from this site; the only network destination is the project's API), `noindex` everywhere, no inline script / handler / `javascript:` URL, no `innerHTML` / `eval` / `document.write`,
every import and local link resolves, nothing loaded from another host, no secret anywhere (and the publishable key only in `js/config.js`), the vendored client matches its recorded hash, new-tab links carry `noopener`.

## Checks

```
node tests/run-all.js      # or: npm test
```

Runs the unit and API tests, the static site rules, and 35 deliberate defects that each rule must catch. Needs Node 20+ and nothing else (no install step).

The live end-to-end suite (`web-e2e.js`) needs the project's secret key and lives with the backend tooling, not in this repo.

## Deploying

GitHub Pages, from the `main` branch root. `CNAME` holds the staging domain. Before magic links work on a new origin, that origin must be listed under **Supabase → Authentication → URL Configuration → Redirect URLs** (`https://stage.fightghostjobs.com/**`), and the backend's CORS allow-list must contain it (it does).
