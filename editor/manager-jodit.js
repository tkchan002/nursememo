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
    toolbarAdaptive: false,
    toolbarSticky: true,
    showPlaceholder: false,
    showCharsCounter: false,
    showWordsCounter: true,
    showXPathInStatusbar: false,
    width: '100%',
    height: 770,
    minHeight: 560,
    iframe: false,
    buttons: [
      'font','fontsize','|','bold','italic','underline','brush','|','ul','|','undo','redo','|','symbol',
      '\n', 'paragraph','align','outdent','indent','ol','|','table','hr','eraser','|','find','fullsize',
    ],
    buttonsMD: [
      'font','fontsize','|','bold','italic','underline','brush','|','ul','undo','redo','symbol',
      '\n','paragraph','align','ol','indent','outdent','table','eraser',
    ],
    buttonsSM: ['font','fontsize','bold','italic','underline','brush','ul','undo','redo','symbol','\n','paragraph','align','ol','table','eraser'],
    buttonsXS: ['font','fontsize','bold','italic','underline','brush','ul','undo','redo','symbol','\n','paragraph','align','ol','table','eraser'],
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
