# Official Night Memo — DOCX branch architecture

The HTML/Jodit editor was replaced by `editor/manager-ranuts.js`. It hosts the public `ranuts/document` editor in an isolated iframe and uses the documented `document:open-buffer`, `document:save` and `document:get-state` postMessage protocol. Messages are accepted only from the configured editor origin and the expected frame. Both opening and saving have timeouts; failures are surfaced rather than silently accepted.

- **Ward calculations:** `domain/manager-memo.js` continues to own ward statistics, movement and infection aggregation; `buildManagerMemoData()` returns a structured report model.
- **Initial DOCX:** `documents/manager-docx.js` generates an A4 landscape Word document with editable tables, repeatable header rows and fixed-column signature/header fields. It uses `docx` at build time; no historical memo conversion is attempted.
- **Canonical storage:** `documents/docx-bytes.js` validates/encodes DOCX binary for transient requests. `manager_memo_docx_documents` holds the real `bytea` values. `manager_memos`, `manager_memo_revisions` and `manager_memo_recovery_snapshots` continue to hold metadata, immutable revision history, source snapshots and JSON document references. DOCX-specific SQL functions wrap the existing save functions in a single transaction.
- **Recovery:** Changes detected by the iframe mark the Manager working copy dirty. A serialized autosave exports DOCX, then calls `save_manager_memo_recovery_docx` with optimistic concurrency. A later edit should not be cleared by an earlier recovery acknowledgement.
- **Official Save:** The original immutable Draft revision workflow is retained, storing a new DOCX reference.
- **Final Print:** PDF export must succeed first; the application then stores the immutable Final DOCX before displaying the PDF to download/print. Cancelling the OS print dialog does not undo the Final.
- **History:** A separate read-only iframe reopens the exact selected Draft, Final or checkpoint DOCX. Restoring only affects the current-night working copy and never mutates the saved immutable revision.
- **Other pages:** Ward, Maintenance, Night Staffing, roster printing and authentication are unchanged.

This is an **experimental demo only**. See `DOCX_BRANCH_SETUP.md` for the SQL installation requirement, Github Pages branch caveat, known limitations and acceptance checklist.
