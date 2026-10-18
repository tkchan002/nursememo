> **Existing Supabase demo:** Use [REUSE_EXISTING_SUPABASE.md](REUSE_EXISTING_SUPABASE.md). Your current Supabase Auth accounts and passwords are preserved. The separate Nurse Memo login credentials are initialized using the existing account IDs; no project reset is required.

# Nurse Memo — Patrol Night

Nurse Memo is a synthetic-data demonstration app with three workspaces: **Ward**, **Patrol Night**, and **Maintenance**. The Patrol Night workspace lives at `patrol.html`. Its report document is called **Night Memo**.

This source distribution is a **clean-break repository**. It uses `patrol` consistently for application roles, database objects, CSS identifiers, modules, tests, and GitHub Pages entrypoints. It has no compatibility layer for previously deployed naming. Create a NEW GitHub repository, rather than uploading the archive into an older repository with historical commits.

## Start here — reuse your existing Supabase project

**[REUSE_EXISTING_SUPABASE.md](REUSE_EXISTING_SUPABASE.md)** gives the intended installation procedure. This edition keeps the public Supabase connection already supplied for the earlier demo. A separately downloaded one-time SQL Editor script upgrades the existing database **without removing Auth users or resetting passwords**. The SQL script must **not** be committed into the new GitHub repository.

Do **not** run `supabase/schema.sql` or `supabase/seed.sql` in the existing database. They describe a clean installation, not an in-place upgrade. There is intentionally no database reset script in this package.

For a brand new GitHub repository, upload the root contents of this source ZIP including `.github/`, then enable GitHub Actions for Pages. Deploy the updated `admin-users` Edge Function to the **same** Supabase project for ongoing account administration. Account IDs remain unchanged; follow `ACCOUNT_LOGIN_UPGRADE.md` for the separate app passwords and BOTH Edge Functions.

## Major components

- `patrol.html`, `patrol.js`, `pages/patrol-page.js`: Patrol Night dashboard, Night Memo, History, Ward status, and Night Staffing.
- `editor/patrol-ranuts.js`: same-origin integration with the self-hosted ONLYOFFICE-derived ranuts/document editor.
- `documents/patrol-docx.js`, `documents/visual-template.js`: A4 landscape DOCX generation and data-placeholders used by the visual DOCX template designer.
- `pages/maintenance-page.js`: accounts, Ward settings, and publishable visual DOCX template.
- `supabase/schema.sql`, `supabase/seed.sql`: complete, clean-install Supabase contract and synthetic seed rows.
- `supabase/functions/admin-users`: privileged account operations, with role checking.
- `scripts/prepare-editor-site.mjs`: self-hosted browser editor packaging and compressed converter delivery.
- `.github/workflows/`: source checks, GitHub Pages build and pinned upstream editor build.

The old HTML-only Patrol memo template is absent. Ward and Night Staffing printing through `print.html` remains supported and must not be removed.

## Ward memo print headings

In `ward.html`, choosing **PM Memo** prints **PM Memo** as the document heading; choosing **Night Memo** prints **Night Memo**. Both the PDF/print view and the preview use the report type stored with the Ward memo, including when reprinting historical submissions. They share the same report layout. This is an application-only change: no extra Supabase schema or migration is necessary.

## Testing

Run `npm install --no-audit --no-fund`, then `npm run verify` and `npm run build`. GitHub Actions does the same and additionally builds the pinned upstream editor with pnpm. The full editor bundle is **not** included in this source ZIP. Final DOCX appearance, live Supabase access, native PDF export and editor startup require a real browser deployment test.

The automated audit blocks reintroduction of the previous protected title across repository files and paths. It does not remove historical references outside the newly created repository (for example, in old public repositories or independent archives).

## Licensing and safety

The pinned `ranuts/document` editor is ONLYOFFICE-derived and AGPL-3.0 licensed. Its notices and licence are preserved in the generated `/office/` directory. Review licensing, security and hospital policy before using any real patient information. **This repository and test credentials are only for synthetic demo data.**

## Existing Supabase: unified Nurse Memo login (demo)

See `ACCOUNT_LOGIN_UPGRADE.md`. The additive SQL `supabase/EXISTING_PROJECT_LOGIN_UPGRADE.sql` creates separate hashed Nurse Memo passwords for existing users. It does not change Supabase Auth emails, passwords, user UUIDs, roles, or reports. Deploy **both** `user-login` and `admin-users` Edge Functions before uploading this frontend.
