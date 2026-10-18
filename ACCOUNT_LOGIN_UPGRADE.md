# Nurse Memo account login upgrade — existing Supabase project (DEMO ONLY)

This update integrates the Ward NIL cross-out print correction and default-unchecked NIL boxes with one account-management system. Use the **full repository ZIP**. The SQL is additive and preserves `auth.users`, their UUIDs, emails, **Supabase Auth passwords**, Ward data and memo history. Make a backup before any SQL changes. Do not reset your project or run `schema.sql` over your existing one.

## Required deployment sequence

1. Keep your **existing Supabase project and configuration**. If the earlier Patrol Night renaming migration has not been applied, apply that earlier one-time migration first; this script expects `public.user_access` with the `patrol` role already installed.
2. In the existing project's **SQL Editor**, run **only** `supabase/EXISTING_PROJECT_LOGIN_UPGRADE.sql` for this update. It adds `app_login_credentials` and controlled RPCs, without changing any Auth passwords.
3. Deploy the TWO current functions from this repository using Codespaces and the same project ref:

   ```sh
   npx supabase@latest login
   npx supabase@latest functions deploy admin-users --project-ref YOUR_PROJECT_REF --use-api
   npx supabase@latest functions deploy user-login --project-ref YOUR_PROJECT_REF --use-api --no-verify-jwt
   ```

   `user-login` is publicly callable before authentication, and **must** verify the application password through the protected database RPC before issuing an Auth session. `admin-users` still requires a valid user session and the Maintenance role. Keep both function files and `_shared` dependencies intact. The Supabase platform's `verify_jwt` must be disabled **only** for `user-login`.
4. Upload the full ZIP to GitHub and redeploy Pages. Clear the browser tab's old session (sign out) before testing the new login.
5. Existing account IDs are unchanged. Initial Nurse Memo **app-facing** passwords for existing synthetic demo accounts are **lowercase account IDs**, regardless of previously stored Supabase Auth passwords: e.g. `Patrol` / `patrol`. The SQL uses salted hashes and will **not overwrite** an already-established app password if run a second time. Change app passwords later using Maintenance > Accounts > Set Password.
6. In Maintenance create a fresh test Ward account, sign out, log in as that Ward using the chosen app password, then return to Maintenance, change only the Ward account name and verify its password still works. Reset the app password and confirm the earlier app password stops working. Repeat as needed for Patrol Night.
7. Test Ward > PM Memo / Night Memo print. New reports start with Nil Consultation and Nil Intubation **unchecked**; checking either crosses that table body in PDF/print. Saved choices remain respected.

**Important:** The deployment cannot be authenticated end-to-end by a local source-test suite. Test in your actual Supabase project (particularly `user-login`'s magic-link OTP exchange) before disabling any old deployment. On failure, do not reset or recreate Auth users; first inspect the Edge Function logs and return to your previous working frontend if needed.

## Design and security limitations

- App-facing passwords are salted+hashed in `public.app_login_credentials` (service-role only), not in browser code. The server verifies them and issues standard Supabase sessions through a server-only Auth magic-link exchange. No Supabase Auth password is overwritten. Account IDs and display names are independent of the Auth email.
- A new account created in Maintenance receives a random underlying Auth password, and its chosen Nurse Memo password is stored separately. Its internal Auth email is random, not derived from its editable login ID. An existing account's Auth email and password never change when Maintenance edits its user-facing details.
- Existing Supabase Auth credentials remain technically valid for direct Supabase authentication outside Nurse Memo. Preserving them while introducing a separate login means this is **not** full credential revocation. Do not use this design for live hospital records.
- Short matching-ID passwords (e.g., `c5`) are insecure even with salted hashes and account lockout. Use **synthetic data only**, never real patient or staff data. The default account lockout is five wrong attempts followed by five minutes; don't repeatedly guess passwords.
- A forgotten app password is reset in Maintenance; the real Supabase Auth password is not displayed or reset by the app.
