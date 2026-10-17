# Nurse Memo — New GitHub repository with the existing Supabase project

Use **`REUSE_EXISTING_SUPABASE.md`** for the supported installation path in this release. It preserves your existing login accounts, passwords, Ward data and memo history, while using a clean new GitHub repository.

The existing project's publicly distributable URL and publishable key are already configured in `config.js` from the previously supplied Nurse Memo source. No Auth bootstrap is required.

**Do not run** `supabase/schema.sql` or `supabase/seed.sql` on your existing project. These are canonical files for an empty new installation and are **not** in-place migrations.

A separate one-time SQL Editor migration file accompanies the repository as a separate download. Keep that file out of GitHub. It renames application objects and converts the reporting role to `patrol` without altering Supabase Auth users or their passwords. Back up first.

The updated `supabase/functions/admin-users` Edge Function must eventually be deployed to the same project if you want Maintenance to manage accounts. It is not needed for logins of already-existing accounts.

For GitHub Pages, enable **Settings → Pages → GitHub Actions** in your new empty repository. Then run the workflows, open the deployed site, and check login, Ward submission, Patrol Night reports, Night Memo/History and PDF printing.
