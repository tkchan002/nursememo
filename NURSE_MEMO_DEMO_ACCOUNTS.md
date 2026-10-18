# Nurse Memo demo accounts — current login behavior

The current browser login uses **application-side credentials**, not the
Supabase Auth password or the previous matching-ID password conversion.

- **Existing accounts:** The additive SQL upgrade initializes each Nurse Memo
  password to the account ID in lowercase, without changing the underlying
  Supabase Auth account, email, password hash or UUID. Example: account `Patrol`
  and Nurse Memo password `patrol`. These are *known insecure* synthetic demo
  credentials and must be changed for any deployment accessible to others.
- **New accounts:** Maintenance creates one internal Supabase Auth identity
  (random internal password and email) and stores a separate hashed Nurse Memo
  password chosen in the Create Account dialog.
- **Editing Account ID / Display Name / Role:** Only application metadata changes.
  The Supabase Auth email and password are unaffected; the chosen Nurse Memo
  password continues to work.
- **Set Password:** Replaces only the app-side password hash, not the underlying
  Supabase Auth password. Passwords are never displayed back to Maintenance.

See `ACCOUNT_LOGIN_UPGRADE.md` for the additive SQL and Edge Function deployment
needed for the existing Supabase project. Never use this demo with patient data.
