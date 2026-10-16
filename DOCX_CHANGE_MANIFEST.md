# DOCX branch change manifest

Baseline: `Nurse_Memo_Complete_Landscape_Editor_Repository.zip`. No changes to Ward, Maintenance, login or roster business logic.

- Added: **7** files.
- Updated: **17** files.
- Removed: **1** files.

## Added

- `DOCX_BRANCH_SETUP.md`
- `documents/docx-bytes.js`
- `documents/manager-docx.js`
- `editor/manager-ranuts.js`
- `supabase/patches/20261016_manager_docx_database.sql`
- `tests/manager-docx-branch.test.mjs`
- `tests/manager-docx-generation.test.mjs`

## Updated

- `.github/workflows/deploy-pages.yml`
- `MANAGER_DOCUMENT_EDITOR.md`
- `README.md`
- `css/manager-document.css`
- `data/index.js`
- `data/repositories/manager-memo-repository.js`
- `domain/manager-memo.js`
- `manager.html`
- `manager.js`
- `package.json`
- `pages/manager-page.js`
- `supabase/schema.sql`
- `tests/manager-full-document-editor.test.mjs`
- `tests/manager-history-lifecycle.test.mjs`
- `tests/manager-landscape-layout.test.mjs`
- `tests/manager-lifecycle-hardening.test.mjs`
- `tests/print-entrypoint.test.mjs`

## Removed

- `editor/manager-jodit.js`

## Verification

`npm run verify`: 282 passing, 0 failing, 1 skipped (real DOCX packaging requires the npm dependency). The real packaging test is mandatory in the `docx-editor-test` GitHub Actions workflow after `npm install`. No live Supabase RPC, hosted iframe or Vite build verification was available locally.
