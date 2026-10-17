# Nurse Memo — Self-hosted ranuts/document test branch

**Patrol Night is still the user-facing name of `manager.html`.** The document inside it is **Night Memo**.

## What this complete source ZIP contains

**Use [ONE_REPOSITORY_OFFICE_FIX.md](ONE_REPOSITORY_OFFICE_FIX.md) for the latest routing fix and deployment instructions.**

- Nurse Memo application, Supabase DOCX/PostgreSQL storage logic, Ward/Maintenance/Staffing workflows and regression tests.
- An iframe adapter pointing to `office/editor.html` on **your own GitHub Pages domain**. It no longer points to `edit.chaxus.com`.
- Silent, one-instance editor startup after Patrol Night authentication and dashboard rendering. If the user opens the Night Memo before readiness, they get a loading animation; on an error they get Retry.
- A GitHub Actions workflow to checkout the **full original ranuts/document source**, build with pnpm, and publish it inside the Pages artifact under `/office/`.
- A build-time script to adapt allowed root-absolute asset URLs for either the `/nursememo/` project path or the `/` custom domain, preserve the internal ONLYOFFICE `/index.html` filename suffix, and decompress the converter into a raw `.wasm` file. GitHub Pages does not honour the custom Brotli `Content-Encoding` specified in upstream `public/_headers`.

**The upstream binary editor is NOT inside the ZIP**; it is retrieved and built automatically by GitHub Actions. This keeps your Git repository small while making the deployed editor self-hosted. Uploading this ZIP does not itself prove the published editor works; the remote build and actual browser test are required.

## Deploy to your existing test branch

1. Stay on `docx-editor-test`. Upload/extract this **entire** ZIP at repository root, maintaining folder paths (especially `.github/workflows`, `documents`, `editor`, `scripts`, `supabase`). Delete obsolete root-level `manager-ranuts.js` if it is still there.
2. Ensure **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Commit and inspect **Actions → Build and Deploy Nurse Memo (Self-Hosted Document)**.
4. Allow more time than before: GitHub Actions must download and build a large upstream repository. The upstream static build may occupy several hundred MB of the approximately 1 GB published-site budget.
5. Once deployed, verify `https://nursememo.app/office/nurse-memo-editor-build.json` reports `"officeBase": "/office/"` and `"packagingFix": "onlyoffice-nested-index-path-v2"` (for a custom-domain root). The actual editor is `office/editor.html`; the embedded-mode page alone is not a functional opening test. Open Night Memo from Patrol Night and verify the real document pages display.
6. Open Patrol Night. Immediately test Night Memo for the loading screen, edit/save/reopen a Draft, Preview/PDF, Print Final, and History read-only view. Repeat after a cold browser start and measure load times.

No further Supabase SQL changes are introduced by **this** hosting update. It assumes the existing DOCX/PostgreSQL migration was already applied in your testing branch.

## Custom domain / GitHub user-root site

Project Pages normally uses `/<repository>/` as the site base. The workflow takes the repository name from the automatic `GITHUB_REPOSITORY` environment variable. If your site is mounted at the domain root instead, create an Actions variable `PAGES_BASE_PATH` with value `/`. If it is mounted at a different base, set that exact slash path.

The Nurse Memo adapter locates the editor relative to its published JavaScript bundle, so it works without hard-coded account or repository names.

## Reproducibility and maintenance

The workflow defaults to the previously successful upstream commit `beb7e2fd6c2eada4c4ff21e94ac37d5c39a79fc0` rather than tracking upstream `main`. If you set Actions variable `RANUTS_REF`, that overrides the pin; remove any stale override to use the known revision.

Upstream is AGPL-3.0 and derives from ONLYOFFICE; licence and NOTICE are published alongside the editor. Keep all notices and applicable source-disclosure obligations. It is not appropriate to load real patient data into an experimental unapproved deployment.

## Important risks to test

- GitHub Pages does **not** implement Cloudflare `_headers`, and upstream recently moved its GitHub Pages workflow to a redirect rather than the complete application. The route-fix version now reproduces and prevents the previously observed nested `/index.html` bug using synthetic vendor fixtures. The complete upstream build **could not be downloaded or browser-tested in this environment**; runtime startup and PDF export still require a Pages browser test.
- The upstream bundle may approach GitHub Pages' site-size and monthly bandwidth soft limits. The deployment script fails rather than silently omitting SDK files if the site exceeds its conservative limit.
- Background warm-up uses memory and bandwidth even if the Nursing Officer never opens Night Memo. It does not make cold-start CPU costs disappear.
- If this workflow deploys from a branch, remember that GitHub Pages exposes one published site per repo. The `main` and `docx-editor-test` deployment workflows share the same Pages site.
- The built-in **File → Download As → PDF** export previously discarded its output in embedded mode. Nurse Memo now applies a strict build-time upstream patch to send native exports back to its verified iframe host; PDF export opens the existing preview and attempts a download. The separate **Preview/Print** API remains available. Confirm the built-in menu in a deployed browser before treating this as end-to-end verified. See [NATIVE_EDITOR_DOWNLOAD_FIX.md](NATIVE_EDITOR_DOWNLOAD_FIX.md).

## Local test evidence

All Nurse Memo source/tests can run without the upstream vendor. The preparation script has its own synthetic-asset test verifying subpath URL rewrite and Brotli-to-WASM conversion. Real production compilation and full renderer startup are explicitly **not** verified here.

## Cold-start performance (2026-10-17)

See [EDITOR_COLD_START_OPTIMIZATION.md](EDITOR_COLD_START_OPTIMIZATION.md) for compressed converter delivery, background document opening, performance measurements and browser validation guidance. This preserves the existing native PDF download fix.
