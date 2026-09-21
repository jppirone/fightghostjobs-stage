# vendor/

Third-party code that ships with the site. Nothing is loaded from a CDN at runtime.

## auth-js.min.mjs  (sha256 `e56ca995973c19ad026c6c71963b48cac1834cf85eeb8859c084735a96495570`)

The Supabase Auth client (`@supabase/auth-js` 2.116.0, MIT, see AUTH-JS-LICENSE; it bundles `tslib` 2.8.1, 0BSD, see TSLIB-LICENSE), bundled into ONE browser ES module.

* Source: the npm tarball https://registry.npmjs.org/@supabase/auth-js/-/auth-js-2.116.0.tgz, whose published integrity
  `sha512-Cmosty12gyKGK9N3bQb+lMmuAFev5nmUzaR1AsmZHqKOAGzqX1VQzmp49CNPwOx/pw0H9Qqk4rs9yhwTlKpfDg==` was verified before bundling.
* Bundler: esbuild 0.28.2 (build tool only, never shipped):
  `esbuild auth-js.entry.js --bundle --format=esm --target=es2020 --platform=browser --legal-comments=none --minify --outfile=auth-js.min.mjs`
  (auth-js.entry.js is in this folder; it re-exports GoTrueClient and the error classes.)
* Audited: no `eval` / `new Function`, no hard-coded network endpoints (only a docs URL inside a warning string), so it runs under this site's Content-Security-Policy (`script-src 'self'`).
* To upgrade: repeat the steps above with the new version, update this file, and re-run `node tests/run-all.js` (it re-hashes this file against the value recorded in tests/vendor-hash.txt).
