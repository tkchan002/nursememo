# New GitHub repository, existing Supabase — account-preserving install

This package is intended for the **same Supabase demo project** used by the previously supplied Nurse Memo repository. It uses a new GitHub repository and the Patrol Night application code, but does **not** reset the database or recreate account passwords.

## What is retained

- The existing Supabase project and its public URL/publishable key. `config.js` has already been configured from the prior supplied demo repository.
- Every existing `auth.users` account, its UUID, email and stored password hash.
- Each existing account's `user_access.login_id`, active status, Ward association and permissions, except that the reporting role identifier becomes `patrol`.
- Ward records, admission/PM/Night reports, source snapshots, staff, configuration, and Night Memo history and document binaries already stored in the database.

**The existing account ID and password remain the same.** In particular, the reporting account is **not** automatically changed to an account ID of `patrol`. This is deliberate: changing a login ID could require a corresponding Supabase Auth email change. Enter your *existing* account ID in the Patrol Night login box.

## One-time installation

1. **Back up the existing Supabase database** (including its `public` schema) and confirm that the currently running old site is not being actively used. This is a schema change; do not run it on a shared or production project.
2. Get the separately supplied **`Nurse_Memo_Existing_Supabase_One_Time_Migration.sql`**. Keep that file **outside GitHub**. Its one-time SQL text necessarily contains the database's previous identifiers.
3. In **the existing Supabase project's SQL Editor**, paste the complete SQL file and click **Run once**. The script is transactional and renames objects in place. Do **not** run `supabase/schema.sql`, `supabase/seed.sql`, or any reset script against the existing project.
4. Deploy the new repository ZIP contents at the **root** of a new, empty GitHub repository, including `.github/`, and enable **Settings → Pages → Build and deployment → GitHub Actions**. Its `config.js` already points at the same Supabase project using a public publishable key, not a service-role secret.
5. For full **Maintenance → Accounts** create/edit/reset capability, deploy the updated `supabase/functions/admin-users` Edge Function from this repo to the **same** project. It depends on its `_shared` modules. Existing account logins do not require the Edge Function to be deployed first; account administration does.
6. Sign in using the **same account IDs and passwords as before**. Select the new **Patrol Night** role on the login page for the existing reporting account.

### Deploy Edge Function from Codespaces (when you need Maintenance account editing)

In a Codespace created from the new repository:

```bash
npx supabase@latest login
npx supabase@latest functions deploy admin-users --project-ref YOUR_EXISTING_PROJECT_REF --use-api
```

You do not need to bootstrap accounts or reset passwords. A Supabase CLI login authorizes deployment; it does not change your Nurse Memo users.

## Verify

- Sign in as an existing Ward user with the original Ward account ID/password and confirm saved Ward information remains visible.
- Sign in as your existing reporting account **using its previous account ID/password** under Patrol Night. Confirm the dashboard, existing Night Memo history, and editor open.
- Sign in as your existing Maintenance account. Confirm Ward configuration and report-item data remain.
- Print a PM Memo and confirm its print/preview heading reads **PM Memo**.
- After deploying the Edge Function, confirm Maintenance can list accounts and create a test account using role **Patrol Night**.

## Important limitations

- The SQL migration was designed against the old Nurse Memo schema included in the source ZIP supplied in this conversation. It cannot automatically accommodate every possible manual change made directly in Supabase. It performs **preflight checks** and runs in one transaction, so failed checks roll back the changes.
- **No live Supabase connection or SQL Editor execution was available in this build environment.** Source tests passing does not prove your particular database will migrate successfully. If SQL Editor reports an error, **do not run a reset**; copy the error and inspect the existing schema before changing anything else.
- The separately provided SQL migration is intentionally **not included in this GitHub repository ZIP**, so old database names will not appear in your new GitHub source/history. Do not commit it into the new repository.
- A previous public repo, fork or archived copy will still have its own historical commits; starting this new repo does not erase them.
- This is a demonstration system. Keep synthetic data only and do not use predictable test passwords with patient records.
