# Ward draft history and reporting-date status

## Deploy to the existing Supabase project

This release adds a **read-only, ward-scoped RPC** to list draft metadata. It does not recreate or replace the database and does not change the Ward Save/Submit RPCs.

1. Back up your current repository, then open your **existing** Supabase project at https://supabase.com/dashboard.
2. Navigate to **SQL Editor → New query**.
3. Open `supabase/UPGRADE_WARD_DRAFT_HISTORY.sql` from this ZIP, copy its **entire** contents into the SQL editor, and press **Run**. You may rerun this script; it uses `create or replace function`. Do **not** run `supabase/schema.sql` on an existing database.
4. Upload/merge the updated repository files to your GitHub Pages repository, and let the usual GitHub Actions deployment finish. **No Edge Function redeployment and no CLI are required** for this change.
5. Sign in with a Ward account. Use **Save Draft**, then open **History**. The draft should have a reporting date, PM/Night type, saved time (HKT), and a `Draft saved` label. Select it and click **Resume Draft** to continue editing.
6. Submit the draft: History should now show **Submitted**. The active saved draft entry should disappear. If edits are later saved after submission, History should show both a Submitted entry and a separate **Unsubmitted changes** draft entry for that same reporting date/type.

## Notes and limits

- This is a **history of the most recent saved draft per ward/date/type**, *not* every click of Save. Each further Save overwrites that draft and updates its timestamp.
- Submitted report history and Patrol Night's submitted-only `Get Data` behavior are unchanged. A draft does **not** become visible as a submitted report.
- History previews are read-only. **Resume Draft** loads the currently stored draft into the Ward editing form, with a warning before discarding any unsaved edits from the current form. A previously submitted version remains separately inspectable.
- Reporting date is the operational night, while saved and submitted timestamps are displayed in **Hong Kong time**. For example, saving at 02:00 on 19 October can belong to the reporting night of 18 October.
- Only authenticated users with an active Ward role assigned to the requested ward can call the list RPC. It returns dates, memo types, revision IDs, and timestamps, **not clinical payloads**. Individual draft content is still read using the existing ward-authorized RPC.
- Successful saves now refresh History; routine Ward save notices no longer change the page layout. Errors remain visible until another status supersedes them.
- If you deploy the site before running the SQL, History will show an error directing you to the upgrade SQL. Draft Save and Submit use unchanged backend functions.

## Verification checklist

1. Save a draft for the selected reporting date and confirm the status includes its saved time, date, and `Not submitted`.
2. Switch reporting date, return to the prior date, and confirm the saved draft is reloaded.
3. Open History, view the draft, click Resume Draft; verify the correct PM/Night type and reporting date are selected.
4. Submit that memo. Confirm History shows a Submitted entry but no draft entry for the same date/type.
5. Change the submitted memo, save it again, and confirm History shows `Unsubmitted changes` **and** the original Submitted version.
6. In a second account/ward, confirm drafts from the first ward cannot be listed.
7. Disconnect the network during a save; confirm a failure does not appear as a successful save.

The repository test/build steps verify the implementation locally, but final Supabase role authorization and the GitHub Pages user experience must be checked against your deployed project.
