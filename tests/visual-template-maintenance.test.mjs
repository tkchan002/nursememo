import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
test('Maintenance uses the same visual DOCX editor to author and publish the master document',()=>{
 const html=read('maintenance.html'),page=read('pages/maintenance-page.js');
 assert.match(html,/<iframe id="docxTemplateEditor"/);
 assert.match(html,/Publish This Template/);
 assert.match(page,/createManagerDocumentEditor/);
 assert.match(page,/validateVisualTemplate\(await state.visualEditor.export\('DOCX'\)\)/);
 assert.match(page,/publishNightMemoVisualTemplate\(bytes,state.docxTemplateVersion\)/);
 assert.doesNotMatch(html,/id="docxLayoutForm"/);
 assert.match(page,/buildEditableTemplateSample\(\)/);
 assert.doesNotMatch(page,/DEFAULT_DOCX_LAYOUT|normalizeDocxLayout/);
});
test('Published visual templates use binary storage, version checks and role-checked RPCs',()=>{
 const sql=read('supabase/migrations/20261017_visual_docx_template_demo.sql');
 const repo=read('data/repositories/visual-template-repository.js');
 assert.match(sql,/octet_length\(template_docx\)/);
 assert.match(sql,/public\.app_role\(\) <> 'maintenance'/);
 assert.match(sql,/public\.app_role\(\) not in \('manager','maintenance'\)/);
 assert.match(sql,/version=p_expected_version/);
 assert.match(repo,/p_expected_version:expectedVersion/);
 assert.match(repo,/\.select\('version,has_template'\)/);
});
test('retired HTML template is absent but Ward and Night Staffing printing remains',()=>{
 for(const path of ['manager-template.html','manager-memo-print.js','manager-template-editor.js',
  'manager-template-page.js','manager-document-print-css.js','domain/manager-memo-html.js',
  'data/repositories/template-repository.js','css/print.css']) {
   assert.equal(existsSync(new URL(path,root)),false,`${path} should be retired`);
 }
 for(const path of ['print.html','print.js','css/print-view.css','ward-print.js',
  'night-roster-print.js','services/print-job-service.js','manager-print-theme.js']) {
   assert.equal(existsSync(new URL(path,root)),true,`${path} must be preserved`);
 }
 assert.match(read('pages/manager-page.js'),/getNightMemoTemplateMetadata/);
 assert.match(read('pages/manager-page.js'),/renderVisualTemplate\(bytes, model\)/);
 assert.match(read('documents/manager-docx.js'),/signatureBlock\(s,layout,width\)/);
 assert.doesNotMatch(read('documents/manager-docx.js'),/normalizeDocxLayout/);
 assert.doesNotMatch(read('manager-print-theme.js'),/MANAGER_MEMO_DOCUMENT_CSS/);
});

test('a single demo setup script replaces the retired numeric template path',()=>{
 assert.equal(existsSync(new URL('documents/docx-layout.js',root)),false);
 assert.equal(existsSync(new URL('data/repositories/docx-layout-repository.js',root)),false);
 assert.doesNotMatch(read('pages/maintenance-page.js'),/DEFAULT_DOCX_LAYOUT|getNightMemoDocxLayout/);
 assert.doesNotMatch(read('pages/manager-page.js'),/state\.docxLayout/);
 const script=read('supabase/migrations/20261017_visual_docx_template_demo.sql');
 assert.match(script,/drop table if exists public\.night_memo_docx_layout/);
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
 for(const old of ['20261017_docx_layout_settings.sql','20261017_remove_legacy_docx_layout_settings.sql','20261017_visual_docx_template.sql']) {
   assert.equal(existsSync(new URL('supabase/migrations/'+old,root)),false);
 }
});
