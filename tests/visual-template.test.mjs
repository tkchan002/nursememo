import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
test('sample master exposes both repeatable ward tables and all required fields',()=>{
 const source=read('documents/visual-template.js');
 for(const field of ['#mainTableRows','/mainTableRows','#infectionRows','/infectionRows',
  'signatureName','date','earlyBirdText','emptyBedText','additionalReportText'])
  assert.ok(source.includes(field),`${field} must be retained`);
 assert.match(source,/validateVisualTemplate/);
 assert.match(source,/doc\.render\(sample\)/);
});
test('Patrol honors published DOCX and preserves default generator fallback',()=>{
 const page=read('pages/patrol-page.js');
 assert.match(page,/state\.docxTemplatePublished/);
 assert.match(page,/renderVisualTemplate\(bytes, model\)/);
 assert.match(page,/buildPatrolDocxBytes\(model\)/);
 assert.match(page,/publishedMasterPromise/);
});
