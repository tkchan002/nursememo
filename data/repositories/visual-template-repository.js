import { DB_MODE, supabase } from '../client.js';
import { demoRead, demoWrite } from '../demo-state.js';
import { assertDocxBytes, bytesToBase64, base64ToBytes } from '../../documents/docx-bytes.js';

const defaults = () => ({version:1,hasTemplate:false});
const demoTemplate = state => state.docx_template;

export async function getNightMemoTemplateMetadata() {
  if (DB_MODE === 'demo') {
    const saved = demoTemplate(demoRead());
    return saved ? {version:saved.version,hasTemplate:Boolean(saved.templateBase64)} : defaults();
  }
  const {data,error} = await supabase.from('night_memo_visual_templates').select('version,has_template').eq('id',1).single();
  if (error) throw new Error(`Unable to load document template metadata: ${error.message}`);
  return {version:data.version,hasTemplate:Boolean(data.has_template)};
}

// Template DOCX is fetched on demand. Never put megabytes of base64 on the
// Patrol dashboard critical path (only has_template/version is loaded there).
export async function getNightMemoVisualTemplate() {
  if (DB_MODE === 'demo') {
    const saved=demoTemplate(demoRead());
    return saved?.templateBase64 ? base64ToBytes(saved.templateBase64) : null;
  }
  const {data,error}=await supabase.rpc('read_night_memo_visual_template');
  if (error) throw new Error(`Unable to load published DOCX template: ${error.message}`);
  return data ? base64ToBytes(data) : null;
}
export async function publishNightMemoVisualTemplate(bytes,expectedVersion) {
  assertDocxBytes(bytes);
  if (!Number.isSafeInteger(expectedVersion)||expectedVersion<1) throw new Error('Invalid template version.');
  const encoded=bytesToBase64(bytes);
  if (DB_MODE === 'demo') {
    const state=demoRead();
    const current=demoTemplate(state) || defaults();
    if (current.version!==expectedVersion) throw new Error('Template changed in another session. Reload before publishing.');
    state.docx_template={templateBase64:encoded,version:current.version+1};
    demoWrite(state);
    return {version:state.docx_template.version,hasTemplate:true};
  }
  const {data,error}=await supabase.rpc('publish_night_memo_visual_template',{
    p_docx_base64:encoded,p_expected_version:expectedVersion,
  });
  if (error) throw new Error(`Unable to publish DOCX template: ${error.message}`);
  return {version:Number(data),hasTemplate:true};
}
