# Nurse Memo — demo visual DOCX template setup

This package REPLACES the previous numeric layout controls in Maintenance with an editable DOCX sample and **Publish This Template**.

## Existing Nurse Memo demo with Supabase already configured

1. Upload the full ZIP contents to the Nurse Memo GitHub repository, retaining folder paths and allowing deleted old files to be removed.
2. Remove previously committed numeric-layout-only files if your branch still contains them (`documents/docx-layout.js`, `data/repositories/docx-layout-repository.js`, `tests/docx-layout-maintenance.test.mjs`, `DOCX_TEMPLATE_LAYOUT_AND_CLEANUP.md`) and delete the three retired 20261017 SQL migrations if present.
3. Open your **existing** Supabase project -> SQL Editor. Run just:
   `supabase/migrations/20261017_visual_docx_template_demo.sql`
4. Allow GitHub Actions to rebuild/deploy the site and the bundled self-hosted DOCX editor.
5. Open Maintenance -> Document Template, edit the sample document, preview it with example data, then publish it.
6. Open Patrol Night -> Night Memo and create a new document to check the published layout.

**Do not** run the older three SQL template migrations. They are not needed and have been removed from this ZIP.

## What is discarded

The SQL script drops the old numeric layout settings table, if present, and any visual template record from earlier experiments, then creates an empty visual template store. It does not touch Ward/Manager memos, accounts, history or other Supabase tables.

## What is not removed

Ward and Night Staffing HTML printing remain active; their print viewer and services must stay. The fast-loading embedded DOCX editor, PDF export integration and reporting logic remain.

## Testing limitations

Source-level tests are not an end-to-end browser DOCX render. Confirm the published template renders and includes populated live data in the deployed browser before relying on it.
