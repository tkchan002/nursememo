import { sanitizeManagerMemoHtml } from '../domain/manager-memo-html.js';

// Jodit is loaded only when a Manager opens the Night Memo editor.
// All toolbars are Nurse Memo configuration; no hospital JavaScript/assets are copied.
let loading;
export async function createManagerDocumentEditor(selector, onChange) {
  if (!loading) loading = import('jodit');
  const module = await loading;
  const Jodit = module.Jodit || module.default?.Jodit || module.default;
  if (!Jodit?.make) throw new Error('Jodit did not load. Verify the npm dependency and production build.');
  const options = {
    language: 'en',
    toolbarButtonSize: 'small',
    textIcons: false,
    // Icons for controls whose bundled fallback appeared as literal words in Chromium.
    // These are independently drawn inline vectors (not assets from the eHR capture).
    extraIcons: {
      symbol: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 6h8M12 6v6m-4 6c2.3-1 3.4-3.1 3.4-5.5 0-2.7-1.6-4.2-3.4-4.2S4.6 9.8 4.6 12.5 5.7 17 8 18Zm8 0c2.3-1 3.4-3.1 3.4-5.5 0-2.7-1.6-4.2-3.4-4.2s-3.4 1.5-3.4 4.2S13.7 17 16 18Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      eraser: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m4 16 9-10a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-6 6H9L4 16Zm6-7 7 7M4 21h17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    },
    toolbarAdaptive: false,
    toolbarSticky: true,
    showPlaceholder: false,
    showCharsCounter: false,
    showWordsCounter: true,
    showXPathInStatusbar: false,
    width: '100%',
    height: 'auto',
    minHeight: 440,
    maxHeight: 'auto',
    saveHeightInStorage: false,
    iframe: false,
    // Single restrained toolbar; table-specific operations remain in Jodit's table context menu.
    // No forced second row or unsupported proprietary icons.
    buttons: [
      'font', 'fontsize', '|', 'bold', 'italic', 'underline', 'brush', '|',
      'ul', 'ol', '|', 'undo', 'redo', '|', 'symbol', '|', 'paragraph', 'align', 'table', 'eraser',
    ],
    removeButtons: ['about','file','image','video','speech','print'],
    disablePlugins: ['file','image','video'],
    enter: 'P',
    defaultActionOnPaste: 'insert_as_html',
    askBeforePasteFromWord: false,
    askBeforePasteHTML: false,
    uploader: { insertImageAsBase64URI: false },
    controls: {
      // Neutral wording distinguishes this app's new toolbar from its reference.
      font: { list: { Arial: 'Arial', Tahoma: 'Tahoma', Verdana: 'Verdana', 'Times New Roman': 'Times New Roman' } },
    },
  };
  const editor = Jodit.make(selector, options);
  editor.events.on('change', () => onChange());
  return {
    setValue(value) { editor.value = sanitizeManagerMemoHtml(value); },
    getValue() { return sanitizeManagerMemoHtml(editor.value); },
    setReadOnly(readonly) { editor.setReadOnly(Boolean(readonly)); },
    destroy() { editor.destruct(); },
  };
}
