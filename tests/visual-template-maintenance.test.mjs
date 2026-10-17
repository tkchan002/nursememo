import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
test('Maintenance uses the same visual DOCX editor to author and publish the master document',()=>{
 const html=read('maintenance.html'),page=read('pages/maintenance-page.js');
 assert.match(html,/<iframe id="docxTemplateEditor"/);
 assert.match(html,/Publish This Template/);
 assert.match(page,/createPatrolDocumentEditor/);
 assert.match(page,/validateVisualTemplate\(await state.visualEditor.export\('DOCX'\)\)/);
 assert.match(page,/publishNightMemoVisualTemplate\(bytes,state.docxTemplateVersion\)/);
 assert.doesNotMatch(html,/id="docxLayoutForm"/);
 assert.match(page,/buildEditableTemplateSample\(\)/);
 assert.doesNotMatch(page,/DEFAULT_DOCX_LAYOUT|normalizeDocxLayout/);
});
test('Published visual templates use binary storage, version checks and role-checked RPCs',()=>{
 const sql=read('supabase/schema.sql');
 const repo=read('data/repositories/visual-template-repository.js');
 assert.match(sql,/octet_length\(template_docx\)/);
 assert.match(sql,/public\.app_role\(\) <> 'maintenance'/);
 assert.match(sql,/public\.app_role\(\) not in \('patrol','maintenance'\)/);
 assert.match(sql,/version=p_expected_version/);
 assert.match(repo,/p_expected_version:expectedVersion/);
 assert.match(repo,/\.select\('version,has_template'\)/);
});
test('retired HTML template is absent but Ward and Night Staffing printing remains',()=>{
 for(const path of ['patrol-template.html','patrol-memo-print.js','patrol-template-editor.js',
  'patrol-template-page.js','patrol-document-print-css.js','domain/patrol-memo-html.js',
  'data/repositories/template-repository.js','css/print.css']) {
   assert.equal(existsSync(new URL(path,root)),false,`${path} should be retired`);
 }
 for(const path of ['print.html','print.js','css/print-view.css','ward-print.js',
  'night-roster-print.js','services/print-job-service.js','patrol-print-theme.js']) {
   assert.equal(existsSync(new URL(path,root)),true,`${path} must be preserved`);
 }
 assert.match(read('pages/patrol-page.js'),/getNightMemoTemplateMetadata/);
 assert.match(read('pages/patrol-page.js'),/renderVisualTemplate\(bytes, model\)/);
 assert.match(read('documents/patrol-docx.js'),/signatureBlock\(s,layout,width\)/);
 assert.doesNotMatch(read('documents/patrol-docx.js'),/normalizeDocxLayout/);
 assert.doesNotMatch(read('patrol-print-theme.js'),/PATROL_MEMO_DOCUMENT_CSS/);
});

test('canonical schema includes the visual DOCX template and no obsolete numeric layout settings',()=>{
 assert.equal(existsSync(new URL('documents/docx-layout.js',root)),false);
 assert.equal(existsSync(new URL('data/repositories/docx-layout-repository.js',root)),false);
 assert.doesNotMatch(read('pages/maintenance-page.js'),/DEFAULT_DOCX_LAYOUT|getNightMemoDocxLayout/);
 assert.doesNotMatch(read('pages/patrol-page.js'),/state\.docxLayout/);
 const script=read('supabase/schema.sql');
 assert.match(script,/create table public\.night_memo_visual_templates/);
 assert.match(script,/grant select\(id,version,has_template\)/);
 assert.doesNotMatch(script,/layout jsonb not null|grant update\(layout\)/);
 const schema=read('supabase/schema.sql');
 assert.match(schema,/create table public\.night_memo_visual_templates/);
 assert.doesNotMatch(schema,/create table public\.night_memo_docx_layout|layout jsonb not null/);
 assert.match(schema,/template_docx=v_bytes,has_template=true/);
 const repo=read('data/repositories/visual-template-repository.js');
 assert.match(repo,/from\('night_memo_visual_templates'\)/);
 assert.doesNotMatch(repo,/state\.docx_layout/);
 assert.equal(existsSync(new URL('supabase/migrations/',root)),false);
});
