# Nurse Memo + Office in one repository — nested ONLYOFFICE route fix

**Deployment target:** your existing `tkchan002/nursememo` repository, not `nursememo-office`.

**Main application:** `manager.html` is still **Patrol Night**. The editable document is **Night Memo**.

## What was fixed

The former `scripts/prepare-editor-site.mjs` rewrote **every** quoted `"/index.html"` into `"/nursememo/office/index.html"` or `"/office/index.html"`. This also changed an internal ONLYOFFICE SDK *filename suffix* that is appended to its existing document editor directory. Consequently opening a DOCX requested an impossible URL such as:

```
/nursememo/office/web-apps/apps/documenteditor/main/nursememo/office/index.html
```

The corrected release-time script:

1. Rebases site-root editor assets to `<siteBase>/office/`, but does **not** touch the generic `"/index.html"` suffix in SDK/other nested scripts.
2. Rebases `/index.html` only in the upstream *top-level landing HTML* where it truly means the editor homepage.
3. Includes working physical GitHub Pages route aliases at `office/editor/index.html` and `office/history/index.html`.
4. Publishes uncompressed `x2t.wasm` because GitHub Pages cannot add the needed Brotli `Content-Encoding` response header.
5. Fails deployment when the actual `office/web-apps/apps/documenteditor/main/index.html` file is absent or when the output no longer has the validated routing-fix version.
6. Pins the upstream editor to `beb7e2fd6c2eada4c4ff21e94ac37d5c39a79fc0` (the revision used by the working standalone test), unless you deliberately set an Actions `RANUTS_REF` override.

The editor is still fetched and compiled **during GitHub Actions**, but after deployment it is served from the **same GitHub Pages site as Nurse Memo**, at `/office/`. The source ZIP is not meant to contain a 600 MB upstream binary distribution.

## What is not changed

- `manager.html` user-facing name: **Patrol Night**.
- Background preloading after successful Manager login.
- Loading notice and Retry if the Night Memo is opened before the editor is ready.
- DOCX generation; PostgreSQL `bytea` persistence; recovery, Draft/Final revisions, History, Preview/PDF, Print; Supabase configuration.
- Ward, Maintenance, login, Night Staffing, operational printing.

There is **no dependency** on `tkchan002.github.io/nursememo-office`, `office.nursememo.app`, or `edit.chaxus.com` in the runtime editor adapter.

## Deploy

1. Extract **the complete repository ZIP** and upload its **contents** to the root of your existing `nursememo` GitHub repository on the intended branch (for example `docx-editor-test`). Keep `.github`, `scripts`, `documents`, `editor`, `supabase` and other folders in place. GitHub web upload does not delete retired files; if an old **root** `manager-ranuts.js` is still present, delete that stray duplicate. The real module is `editor/manager-ranuts.js`.
2. In **Settings → Pages**, select **GitHub Actions** as the deployment source.
3. Since the site is on custom domain `https://nursememo.app/`, set **Settings → Secrets and variables → Actions → Variables → `PAGES_BASE_PATH` = `/`**. (If deploying exclusively at `https://tkchan002.github.io/nursememo/` without the custom domain, remove the variable to use `/nursememo/`.)
4. If you have set `RANUTS_REF` previously to a different version, remove it or set `beb7e2fd6c2eada4c4ff21e94ac37d5c39a79fc0` for a repeatable test.
5. Push and wait for **Build and Deploy Nurse Memo (Self-Hosted Document)** to complete. The workflow builds both application and editor into a **single `dist/` Pages artifact**. Only one branch should deploy this GitHub Pages site at a time.

## Verify the published output

With your custom domain, visit:

- `https://nursememo.app/manager.html` — Patrol Night.
- `https://nursememo.app/office/editor.html?embed=1` — an embedded-mode editor page (may appear empty without the host sending a document).
- `https://nursememo.app/office/nurse-memo-editor-build.json` — confirm `"siteBase": "/"`, `"officeBase": "/office/"`, and `"packagingFix": "onlyoffice-nested-index-path-v2"`.
- `https://nursememo.app/office/web-apps/apps/documenteditor/main/index.html` — must no longer return the custom 404. This nested resource is not a standalone user-friendly editor page.

Then **Patrol Night → Night Memo**: open a generated report, edit the admission table, save, reload, view History, Preview, and Print to PDF. The document frame must show actual pages, not a custom 404, before marking this release successful.

## Verification status

A complete **synthetic upstream distribution** was passed through the real combined packaging script for both `/office/` and `/nursememo/office/` bases, and through the release verifier. This reproduces the nested-index SDK path regression and checks route aliases, metadata, and WASM handling. The main app's source tests also run locally. **The large upstream editor was not compiled or browser-tested in this environment.** The live GitHub Pages build and full DOCX/PDF workflow remain to be checked on your branch.

Ranuts/document is licensed under AGPL-3.0. Its `LICENSE` and `NOTICE` stay in the published assets; applicable obligations remain. This is an experimental demo and must not process identifiable clinical data without appropriate review.
