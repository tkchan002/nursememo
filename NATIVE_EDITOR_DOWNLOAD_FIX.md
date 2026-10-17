# Nurse Memo — ONLYOFFICE native Download As integration

## The reported problem

Inside Patrol Night → Night Memo, the self-hosted ONLYOFFICE-derived editor displays a built-in **File → Download As → PDF** menu item. The menu can complete its conversion without prompting a browser download.

This is a specific integration issue, **not** an editor startup/performance fix, and does not explain or repair unrelated Home ribbon buttons.

## Root cause

In the pinned upstream `ranuts/document` revision `beb7e2fd6c2eada4c4ff21e94ac37d5c39a79fc0`, `lib/onlyoffice/save-stream.ts` receives the native export as a `File` in `routeSavedFile()`. It forwards *programmatic* embedded `document:save` requests, but if an embedded export comes from the vendor UI without a matching request, the original implementation logs `Local save is disabled in iframe embed mode...` and returns without saving the file.

The application already has a separate Preview/Print PDF export, but this does not handle the vendor menu export.

## Change made

- GitHub Actions checks out the same pinned upstream source and installs dependencies, then runs `node scripts/patch-editor-embedded-downloads.mjs` **before** building the upstream editor. The script replaces only the identified embed-mode native-export discard branch and refuses to proceed if that branch has changed. The editor remains self-hosted; no binary distribution is added to this repo.
- The converted `File` is sent to the **explicit `embedOrigin`**, never the wildcard `*`, in a `document:exported` iframe message. Outstanding programmatic `document:save` requests retain their original route and behavior.
- `editor/patrol-ranuts.js` accepts only events from the expected iframe window and origin, verifies the payload contains a `Blob`, and invokes Nurse Memo's native-export callback. This does not consume any pending `document:save` response.
- `pages/patrol-page.js` handles exports in both the working Night Memo and the separate History viewer. A PDF must begin with `%PDF-`. Nurse Memo shows the existing PDF preview **and attempts the browser download** using its download link. If the browser blocks the automatic download, the modal's **Download PDF** link remains available. Other recognized document formats download as files.
- The editor background warm-up, DOCX saving, recovery, Draft/Final, history storage, and Supabase are unchanged.

## Deployment and browser test

1. Upload the full changed repository, including `.github/`, `editor/`, `pages/`, `scripts/`, and `tests/`. Do not upload ONLYOFFICE binaries separately.
2. Make sure the upstream override `RANUTS_REF`, if set, refers to the pinned upstream commit. The patch deliberately fails the build if a changed source has no expected target.
3. Allow **Build and Deploy Nurse Memo (Self-Hosted Document)** to run. The new workflow step should report `Patched pinned ranuts native document exports for the Nurse Memo embed host.` before compiling the editor.
4. From the deployed Patrol Night page, open Night Memo and choose the vendor's **File → Download As → PDF**. Verify that a valid `Night-Memo-<date>.pdf` downloads, or that the preview opens and its manual **Download PDF** link works.
5. Check the separate Nurse Memo **Preview**, **Save Draft**, and **Print Final** actions still work; also test History's read-only viewer. A browser that blocks asynchronous automatic downloads may still require clicking the preview's download link.

## Verification and limits

The new regression tests exercise strict upstream patch matching, secure iframe event routing, native exports during pending saves, and source integration. The complete repository verification runs 295 tests (294 passed, 1 skipped, none failed) in this environment. The real GitHub-hosted upstream editor is built in GitHub Actions, not stored in the uploaded source, so a **real-browser end-to-end native PDF export remains to be verified after deployment**.

No loading-time optimization or change to the upstream AGPL-3.0 licensing requirements is included.
