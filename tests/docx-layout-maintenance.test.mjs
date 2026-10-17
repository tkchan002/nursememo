import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {DEFAULT_DOCX_LAYOUT,normalizeDocxLayout} from '../documents/docx-layout.js';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
test('Maintenance publishes only bounded, structured DOCX layout',()=>{
 const html=read('maintenance.html'),page=read('pages/maintenance-page.js');
 for(const key of Object.keys(DEFAULT_DOCX_LAYOUT)) {
  assert.match(html,new RegExp(`name="${key}"`));
 }
 assert.match(html,/data-maint="docx"/);
 assert.match(page,/saveNightMemoDocxLayout\(readDocxLayoutForm\(\),state.docxLayoutVersion\)/);
 assert.match(page,/downloadDocxLayoutSample/);
 const value=normalizeDocxLayout({...DEFAULT_DOCX_LAYOUT,headerLeftPercent:68});
 assert.equal(value.headerLeftPercent,68);
 assert.throws(()=>normalizeDocxLayout({...value,signatureWidthPercent:100}),/Invalid/);
});
test('Maintenance layout is versioned and restricted to authorized managers and maintenance staff',()=>{
 const sql=read('supabase/migrations/20261017_docx_layout_settings.sql');
 const repo=read('data/repositories/docx-layout-repository.js');
 assert.match(sql,/public\.app_role\(\) in \('manager','maintenance'\)/);
 assert.match(sql,/public\.app_role\(\)='maintenance'/);
 assert.match(sql,/grant update\(layout\)/);
 assert.match(repo,/eq\('version',expectedVersion\)/);
 assert.match(repo,/Document template changed in another session/);
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
 assert.match(read('pages/manager-page.js'),/getNightMemoDocxLayout/);
 assert.match(read('pages/manager-page.js'),/buildManagerDocxBytes\(model, state.docxLayout/);
 assert.match(read('documents/manager-docx.js'),/signatureBlock\(s,layout,width\)/);
 assert.doesNotMatch(read('manager-print-theme.js'),/MANAGER_MEMO_DOCUMENT_CSS/);
});
