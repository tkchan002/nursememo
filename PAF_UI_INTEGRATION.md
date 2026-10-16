# Nurse Memo: PAF-inspired clinical UI

## Purpose

Nurse Memo retains its existing functional HTML, JavaScript modules, Supabase
schema/configuration, print paths, tests and GitHub Pages workflow. Only the
**screen presentation** has been changed to match the supplied PAF design
conventions more closely. The source was independently written; no CSS,
JavaScript, image, or other proprietary asset from either hospital MHTML file
is included.

## Where the new design lives

- `css/paf-design-system.css`: **single shared source of truth** for clinical
  tabs, CUI-like rounded grey buttons, fields, tables, colours, dialog chrome,
  screen-only behaviour, and mobile target sizes.
- `css/paf-ward.css`: maps original Ward form rows, history, Get Data controls,
  admission/bed count and mobile layout onto those shared conventions.
- `css/paf-manager.css`: maps Manager workspaces, tables, history and the editor
  toolbar to the same conventions, protecting the typeset Night Memo document.
- `css/paf-maintenance.css`: applies shared conventions to Administration.

All main pages load their layout styles first, followed by the shared design
system and a dedicated page adapter. Login also imports the shared style and
`paf-login.css`. Duplicate old tab, button and common table declarations were
removed; page-specific layout behaviour remains in the existing files.
See `UI_CONSOLIDATION_REPORT.md` for the consolidation changes.

## Specific visual changes

- 24px tabs, 11px bold Tahoma, grey inactive state, white-to-grey active state,
  dark text, 4px rounded top corners.
- 15px-radius small action buttons, 14px bold Arial, white-to-grey gradient,
  pale-cyan hover; larger 20px-radius commands in Ward action bar.
- Ivory clinical working areas, neutral-grey table headers and borders;
  compact field labels and form rows.
- The old green Submit and yellow Manager primary-button colours are retired
  in favour of the same neutral PAF actions.
- A small shared application title bar is added to Ward, matching the Manager.
- Mobile tabs scroll within their bar, controls grow to touch-friendly sizes,
  and wide tables remain contained rather than forcing page-wide zoom.

## Preservation contract

- The UI page modules were updated to register DOM listeners and render named
  CSS components. Reporting calculations, API/data modules and `supabase/` were
  not changed.
- Original IDs, tab order, reporting workflows and memo document rendering
  remain intact.
- All PAF presentation rules are inside `@media screen`; print styles stay
  governed by their existing stylesheets.
- `tests/paf-ui-integration.test.mjs` adds assertions to catch accidental loss
  of the shared CSS, working entrypoints, or core PAF design signatures.

## Running in development

With Node.js and network access for npm dependencies:

```sh
npm install
npm run verify
npm run build
```

The full source is ready for a GitHub repository. Unzip the package and commit
its *contents*; GitHub Pages does not automatically unpack an uploaded ZIP.

## Validation of this release

- JavaScript syntax and relative imports checked successfully.
- `npm run verify`: **258 tests passed, 0 failed**, including nine new
  consolidation tests.
- Chromium reviewed the actual HTML/CSS at desktop and 390px mobile widths.
  This was a computed-style/static-render check, not a live Supabase session.
- Dependency installation / Vite production build could **not** be verified in
  the packaging environment: npm's required dependency was not available in
  the local cache. The GitHub Actions workflow retains its normal npm install,
  verification, build and deployment steps.

Note: The hospital captures are still visual references. Minor differences
from live PAF's graphics/hover states may require further visual comparison.
