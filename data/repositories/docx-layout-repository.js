import { DB_MODE, supabase } from '../client.js';
import { demoRead, demoWrite } from '../demo-state.js';
import { DEFAULT_DOCX_LAYOUT, normalizeDocxLayout } from '../../documents/docx-layout.js';

const defaults = () => ({layout:{...DEFAULT_DOCX_LAYOUT},version:1});

export async function getNightMemoDocxLayout() {
  if (DB_MODE === 'demo') {
    const saved = demoRead().docx_layout;
    return saved ? {layout:normalizeDocxLayout(saved.layout),version:saved.version} : defaults();
  }
  const {data,error} = await supabase.from('night_memo_docx_layout').select('layout,version').eq('id',1).single();
  if (error) throw new Error(`Unable to load document template settings: ${error.message}`);
  return {layout:normalizeDocxLayout(data.layout),version:data.version};
}

export async function saveNightMemoDocxLayout(layout, expectedVersion) {
  const clean=normalizeDocxLayout(layout);
  if (!Number.isSafeInteger(expectedVersion)||expectedVersion<1) throw new Error('Invalid document template version.');
  if (DB_MODE === 'demo') {
    const state=demoRead();
    const current=state.docx_layout || defaults();
    if (current.version!==expectedVersion) throw new Error('Document template changed in another session. Reload it before saving.');
    state.docx_layout={layout:clean,version:current.version+1};
    demoWrite(state);
    return state.docx_layout;
  }
  // Optimistic concurrency protects another administrator's changes.
  const {data,error}=await supabase.from('night_memo_docx_layout')
    .update({layout:clean}).eq('id',1).eq('version',expectedVersion).select('layout,version').maybeSingle();
  if (error) throw new Error(`Unable to save document template settings: ${error.message}`);
  if (!data) throw new Error('Document template changed in another session. Reload it before saving.');
  return {layout:normalizeDocxLayout(data.layout),version:data.version};
}
