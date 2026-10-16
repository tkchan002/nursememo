# Nurse Memo — PAF UI consolidation release

## Scope

This is the **complete source repository**, based on `Nurse_Memo_Complete_PAF_UI_Integrated_Repository.zip`. It consolidates presentation and DOM event wiring while preserving existing application/reporting interfaces, Supabase settings/schema, the reporting model, and print-document content.

No proprietary CSS, JavaScript or image assets from the PAF capture were copied into the repository. Its interface was used as a visual reference.

## Changes completed

1. **HTML cleanup:** All 47 inline `style` attributes and 50 inline event attributes in `ward.html` were replaced with named CSS classes and declarative `data-ward-*` actions. The one inline style in `maintenance.html` was also removed. Login, Manager and Print entrypoints had no such inline attributes.
2. **Ward actions:** `pages/ward-page.js` now binds form commands through `bindWardActions()` using registered DOM listeners. The old `Object.assign(window, …)` exposure of Ward command handlers was removed. Date/memo selection and logout retain their existing dedicated listeners.
3. **Dynamic UI:** Generated Early Bird, Night Nurse, bed chooser, device-count controls, history rows, and Maintenance account metadata now use CSS classes rather than embedded screen styles. Form-state visibility uses `hidden` or CSS classes, with explicit `[hidden]` support for flex/table components.
4. **Other event binding:** Login, Manager, Maintenance and Test Data modules now use `addEventListener` instead of assigning `onclick` / `onchange` / `oninput` / `onsubmit` properties. The deterministic login test's fake DOM was updated accordingly.
5. **CSS ownership:** Removed 53 duplicated visual rules from the older shared/Ward/Manager stylesheets. `css/paf-design-system.css` owns the common tab and command-button patterns; page adapters own layouts and specialised states. PAF variants now cover device toggles, remove buttons, history/Get Data tables, Ward banners, Manager formatting-tool pressed states, and Ward preview controls.
6. **Other screens:** Added `css/paf-login.css` for the login screen. The large role tiles remain distinct navigation controls; Save/Cancel style actions use the common PAF look. Print-preview toolbar CSS was moved out of runtime-injected JavaScript into `css/print-view.css`, with rounded neutral buttons and isolated print-specific rules.
7. **Regressions:** Added `tests/paf-ui-consolidation.test.mjs` to prevent regressions to inline styling and outdated events. Existing tests expecting inline handlers were updated to assert the actual new binding contract.

## Preserved intentionally

- **Page-specific HTML:** Form labels, sections, tables, business fields, and stable IDs are intentionally present in HTML. HTML structure is not a defect; embedding presentation and event calls there was the issue.
- **Report/document formatting:** `ward-print.js`, Manager memo printing and Night Memo document template styles remain independent from application chrome. Printed tables and report pagination should not inherit desktop button/tab styling.
- **Legitimate status colours:** Warning/error/success indicators and select-active states retain their meaning; not every coloured element should become grey.
- **External integrations:** `supabase/`, database access, Edge Functions, project configuration and GitHub Actions were not replaced.
- **One isolated iframe placeholder:** `pages/manager-page.js` still uses styled `srcdoc` for the empty historical-document frame. This is document/iframe content, not screen control styling. Print preview still uses JavaScript-computed scale and height, since these values depend on measured document size.

## Verification

- `npm run verify`: **258 passed, 0 failed**, including nine new UI consolidation regression tests.
- Checked top-level CSS parser errors across every CSS file: none.
- Chromium computed-style review used the actual HTML and concatenated local CSS from each page without a connected backend. Ward, Manager and Maintenance tabs computed to **24px** with **11px** dark text; grey gradient CUI buttons were observed on desktop and mobile. Ward, Manager and Login did not overflow the **390px** mobile viewport.
- **Not verified:** Full authenticated Supabase workflow and production Vite build. Offline dependency installation failed with `ENOTCACHED` for `@supabase/supabase-js`; the environment lacks cached npm dependencies. The GitHub Actions installation/build workflow remains in the repository.

## Handover / deployment

Extract the ZIP locally, upload the **contents of the extracted folder** to the root of your GitHub repository, and keep the `.github/`, `supabase/`, `css/`, `pages/`, `tests/` and all other directories. Do not upload the ZIP file itself expecting GitHub to expand it.

In an environment with npm access, run:

```sh
npm install
npm run verify
npm run build
```

The release is a source/UI refactor, **not** a database migration. No Supabase schema changes are needed for the UI consolidation.
