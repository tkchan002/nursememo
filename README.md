# Nurse Memo — Self-hosted document editor test branch

**The Manager application is called Patrol Night.** Its editable document is called **Night Memo**.

This is a complete source repository for the Nurse Memo `docx-editor-test` branch. It includes Ward, Maintenance, Night Staffing, reporting, authentication, Manager history and PostgreSQL DOCX persistence, plus a GitHub Actions workflow that builds and self-hosts ranuts/document (a browser-only ONLYOFFICE-derived editor) in the published GitHub Pages artifact.

**Start with [SELF_HOSTED_DOCUMENT_SETUP.md](SELF_HOSTED_DOCUMENT_SETUP.md)** for installation, hosting requirements and known risks. The source archive is deliberately small because GitHub Actions downloads/builds the upstream engine separately; the engine is not fetched by the user at runtime from `edit.chaxus.com` after a successful deployment.

## Key features

- Patrol Night dashboard remains functional while the editor silently preloads after manager authentication.
- Opening Night Memo shows a real loading message and animation until the DOCX is rendered; errors show a Retry button. No dashboard 'editor ready' status is shown.
- The same iframe is reused for editing. The document editor opens in a nearly full-screen workspace.
- A4 landscape DOCX and API PDF export retain their existing workflow. Documents are stored as PostgreSQL binary data (`bytea`) and referenced by the Manager history tables.
- No new database migration is required **if the existing DOCX-branch migration was applied already**. First-time installation needs `supabase/patches/20261016_manager_docx_database.sql`.
- The deployment workflow checks the Nurse Memo source, builds Nurse Memo with Vite, checks out ranuts/document, builds that upstream project, adapts it to the GitHub Pages project path and copies the complete editor assets to `/office/`.

## Build and verification

Run `npm run verify` in a Node.js environment to test the locally available code. The real GitHub Pages deployment additionally requires `npm install`, `npm run build`, an upstream pnpm build and `node scripts/prepare-editor-site.mjs`. This build runs automatically in GitHub Actions; you do not need npm or pnpm on your Mac.

**Build warning:** Upstream now ships a very large static bundle (its own comments describe roughly 616 MB of assets). GitHub Pages normally limits published sites to 1 GB and applies usage/bandwidth policies. Since upstream no longer publishes the whole application via its own GitHub Pages workflow, and GitHub Pages cannot set the Brotli response header required by its compressed converter, this repository provides special handling that **still requires real-world deployment validation**. Source tests do not prove editor runtime compatibility.

## Repository boundaries

- `pages/manager-page.js`: Patrol Night orchestration, recovery, Draft/Final, History and print lifecycle.
- `editor/manager-ranuts.js`: origin-validated iframe bridge using same-origin `office/editor.html`.
- `documents/`: DOCX generator and binary codec.
- `data/`, `supabase/`: existing database and authorisation contract.
- `scripts/prepare-editor-site.mjs`: self-hosted vendor staging, relative-site path adaptation and converter decompression.
- `scripts/verify-pages-editor.mjs`: presence/integrity checks of published editor assets.
- `.github/workflows/deploy-pages.yml`: composite deployment of Nurse Memo and the upstream editor.

The legacy design/change notes elsewhere in this repo describe earlier Jodit or remote ranuts trials and are retained for historical context only. They should not override this README and `SELF_HOSTED_DOCUMENT_SETUP.md`.

## Licensing and scope

Nurse Memo is a fictional-data demo. `ranuts/document` is AGPL-3.0 and derived from ONLYOFFICE. The editor's `LICENSE` and `NOTICE` are kept in the published `/office/` folder; the upstream source revision is recorded in `office/nurse-memo-editor-build.json`. Follow the applicable obligations and conduct a security review before processing any actual patient information.
