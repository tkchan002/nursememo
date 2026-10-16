> **Historical note:** This document describes an earlier external-editor build. For the current self-hosted test branch, use [SELF_HOSTED_DOCUMENT_SETUP.md](SELF_HOSTED_DOCUMENT_SETUP.md) instead.

# Nurse Memo experimental DOCX Manager branch

This complete source ZIP is based on `Nurse_Memo_Complete_Landscape_Editor_Repository.zip`. It is **not a production release**. It replaces the Manager's Jodit editor with the `ranuts/document` browser word processor and stores DOCX bytes in the existing Supabase PostgreSQL database (`bytea`, not Supabase Storage).

## Before uploading

1. Create a Git branch named **`docx-editor-test`** (this name matches `.github/workflows/deploy-pages.yml`). Git branches do **not** isolate the Supabase database; this SQL migration affects the same Supabase project and is intentionally additive. The ZIP is complete: extract it and upload its **contents**, preserving hidden `.github` and the `supabase` folder. Delete the old `editor/manager-jodit.js` path from Git if it exists; uploading a ZIP's contents does not delete retired Git files.
2. In the **same Supabase project used by this demo**, open the Supabase Dashboard > SQL Editor. Run the complete `supabase/patches/20261016_manager_docx_database.sql` **once before deployment**. The file does not reset Ward reports or user accounts. It creates one protected binary document table and three DOCX-specific RPCs while **leaving the old JSON save RPC permissions unchanged**, so the main branch is not immediately broken by the SQL patch.
3. **The branch build may publish over the same GitHub Pages URL as main.** GitHub Pages provides one site per repository. Creating a branch does not create a separate Pages preview automatically. If the normal Nurse Memo site must remain untouched, test this ZIP in a *separate testing repository and Supabase project* instead. Some repositories have environment branch restrictions; allow the test branch under Settings > Environments > github-pages if Actions reports a protection error.
4. **Database warning:** New DOCX drafts created by the test branch are written to the existing `manager_memos` and History tables. The old main-branch Jodit editor cannot read these version-5 documents. Test with a separate Supabase project if you need to switch immediately back to the original Manager editor without replacing experimental records.
5. Push all source files. In Actions, wait for **Build and Deploy Nurse Memo**: npm dependencies, source checks, test suite, build, Pages upload/deploy. The DOCX generation package (`docx`) is installed by GitHub Actions. No local Mac installation is required.

## Functional test plan

- Manager > Night Memo > Start Night Memo. Expect external word processor to load automatically in a controlled iframe. Normal A4 landscape tables, CT values, APN/signature and paragraphs should appear.
- Edit text and a table cell. Check the UI indicates unsaved edits; wait for Recovery saved. Reload then Continue Draft and verify those edits returned.
- Click Save twice; check Draft #1 and Draft #2 in History, and that restoring an earlier Draft does not overwrite immutable History.
- Click Preview; the API-created selectable-text PDF should appear in a popup without creating a Final revision.
- Click Print; the app should create a Final revision **only after both DOCX and PDF exports and database save succeed**. Use Download PDF in the popup or Chrome's PDF viewer print button. The editor's built-in native PDF download is not used.
- History: select a Draft, Final, recovery and checkpoint. These should reopen the stored DOCX read-only. Restore on current reporting night should create a working draft.
- Regenerate Ward Sections after new submissions: confirmation and safety checkpoint required; all document edits will be replaced.
- Verify Ward input/printing, Maintenance, authentication, Ward List and Runner List printing work unchanged.

## Technical boundaries / important limitations

- The external editor runs at `https://edit.chaxus.com/editor`; the host validates `postMessage` origin **and** iframe identity. Editing, export and document buffers pass through the browser iframe API. **Use fictional demo data only**. Do not use public third-party hosted editors for identifiable clinical records without appropriate security/legal review.
- **DOCX and only DOCX** is canonical for the official Manager Night Memo. Version-4 HTML history is intentionally not migrated. To avoid an old-format error in this demo, choose Start New.
- A new `manager_memo_docx_documents` row is inserted atomically with each recovery or immutable Draft/Final save; the existing memo JSON stores only `{version:5,format:'docx',document_id,...}`. Safety checkpoints retain the referenced DOCX bytes. All access is via security-definer RPCs with active Manager checks; direct table access remains revoked.
- The limit is **3 MiB per DOCX**. DOCX Base64 is used only for the temporary API request; it is decoded to PostgreSQL `bytea` before storage.
- Recovery saves are intentionally debounced to 9 seconds due to DOCX export overhead; they are serialized and version-checked. The editor currently reports change events through the public embed API. Verify that edits continuing after the first recovery save are detected on your browser.
- Each save creates a new binary record so historical versions are never overwritten. This branch does not yet provide automatic cleanup of unreferenced old recovery binaries; for sustained production workloads, add retention/garbage collection and monitor database growth.
- PDFs are generated by the editor API on demand and are **not yet retained as immutable database binaries**. A production-grade permanent Final print archive should store its exact PDF alongside its DOCX, in the same controlled lifecycle.
- Frontend build and live RPC/iframe flow have not been executed in the packaging environment because dependencies and Supabase access were unavailable. The supplied tests validate source contracts and critical codecs; verify the deployed branch before trusting it.
- Old Jodit-specific tests were updated to confirm the DOCX workflow. Some older report-domain/HTML tests remain for historical/independent calculations, but the Manager screen does not call those HTML print helpers.
- AGPL-3.0 licensing of ranuts/document and underlying editor must be reviewed for any actual deployment; this branch does not remove third-party licences or copy their code/assets.
