# Nurse Memo — Self-hosted ranuts/document test branch

**Patrol Night is still the user-facing name of `manager.html`.** The document inside it is **Night Memo**.

## What this complete source ZIP contains

- Nurse Memo application, Supabase DOCX/PostgreSQL storage logic, Ward/Maintenance/Staffing workflows and regression tests.
- An iframe adapter pointing to `office/editor.html` on **your own GitHub Pages domain**. It no longer points to `edit.chaxus.com`.
- Silent, one-instance editor startup after Patrol Night authentication and dashboard rendering. If the user opens the Night Memo before readiness, they get a loading animation; on an error they get Retry.
- A GitHub Actions workflow to checkout the **full original ranuts/document source**, build with pnpm, and publish it inside the Pages artifact under `/office/`.
- A build-time script to adapt root-absolute asset URLs for a GitHub **project** Pages path and decompress the converter into a raw `.wasm` file. GitHub Pages does not honour the custom Brotli `Content-Encoding` specified in upstream `public/_headers`.

**The upstream binary editor is NOT inside the ZIP**; it is retrieved and built automatically by GitHub Actions. This keeps your Git repository small while making the deployed editor self-hosted. Uploading this ZIP does not itself prove the published editor works; the remote build and actual browser test are required.

## Deploy to your existing test branch

1. Stay on `docx-editor-test`. Upload/extract this **entire** ZIP at repository root, maintaining folder paths (especially `.github/workflows`, `documents`, `editor`, `scripts`, `supabase`). Delete obsolete root-level `manager-ranuts.js` if it is still there.
2. Ensure **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Commit and inspect **Actions → Build and Deploy Nurse Memo (Self-Hosted Document)**.
4. Allow more time than before: GitHub Actions must download and build a large upstream repository. The upstream static build may occupy several hundred MB of the approximately 1 GB published-site budget.
5. Once deployed, verify `https://<account>.github.io/<repository>/office/editor.html?embed=1` loads. The actual base path follows the Pages URL. `office/nurse-memo-editor-build.json` records the exact upstream revision used.
6. Open Patrol Night. Immediately test Night Memo for the loading screen, edit/save/reopen a Draft, Preview/PDF, Print Final, and History read-only view. Repeat after a cold browser start and measure load times.

No further Supabase SQL changes are introduced by **this** hosting update. It assumes the existing DOCX/PostgreSQL migration was already applied in your testing branch.

## Custom domain / GitHub user-root site

Project Pages normally uses `/<repository>/` as the site base. The workflow takes the repository name from the automatic `GITHUB_REPOSITORY` environment variable. If your site is mounted at the domain root instead, create an Actions variable `PAGES_BASE_PATH` with value `/`. If it is mounted at a different base, set that exact slash path.

The Nurse Memo adapter locates the editor relative to its published JavaScript bundle, so it works without hard-coded account or repository names.

## Reproducibility and maintenance

The test workflow initially tracks `ranuts/document` `main` because the GitHub runner must fetch the upstream build. **To freeze the upstream version after a successful test**, copy the exact SHA from `office/nurse-memo-editor-build.json` and add an Actions repository variable `RANUTS_REF` containing it. The workflow will then checkout that revision. This is strongly recommended before further releases.

Upstream is AGPL-3.0 and derives from ONLYOFFICE; licence and NOTICE are published alongside the editor. Keep all notices and applicable source-disclosure obligations. It is not appropriate to load real patient data into an experimental unapproved deployment.

## Important risks to test

- GitHub Pages does **not** implement Cloudflare `_headers`, and upstream recently moved its GitHub Pages workflow to a redirect rather than the complete application. This package adapts the `.wasm.br` file and known absolute paths, but the complete upstream build **could not be downloaded or browser-tested in this environment**. Nested SDK asset URLs, service-worker behaviour, or WebAssembly requirements may still need adjustment after the first CI/browser run.
- The upstream bundle may approach GitHub Pages' site-size and monthly bandwidth soft limits. The deployment script fails rather than silently omitting SDK files if the site exceeds its conservative limit.
- Background warm-up uses memory and bandwidth even if the Nursing Officer never opens Night Memo. It does not make cold-start CPU costs disappear.
- If this workflow deploys from a branch, remember that GitHub Pages exposes one published site per repo. The `main` and `docx-editor-test` deployment workflows share the same Pages site.
- The original editor's built-in PDF menu may still fail. The Nurse Memo **Preview/Print API** continues to be the supported export path.

## Local test evidence

All Nurse Memo source/tests can run without the upstream vendor. The preparation script has its own synthetic-asset test verifying subpath URL rewrite and Brotli-to-WASM conversion. Real production compilation and full renderer startup are explicitly **not** verified here.
