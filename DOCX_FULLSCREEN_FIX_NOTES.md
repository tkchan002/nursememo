> **Historical note:** This document describes an earlier external-editor build. For the current self-hosted test branch, use [SELF_HOSTED_DOCUMENT_SETUP.md](SELF_HOSTED_DOCUMENT_SETUP.md) instead.

# Patrol Night — DOCX Full-Viewport Editor Fix

This is a branch-test patch for Nurse Memo. The **user-facing name of `manager.html` remains Patrol Night** (browser title: `Nurse Memo | Patrol Night`). **Night Memo** is the document inside that application.

## Problems addressed

1. **False DOCX load error.** Previously, `editor/manager-ranuts.js` treated an iframe `load` event arriving after `document:ready` as an unexpected reload. In some browsers, an initial page-load event can arrive after the editor has already sent its ready event; the DOCX may actually have opened successfully. The adapter now confirms the operation from the matching `document:opened` response, or fails on an editor error/timeout. It does not treat a load event alone as proof of failure.
2. **Cramped Word interface.** The entire ranuts/ONLYOFFICE editor was nested in the Manager tab, leaving little room for A4 landscape editing. The editor now takes the browser viewport when opened, with a thin **Back to Patrol Night / Save / History / Preview / Print** toolbar. Back restores the familiar four-tab Patrol Night screen.
3. **Height cap.** The old tab-scoped `max-height` restriction on `.memo-canvas-wrap` was overridden, allowing the editor to take the remaining viewport height instead of retaining an old panel-sized layout.
4. **Read-only safety.** Read-only/history mode now sends the remote editor's documented `document:set-readonly` command. It does **not** make the entire history iframe inert, so the document can still be selected and scrolled. While Save or Print is exporting DOCX/PDF, input is locked temporarily without toggling the remote editor into read-only mode (which would cause its save/export API to fail).
5. **Readiness failures.** An editor instance whose initial readiness handshake fails is discarded rather than permanently cached.
6. **Error visibility.** Editor errors and save notices appear in the full-viewport workspace while the normal Patrol Night status handling remains intact.

## Files changed

- `manager.html`
- `css/manager-document.css`
- `pages/manager-page.js`
- `editor/manager-ranuts.js`
- `tests/manager-history-sidebar.test.mjs`
- `tests/manager-docx-iframe-lifecycle.test.mjs` (new)
- `DOCX_FULLSCREEN_FIX_NOTES.md` (new)

The main document generator, PostgreSQL DOCX schema/migration, authentication, Ward, Maintenance, and Night Staffing modules remain unchanged.

## Upload instructions

Choose either the full-repository ZIP (replace branch contents) or the replacement-files ZIP (overlay matching paths). Preserve **all folder paths**; `manager-ranuts.js` belongs only in `editor/`, not the repo root. The `documents/` folder remains required. Use the `docx-editor-test` branch. No new Supabase SQL migration is needed for this UI/handshake fix; the original DOCX branch migration must already have been applied.

## Testing checklist

1. Open `manager.html` and confirm the page title/subtitle identifies **Patrol Night**.
2. Night Memo tab → Start Night Memo or Continue Draft. Editor should cover the browser content area (not be squeezed into the four-tab panel).
3. Verify there is **no false "Document editor reloaded during an operation"** error when the document visibly opens.
4. Edit a table cell, then Save, leave to Patrol Night and Continue Draft. Confirm the change persists.
5. Open History, select a previously saved Draft/Final and verify it remains read-only but scrollable. Close History to return to the editor.
6. Preview and Print use the working external PDF API. Ensure the PDF is A4 landscape, readable and selectable, and that failed PDF conversion never creates a Final revision.
7. Repeat with several table changes, long text and the 72-row stress document if appropriate.

## Verification status

- Local `npm run verify`: **285 tests: 284 passed, 0 failed, 1 skipped**. The skipped test needs the separately installed DOCX generator npm dependency.
- JavaScript syntax and relative-import checks passed.
- These checks do **not** prove live cross-origin iframe behavior, Supabase persistence, DOCX rendering or GitHub Pages production build. Test them after deploying your branch.
- A local Chromium screenshot run was attempted but the headless browser did not finish in this container. No visual-browser pass is claimed.

The editor remains hosted at `https://edit.chaxus.com`; it is an independent application and its ribbon cannot be restyled by Nurse Memo CSS. This is a demo setup and must not be used with real patient data without reviewing the editor-hosting security boundary.
