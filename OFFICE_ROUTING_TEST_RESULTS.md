# Nurse Memo combined Office routing — local checks

- JavaScript/TypeScript syntax: **146 files passed** (`npm run check`).
- Relative module resolution: **151 JS/MJS/HTML files passed** (`npm run imports`).
- Local regression suite: **291 total, 290 passed, 0 failed, 1 skipped** (`npm test`).
- Combined Office routing-specific tests: **6 passed**, including simulated upstream preparation and release verification for `PAGES_BASE_PATH=/` and `/nursememo/`.
- Upstream ONLYOFFICE source pinned to revision `beb7e2fd6c2eada4c4ff21e94ac37d5c39a79fc0` by default.
- Nested SDK filename suffix `"/index.html"` is preserved; real frame `web-apps/apps/documenteditor/main/index.html` is required to exist.
- One integrated GitHub Pages deployment artifact, serving the editor under `<siteBase>/office/`.

**Skipped test:** `manager-docx-generation.test.mjs` requires the `docx` npm package, which is installed by the GitHub Actions workflow. CI runs that test with `DOCX_VERIFY_GENERATION=1` so it cannot silently skip there. `npm install` and the full Vite/upstream builds were not available locally in this environment. The actual 600 MB upstream editor is compiled by GitHub Actions. The combined published site and live Supabase functions require browser testing after deployment.
