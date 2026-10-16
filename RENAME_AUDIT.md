# Nurse Memo — Branding-only correction and audit

**No Supabase changes are needed for this release.** The updated copy was rebuilt from the original uploaded ZIP. The previous rename package should NOT be uploaded.

## Verified change boundary

- Original files: 154; revised files: 157.
- Modified existing files: 18; new files: 4; replaced/removed old document paths: 1; byte-identical existing files: 135.
- Every file under `supabase/` is **byte-for-byte identical** to the original uploaded repository.
- The identity mapping, stored session keys, print settings/storage keys, demo data format, audit namespace, role/account bootstrap and demo account IDs are unchanged.
- Product branding was changed in page/browser titles, app headers, login role label, loading/print text, package metadata and deployment workflow.
- Clinical report names **PM Memo** and **Night Memo** are retained, as are their titles and data schema values.
- Login ID `NightMaintenance` is a technical account identifier, **not** product branding. It stays unchanged to preserve the current Supabase Auth users.
- The existing `legacy-*` CSS naming describes the UI style, not the old product name. It stays unchanged to avoid unnecessary CSS rewrites.
- Supabase Auth identity module original SHA-256: `5cce730c74cf89fc72b3ab72bd140ba6aeb1d2123eb52139b1c15ccc4c834a9b`. Revised file hash is identical.
- Supabase SQL schema original SHA-256: `86cb7cdf197b365e8c1202d72688e59e2bbaf4f0036e6f1ba994d2f508520724`. Revised file hash is identical.

## Test results

`npm run verify` passed: **241 tests, 0 failures**, including four added name/compatibility tests. The source/import checks also passed. Vite production build was not executed locally because dependencies were not installed in the original ZIP.

## Changed files (18)

- `.github/workflows/deploy-pages.yml`
- `config.js`
- `index.html`
- `maintenance.html`
- `manager-template.html`
- `manager.html`
- `package.json`
- `pages/login-page.js`
- `pages/maintenance-page.js`
- `pages/maintenance-test-data.js`
- `pages/manager-page.js`
- `pages/ward-page.js`
- `print.html`
- `print.js`
- `tests/auth-login-performance.test.mjs`
- `tests/login-entry-ui.test.mjs`
- `ward-print.js`
- `ward.html`

## Added files (4)

- `NURSE_MEMO_DEMO_ACCOUNTS.md`
- `README.md`
- `RENAME_AUDIT.md`
- `tests/nurse-memo-branding.test.mjs`

## Old file to delete

- `NIGHT_MEMO_DEMO_ACCOUNTS.md`

## Installation

Upload the contents of the **Changed Files Only** archive into the existing GitHub repository, preserving folder paths; delete `NIGHT_MEMO_DEMO_ACCOUNTS.md` after uploading its renamed replacement. **Do not run Supabase SQL, change accounts/passwords, update Edge Functions, or switch Supabase projects** for this branding change.
