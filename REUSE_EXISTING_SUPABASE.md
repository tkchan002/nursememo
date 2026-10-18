# New GitHub repository, existing Supabase — account-preserving install

This package is intended for the **same Supabase demo project** used by the previously supplied Nurse Memo repository. It uses a new GitHub repository and the Patrol Night application code, but does **not** reset the database or recreate account passwords.

## What is retained

- The existing Supabase project and its public URL/publishable key. `config.js` has already been configured from the prior supplied demo repository.
- Every existing `auth.users` account, its UUID, email and stored password hash.
- Each existing account's `user_access.login_id`, active status, Ward association and permissions, except that the reporting role identifier becomes `patrol`.
- Ward records, admission/PM/Night reports, source snapshots, staff, configuration, and Night Memo history and document binaries already stored in the database.

**Your Supabase Auth password stays unchanged, but Nurse Memo uses a separate application login password.** In particular, the reporting account is **not** automatically changed to an account ID of `patrol`. The revised application login no longer requires Auth email updates when changing account IDs. Enter your *existing* account ID in the Patrol Night login box.

## One-time installation

1. **Back up the existing Supabase database** (including its `public` schema) and confirm that the currently running old site is not being actively used. This is a schema change; do not run it on a shared or production project.
2. Get the separately supplied **`Nurse_Memo_Existing_Supabase_One_Time_Migration.sql`**. Keep that file **outside GitHub**. Its one-time SQL text necessarily contains the database's previous identifiers.
3. In **the existing Supabase project's SQL Editor**, paste the complete SQL file and click **Run once**. The script is transactional and renames objects in place. Do **not** run `supabase/schema.sql`, `supabase/seed.sql`, or any reset script against the existing project.
4. Deploy the new repository ZIP contents at the **root** of a new, empty GitHub repository, including `.github/`, and enable **Settings → Pages → Build and deployment → GitHub Actions**. Its `config.js` already points at the same Supabase project using a public publishable key, not a service-role secret.
5. Run `supabase/EXISTING_PROJECT_LOGIN_UPGRADE.sql` in SQL Editor after the earlier Patrol Night migration and **before** Edge Function deployment. This adds a protected app-password table and does not reset Auth users. For all logins and full **Maintenance → Accounts** create/edit/reset capability, deploy the updated `supabase/functions/admin-users` Edge Function from this repo to the **same** project. It depends on its `_shared` modules. Existing account logins now require the new `user-login` Edge Function; account administration also requires the updated `admin-users` function.
6. After following `ACCOUNT_LOGIN_UPGRADE.md`, sign in with the **same account IDs** and the new app-facing demo passwords (lowercase account IDs by default). Select the new **Patrol Night** role on the login page for the existing reporting account.

### Deploy both Edge Functions from Codespaces (required for login)

In a Codespace created from the new repository:

```bash
npx supabase@latest login
npx supabase@latest functions deploy admin-users --project-ref YOUR_EXISTING_PROJECT_REF --use-api
npx supabase@latest functions deploy user-login --project-ref YOUR_EXISTING_PROJECT_REF --use-api --no-verify-jwt
```

You do not need to bootstrap Auth accounts or reset their Supabase passwords. A Supabase CLI login authorizes deployment; it does not change your Nurse Memo users.

## Verify

- Sign in as an existing Ward user with the original Ward account ID and new app-facing default password and confirm saved Ward information remains visible.
- Sign in as your existing reporting account **using its existing account ID and app-facing default password** under Patrol Night. Confirm the dashboard, existing Night Memo history, and editor open.
- Sign in as your existing Maintenance account. Confirm Ward configuration and report-item data remain.
- Print a PM Memo and confirm its print/preview heading reads **PM Memo**.
- After deploying the Edge Function, confirm Maintenance can list accounts and create a test account using role **Patrol Night**.

## Important limitations

- The SQL migration was designed against the old Nurse Memo schema included in the source ZIP supplied in this conversation. It cannot automatically accommodate every possible manual change made directly in Supabase. It performs **preflight checks** and runs in one transaction, so failed checks roll back the changes.
- **No live Supabase connection or SQL Editor execution was available in this build environment.** Source tests passing does not prove your particular database will migrate successfully. If SQL Editor reports an error, **do not run a reset**; copy the error and inspect the existing schema before changing anything else.
- The separately provided SQL migration is intentionally **not included in this GitHub repository ZIP**, so old database names will not appear in your new GitHub source/history. Do not commit it into the new repository.
- A previous public repo, fork or archived copy will still have its own historical commits; starting this new repo does not erase them.
- This is a demonstration system. Keep synthetic data only and do not use predictable test passwords with patient records.

## Additional step for the unified application login

Follow `ACCOUNT_LOGIN_UPGRADE.md` after the one-time Patrol Night migration, before deploying the new frontend. This does NOT reset the Supabase project or re-create accounts. Existing Nurse Memo account IDs remain, and the initial **application** password for each synthetic demo account is its lowercase ID. Supabase Auth passwords are not changed.
