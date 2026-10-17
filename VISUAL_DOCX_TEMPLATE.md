# Visual Night Memo DOCX template (Maintenance)

## Workflow

1. Install the canonical `supabase/schema.sql` and `supabase/seed.sql` in a fresh Supabase project (see `NEW_REPOSITORY_SETUP.md`). The visual template schema is already included; no patch is needed.
2. Deploy the full repository and its existing self-hosted ranuts/ONLYOFFICE build.
3. Open Maintenance → Document Template. The normal DOCX editor opens a sample **master DOCX** with curly-braced data placeholders.
4. Edit headings, text, margins, tables, fonts, header, signature, etc. just like a normal Night Memo. **Do not remove or change curly-braced markers.** Repeating ward table rows have `{#mainTableRows}` / `{/mainTableRows}` or `{#infectionRows}` / `{/infectionRows}` in the same data row.
5. Click **Preview with Example Data**. A real DOCX is generated using sample ward data to verify your layout before publishing.
6. Click **Publish This Template** to validate required tags and save the editable DOCX to Supabase. Only Maintenance can publish; Patrol can only read. An administrator in another session cannot silently overwrite a newer version.
7. Reload Patrol Night. The published master is fetched on demand and merges the real report data. Existing drafts, history and saved reports remain unchanged.

## Data safety

- Published templates are binary DOCX (maximum 3 MiB), not HTML; formatting is retained.
- The DOCX merge fails clearly if a required data marker is removed. This prevents silent missing ward tables.
- The template holds structure and formatting only. It does not hold live patient data. Runtime data comes from the existing `buildPatrolMemoData` source model.
- No legacy HTML print files are restored; Ward printing and roster printing remain intact.
- There is no arbitrary dynamic JavaScript execution or HTML injection from templates.
- The default DOCX generator remains as fallback until Maintenance publishes a master; if an actual published master is invalid the app stops with an error instead of silently dropping fields.
- Browser rendering and the full real DOCX merge must be checked in deployed ONLYOFFICE. `npm run verify` and `npm run build` are mandatory in Actions.

## Deployment

The canonical schema includes the new visual-template table. This release is a clean-break installation and does not migrate previously stored documents or accounts. Use a fresh project or the documented dedicated-demo reset procedure; never run the fresh schema over an incompatible old database. This feature depends on two new open-source runtime packages: `docxtemplater` and `pizzip`. GitHub Actions installs them with `npm install` before `npm run verify` and `npm run build`.

## Retired numeric layout settings

The previous Maintenance sliders / numeric controls and the `documents/docx-layout.js` validator have been removed. There is a fixed internal A4 landscape DOCX starting sample; administrators make all actual formatting changes directly inside the visual editor and publish the DOCX. The old numeric migrations are omitted entirely. Visual masters use the dedicated `night_memo_visual_templates` table; no numeric layout settings are read or written.
