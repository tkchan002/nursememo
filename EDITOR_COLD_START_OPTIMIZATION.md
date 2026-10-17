# Nurse Memo — Cold document-start improvement (2026-10-17)

This update keeps the pinned ranuts/document revision and the prior native PDF download integration.

## Observed problem

A cold browser visit can show both the ONLYOFFICE native percentage loader and Nurse Memo's own "Opening Night Memo" overlay for a total of about 45 seconds. They can overlap or be alternating views of the same operation, so they should not automatically be counted as two separate sequential loading times. Actual timings depend on browser, network and file contents.

## Concrete changes

1. GitHub Pages can serve a raw `x2t.wasm`, but not declare Brotli Content-Encoding for the upstream `.wasm.br`. The former source expanded the converter to ~42 MiB and the browser downloaded it during first document conversion. Packaging now creates a separate native gzip copy (`x2t.wasm.gz`), makes browsers with `DecompressionStream('gzip')` stream-decompress it while WASM compiles, and preserves original raw `x2t.wasm` as a compatibility fallback. No changes are made to the decoded converter bytes. Build verification checks byte-for-byte equivalence.
2. As soon as Patrol authentication succeeds, the existing iframe startup is scheduled and the smaller converter is prefetched on the same origin. These actions are silent and never block Patrol startup.
3. Once authenticated ward/workspace data is ready, Nurse Memo attempts an invisible open of the actual working DOCX (or a generated, *unsaved* initial memo if no draft exists). Before its source is assigned, the single editor iframe container is moved under `body` so it can retain nonzero viewport dimensions even while the Patrol tab is hidden. It is transparent, inert and inaccessible to keyboard/mouse input until selected. No second editor is created. When the user enters Night Memo, an in-flight pre-open is joined; an already-open matching document is reused, without re-fetching the source or re-converting it. Stale candidates fall back to the existing foreground open path. The speculative blank memo is never persisted without an explicit Start Night Memo action.
4. Browser Console logs durations for iframe initialization, document:opened and foreground visibility (not document contents, patient data, login details or file names).

## Safety and limitations

- The work starts only after Patrol authentication and is restricted to the same origin.
- Existing save, recovery, archive, permissions and native PDF export flows are unchanged.
- The background conversion uses CPU/memory and network even if a patrol stays on another tab. It trades idle resources for less waiting **after opening** the document. When Night Memo is opened immediately after login, the cold-start cost may still be substantial.
- `DecompressionStream` is supported by current Chromium-family browsers; clients lacking it continue using the original raw WASM route.
- It cannot guarantee a given number of seconds. The full upstream editor build/browser run is not available locally; deployment through GitHub Actions and real-browser cold/warm timing measurements are mandatory.
- To validate, deploy the entire source change (including scripts and tests), use an incognito window, leave the Patrol Night dashboard open for one minute, then open Night Memo. Repeat by clicking immediately after login and compare. The Browser Network panel should show `x2t.wasm.gz` rather than `x2t.wasm` on browsers supporting gzip streaming.
- Keep `RANUTS_REF` pinned (or unset for repository default) because the patch refuses a changed vendor loader instead of publishing unverified binaries.
