# Nurse Memo UI Style Guide

Nurse Memo's application interface is implemented with independently authored HTML, CSS and JavaScript. The supplied hospital screenshots and saved pages were visual references only; no hospital UI framework, stylesheet, script or image asset is bundled into this application.

## Stylesheet responsibilities

| File | Responsibility |
| --- | --- |
| `css/legacy-shell.css` | Existing base window and page structures |
| `css/theme.css` | Shared screen-only typography, visual variables, tabs, buttons, tables and dialog shell |
| `css/ward.css` | Ward form layout, history, Get Data content and Ward-specific states |
| `css/manager.css` | Manager workspaces, Night Memo editor presentation and Manager-specific states |
| `css/maintenance.css` | Maintenance layouts and administration-specific presentation |
| `css/login.css` | Login layout, role cards and login-specific styling |
| `css/print-view.css`, `css/print.css` | Print-preview application chrome and print-specific formatting |

Other small feature-specific stylesheets remain in place for their named features.

Each application page loads its existing layout styles followed by `css/theme.css`. Page-specific clinical styling lives at the end of the corresponding page stylesheet, inside `@media screen` so report print layouts remain unaffected. The shared theme has a single file; the common control rules are not duplicated across each page.

The Get Data popup uses neutral `ui-dialog*` presentation classes; all existing `gd*` IDs, Ward event action hooks, and retrieval behaviour are preserved. Screen colour variables use `--ui-*` names. The login ID field has no account-example placeholder, while demo-mode autofill is unchanged.

## Verification

Run `npm run verify` for static checks, import checks and unit tests. For a deployable build, install the pinned npm dependencies and run `npm run build`. Backend-connected workflows still require deployment testing against your Supabase project.
