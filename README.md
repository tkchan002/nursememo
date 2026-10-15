# Nurse Memo

This repository is the **Nurse Memo** demo application. The product name was updated from Night Memo; **PM Memo** and **Night Memo** continue to identify the two reporting types.

## Branding-only change

The existing Supabase project requires **no SQL migration, schema reload, Edge Function redeployment, or account recreation** for this update. The entire `supabase/` directory is unchanged compared with the source ZIP.

The old internal identifiers are intentionally retained because they are part of the existing application contract, not user-visible branding:

- Supabase Auth emails still use `@accounts.nightmemo.example.com`.
- The maintenance demo login ID is still `NightMaintenance`.
- PM/Night import format: `night-memo-pm-night-v1`.
- Audit setting: `nightmemo.audit_explicit`.
- Existing browser storage keys use `nightMemo...` names.
- The `legacy-*` CSS classes and variables refer to the existing UI style, and have not been renamed.

These technical names are safe to retain even though the application is called Nurse Memo. Changing them would be a separate identity/data migration, not a branding update.

## Deploy

Upload the changed files while preserving their folder paths. Delete the old `NIGHT_MEMO_DEMO_ACCOUNTS.md` because it is replaced by `NURSE_MEMO_DEMO_ACCOUNTS.md`. No other file deletions are required. No actions in Supabase are required by this rename.

Run `npm run verify` to run code checks, imports, and tests. Run `npm install` then `npm run build` to generate `dist/` for hosting if dependencies are available.

The GitHub Pages URL depends on the GitHub repository name. Changing the app title does not automatically change the repository URL or GitHub Pages address.

See `NURSE_MEMO_DEMO_ACCOUNTS.md` for expected test credentials (not an export of real passwords).
