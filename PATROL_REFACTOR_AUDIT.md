# Patrol Night — clean-break refactor audit

## Scope completed

- Login role, destination and DOM attributes: `patrol`, `patrol.html`.
- Frontend page/controller, stylesheet, document services, PDF integration, Night Memo data model and all related exports/imports.
- Supabase schema tables, recovery/revision functions, RLS checks, audit labels, Edge Function allowed roles, demo fixtures, account bootstrap and print logic.
- Maintained the existing visual DOCX master authoring workflow, compressed WebAssembly startup path, native PDF-export bridge, Ward printing and staffing print viewer.
- Removed transitional account-name aliases from the frontend. For existing Supabase projects, previous login IDs are retained; only the authorization role becomes `patrol`.
- Kept canonical schema/seed for documentation and new installations, while supplying the current project a separate one-time non-destructive SQL migration (not committed to GitHub).
- Reused the existing demo's publicly distributable Supabase URL and publishable key at the user's request. No secret/service-role keys are included.
- Added an automated source-and-path scan for the previously protected role title. The release is rejected if it reappears.

## Verification performed

- `npm run verify`: **308 passed, 2 skipped, 0 failed** (after account-preservation regression checks).
- JavaScript syntax/import checks are included in `npm run verify`.
- All distributed repository source files and paths are checked for the blocked terminology by the release-gating test.
- No original Git metadata is included with the source ZIP. Upload to a **new empty repository**, not a fork of the old repository, to obtain a fresh Git history.

## What cannot yet be claimed

- Installing package dependencies was blocked by DNS access to the public npm registry in the build environment. Two binary DOCX-generation tests were therefore skipped locally.
- The pinned upstream browser editor was **not compiled or operated in a real browser** in this environment. GitHub Actions and actual deployment must verify it.
- The one-time schema migration was reviewed and source-tested, but **not executed against a live Supabase project**. Back up and verify its assumptions against your existing schema before running it.
- This audit applies to the new archive's contents, not old repositories, forks, copied releases or third-party archives.

## Deployment gate

Follow `REUSE_EXISTING_SUPABASE.md`: fresh Git history, separate account-preserving SQL Editor migration, existing account IDs/passwords, updated Edge Function for account administration, completed Actions build, and real browser tests of Ward/Patrol Night/Maintenance, Night Memo history, visual template publication and printing.
