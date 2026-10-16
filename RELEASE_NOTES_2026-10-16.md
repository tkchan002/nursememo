# Nurse Memo — Readability, Login and Roster Printing

## Scope

- Screen UI type increases (tabs 13px, data tables 14px, input controls 14px), with measured modest tab-height growth. Printed Ward Memos and Night Memo editor/print document typography are unchanged.
- Demo-compatible `patrol` login. Existing Supabase `PatrolNight` account remains usable; `patrol` first tries an actual renamed `patrol` account, then transparently tries `PatrolNight` **only in explicitly enabled insecure test mode and only for Manager**. The old login continues to work. No database or Edge Function deployment required.
- Maintenance Account editor previews its generated Supabase email and existing rename function remains authoritative. On rename, staff must reset a matching short test password using Set Password.
- Manager Print Ward List and Print Runner List now display in-page A4 preview modal, with adjustable 8–14pt document text, shared heart logo, Close and Print / PDF buttons. Printed content still uses the existing print job system.
- No changes to roster data collection or Supabase schema.

## Important deployment notes

The production Build and all automated tests should run in GitHub Actions. Password alias is **demo/test only**; before using genuine clinical credentials, turn off `INSECURE_TEST_PASSWORDS` and rename the Manager account explicitly using Maintenance. The stored Auth email changes through `rename_login` action; select Set Password if you also want the short matching test password to change.

## Visual QA

Validate tab widths (especially mobile scroll), Manager roster preview on both desktop and mobile, heart logo loading in iframe and print view, and Maintenance account email preview. Browser print and authentication with the live Supabase service should be checked after deployment.
