import test from 'node:test';
import assert from 'node:assert/strict';

let generator;
let unavailable;
try { generator = await import('../documents/visual-template.js'); }
catch (error) {
  if (error.code === 'ERR_MODULE_NOT_FOUND') unavailable = error;
  else throw error;
}
if (unavailable && process.env.DOCX_VERIFY_GENERATION === '1') throw unavailable;

test('real editable DOCX merges multiple ward rows without losing template formatting', {
  skip: unavailable ? `Node dependencies unavailable: ${unavailable.message}` : false,
}, async () => {
  const {buildEditableTemplateSample, validateVisualTemplate,renderVisualTemplate}=generator;
  const raw=await buildEditableTemplateSample();
  assert.equal(raw[0],0x50);assert.equal(raw[1],0x4b);
  validateVisualTemplate(raw);
  const bytes=renderVisualTemplate(raw,{
    title:'Night Memo (Male)',
    header:{fromName:'Ward C5 APN',dectPhone:'2322',callTeam:'MC',date:'19/9/2025'},
    mainTableRows:[
      {ward:'C10',admissionEC:3,admissionCC:0,totalPatient:7,staff:'3/3'},
      {ward:'E10',admissionEC:1,admissionCC:2,totalPatient:9,staff:'4/4'},
    ],
    infectionRows:[
      {ward:'C10',covid:'0',cre:'1M bed 4'},
      {ward:'E10',covid:'1M bed 1',cre:'0'},
    ],
    earlyBirdHtml:'<div>C10: Early Bird</div>',emptyBedHtml:'<div>E10: 1D Room</div>',
    additionalReportHtml:'<div>Follow-up</div>',ct:{total:4,maleGeneral:4,maleCohort:0},
    signature:{name:'Ward C5 APN',designation:'N.O./APN'},
  });
  assert.ok(bytes.length>100);
  const [{default:PizZip},{default:Docxtemplater}]=await Promise.all([import('pizzip'),import('docxtemplater')]);
  const doc=new Docxtemplater(new PizZip(bytes));
  const text=doc.getFullText();
  for(const value of ['C10','E10','Ward C5 APN','1M bed 1','Follow-up','19/9/2025'])
    assert.ok(text.includes(value),`Missing rendered value ${value}`);
  assert.doesNotMatch(text,/\{#mainTableRows\}|\{#infectionRows\}|\{ward\}/);
});
