# Nurse Memo — A4 landscape DOCX layout and retired HTML-template cleanup

## What changed

- Default new Night Memo DOCX resembles the supplied printed report: underlined centered title; two-column borderless header; grouped Admission/Discharge table; infectious case table; narrative paragraphs; CT scan summary; **right-side signature immediately following the CT scan**.
- Maintenance → **Document Template** allows bounded changes to page margins, font sizes, cell padding, header split and signature width. **Download Sample DOCX** previews the current unsaved settings without modifying any report.
- Maintenance → **Publish Layout** changes future document generation. Previously saved drafts, final documents, history and DOCX bytes are not rewritten. Manager must reload to pick up a newly published setting. Existing Manager drafts are unaffected unless the user explicitly starts new or regenerates.
- The old HTML Manager template editor, HTML memo print renderer, related CSS, repository and template-specific sanitizers were deleted. Only the Manager DOCX path creates Night Memo documents now.

## Still used; deliberately preserved

`print.html`, `print.js`, `css/print-view.css`, `services/print-job-service.js`, `ward-print.js`, `night-roster-print.js` and the shared roster print stylesheet `manager-print-theme.js` remain in active use for **Ward report printing** and **Night Staff/Night Runner roster printing**. The separate PDF preview/download in the Manager's DOCX editor is also preserved.

## Supabase setup for an existing deployment

1. Open **Supabase Dashboard → SQL Editor**.
2. Run `supabase/migrations/20261017_docx_layout_settings.sql` **once** in your existing project. It is additive and does not modify any saved reports.
3. Upload the new repository and deploy via GitHub Actions.
4. Log in as Maintenance; open Document Template; adjust fields, download a sample DOCX, and Publish Layout.
5. Reload Manager. Start **New Night Memo** or use the explicit regeneration flow to see the new layout. Existing DOCX documents remain the same.

`supabase/schema.sql` is a **fresh-project bootstrap only**; do not run it against the existing Supabase project. The retired `manager_print_templates` table on existing projects is intentionally not dropped by the migration (removing stored historical data is outside this code cleanup).

If the migration is not run, Manager logs a warning and uses safe, built-in layout defaults. Maintenance reports an error and prevents publishing until the table is available.

## Verification and limitations

- Full source syntax/import checks and Node source/domain regression tests are run locally.
- The binary DOCX generator requires the installed `docx` dependency. If dependencies are absent, its original test is skipped; it should be run in CI using `npm install` and `npm run verify` plus `npm run build`.
- Pagination, Word/ONLYOFFICE rendering, actual printing, and the appearance of long ward tables should be visually checked on the test deployment before production use. The DOCX editor is not modified; cold-start optimization and native PDF menu export are preserved.
