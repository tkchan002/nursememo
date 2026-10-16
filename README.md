# Nurse Memo

This repository is the **Nurse Memo** demo application. The product name was updated from Night Memo; **PM Memo** and **Night Memo** continue to identify the two reporting types.

## Branding and UI consolidation

The existing Supabase project requires **no SQL migration, schema reload, Edge Function redeployment, or account recreation** for this UI update. The entire `supabase/` directory is unchanged compared with the source ZIP.

The old internal identifiers are intentionally retained because they are part of the existing application contract, not user-visible branding:

- Supabase Auth emails still use `@accounts.nightmemo.example.com`.
- The maintenance demo login ID is still `NightMaintenance`.
- PM/Night import format: `night-memo-pm-night-v1`.
- Audit setting: `nightmemo.audit_explicit`.
- Existing browser storage keys use `nightMemo...` names.
- The `legacy-*` CSS classes and variables refer to the existing UI style, and have not been renamed.

These technical names are safe to retain even though the application is called Nurse Memo. Changing them would be a separate identity/data migration, not a branding update.

## Deploy

Upload the changed files while preserving their folder paths. This repository retains the previous account and database contracts. For the UI naming update, remove the obsolete visual-adapter CSS and test files listed in the accompanying replacement-package instructions; simply uploading renamed files does not delete their predecessors on GitHub. No Supabase actions are required.

Run `npm run verify` to run code checks, imports, and tests. Run `npm install` then `npm run build` to generate `dist/` for hosting if dependencies are available.

The GitHub Pages URL depends on the GitHub repository name. Changing the app title does not automatically change the repository URL or GitHub Pages address.

See `NURSE_MEMO_DEMO_ACCOUNTS.md` for expected test credentials (not an export of real passwords).

## UI consolidation

The Ward, Manager, Maintenance, Login and print-preview chrome use a consolidated, independently authored clinical visual system. Common tab and button styling is owned by `css/theme.css`; Ward, Manager, Maintenance and Login keep their page-specific layouts in their respective CSS files. Old inline Ward styles/event attributes and redundant visual rules have been removed.

See [`UI_CONSOLIDATION_REPORT.md`](UI_CONSOLIDATION_REPORT.md) for the complete change inventory, supported exceptions, verification results and limitations.

See [UI_STYLE_GUIDE.md](UI_STYLE_GUIDE.md) for the neutral stylesheet layout.

## October 2026 readability and Manager printing update

The shared screen font sizes have been increased, Manager Ward List and Runner List have an in-page print preview, and Maintenance shows the generated Auth email when editing an account. The disposable demo Manager login now accepts `patrol` without requiring immediate Supabase account recreation. See [RELEASE_NOTES_2026-10-16.md](RELEASE_NOTES_2026-10-16.md) for the test-only login fallback and deployment caveats.


## Night Memo whole-document editor (October 2026)

The Manager Night Memo uses Jodit 4.13.9 (MIT licensed) with a Nurse Memo-authored compact clinical toolbar. To install dependencies locally, run `npm install`, then `npm run verify` and `npm run build`. GitHub Actions installs dependencies automatically.

The entire generated Night Memo—heading, tables, notes, CT summary and signature—is edited as one document. Saving, History, recovery and printing use a single `{ "version": 4, "html": "..." }` document JSON value. Ward source snapshots remain separate. **Old version 3 demo Night Memos are not readable by the new editor**; use Start New on the current reporting night to generate a fresh document. No Supabase schema migration is needed because memo documents are already stored as JSONB.

Regenerate from Ward Data replaces the entire document **only after confirmation and a safety checkpoint**. Manual edits are not silently merged or overwritten. Rich formatting, tables, merged cells, lists, colour, paragraph alignment and text styles are supported. Direct image/file uploads are intentionally disabled in this demo; no file storage backend is configured. Actual DOCX import/export and exact Microsoft Word pagination are not provided.

The original eHR/CKEditor scripts, icons, CSS and assets are not used; the toolbar arrangement is recreated with Jodit's MIT-licensed components and Nurse Memo styling. Preserve third-party license notices when distributing.
