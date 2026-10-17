// A master DOCX is a real editable file, not HTML. Visible field tags are
// resolved when a new Night Memo is generated. The layout/tables remain exactly
// as authored in the published master document.
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { assertDocxBytes } from './docx-bytes.js';
import { buildManagerDocxBytes } from './manager-docx.js';

const mainFields = ['ward','admissionEC','admissionCC','transferIn','discharge','transferOut','death','totalPatient','emptyBed','ventilator','bipap','hfnc','staff'];
const infectionFields = ['ward','covid','cre','vre','mdra','cd','influenza','hdCapd','remarks'];
const required = [
  'title','fromName','dectPhone','callTeam','date',
  '#mainTableRows','/mainTableRows','#infectionRows','/infectionRows',
  'earlyBirdText','emptyBedText','additionalReportText',
  'ctTotal','maleGeneral','maleCohort','femaleGeneral','femaleCohort',
  'signatureName','signatureDesignation',
  ...mainFields.filter(name => name !== 'ward'),
  ...infectionFields.filter(name => name !== 'ward'),
];
const text = x => String(x ?? '');
export const TEMPLATE_FIELDS = Object.freeze([...required]);
export function templateData(model = {}) {
  const h = model.header || {}, c = model.ct || {}, s = model.signature || {};
  const toText = html => text(html)
    .replace(/<\s*br\s*\/?\s*>|<\/(?:div|p|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&amp;/gi, '&').trim();
  const rows = (arr, fields) => (Array.isArray(arr) ? arr : []).map(row =>
    Object.fromEntries(fields.map(field => [field, text(row?.[field])])));
  return {
    title: text(model.title || 'Night Memo'),
    fromName:text(h.fromName),dectPhone:text(h.dectPhone),callTeam:text(h.callTeam),date:text(h.date),
    mainTableRows:rows(model.mainTableRows,mainFields),infectionRows:rows(model.infectionRows,infectionFields),
    earlyBirdText:toText(model.earlyBirdHtml), emptyBedText:toText(model.emptyBedHtml),
    additionalReportText:toText(model.additionalReportHtml),
    ctTotal:text(c.total),maleGeneral:text(c.maleGeneral),maleCohort:text(c.maleCohort),
    femaleGeneral:text(c.femaleGeneral),femaleCohort:text(c.femaleCohort),
    signatureName:text(s.name),signatureDesignation:text(s.designation || 'N.O./APN'),
  };
}
function compiled(bytes) {
  assertDocxBytes(bytes);
  try {
    return new Docxtemplater(new PizZip(bytes), {paragraphLoop:true,linebreaks:true,
      nullGetter:() => ''});
  } catch (error) {
    throw new Error(`Invalid editable DOCX template: ${error.message || error}`);
  }
}
export function validateVisualTemplate(bytes) {
  const doc = compiled(bytes);
  const content = doc.getFullText();
  const missing = required.filter(name => !content.includes(`{${name}}`));
  // A generated document must not silently drop its required clinical data.
  if ((content.match(/\{ward\}/g) || []).length < 2) missing.push('ward (both tables)');
  if (missing.length) throw new Error(`Template is missing required data fields: ${missing.join(', ')}. Restore the placeholders before publishing.`);
  // Verify the actual merge rather than relying on presence of text alone.
  const sample = templateData({title:'Night Memo',header:{date:'17/10/2026'},
    mainTableRows:[Object.fromEntries(mainFields.map(field => [field,'SAMPLE']))],
    infectionRows:[Object.fromEntries(infectionFields.map(field => [field,'SAMPLE']))]});
  try {
    doc.render(sample);
    const output = doc.getFullText();
    // One row from each table has 13+9 fields. If a marker is outside its
    // loop, nullGetter would otherwise silently turn it into an empty cell.
    if ((output.match(/SAMPLE/g) || []).length < mainFields.length + infectionFields.length)
      throw new Error('Some ward field tags no longer occur inside their repeating table rows.');
  } catch (error) { throw new Error(`Template cannot merge ward data: ${error.message || error}`); }
  return bytes;
}
export function renderVisualTemplate(bytes, model) {
  const doc = compiled(bytes);
  try { doc.render(templateData(model)); }
  catch (error) { throw new Error(`Unable to generate memo from published template: ${error.message || error}`); }
  return assertDocxBytes(doc.getZip().generate({type:'uint8array',compression:'DEFLATE'}));
}
export async function buildEditableTemplateSample() {
  const row = (fields,group) => Object.fromEntries(fields.map((name,index) => [name,
    `${index === 0 ? `{#${group}}` : ''}{${name}}${index === fields.length - 1 ? `{/${group}}` : ''}`]));
  const sample = {
    title:'{title}',
    header:{fromName:'{fromName}',dectPhone:'{dectPhone}',callTeam:'{callTeam}',date:'{date}'},
    mainTableRows:[row(mainFields,'mainTableRows')],
    infectionRows:[row(infectionFields,'infectionRows')],
    earlyBirdHtml:'{earlyBirdText}',emptyBedHtml:'{emptyBedText}',
    additionalReportHtml:'{additionalReportText}',
    ct:{total:'{ctTotal}',maleGeneral:'{maleGeneral}',maleCohort:'{maleCohort}',
      femaleGeneral:'{femaleGeneral}',femaleCohort:'{femaleCohort}'},
    signature:{name:'{signatureName}',designation:'{signatureDesignation}'},
  };
  return buildManagerDocxBytes(sample);
}
