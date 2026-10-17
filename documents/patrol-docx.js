// A4 landscape master document. Word/ONLYOFFICE tables are used only when
// they provide robust grid alignment: the header and signature have NO borders.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, VerticalAlign, BorderStyle, PageOrientation,
} from 'docx';

// Internal fallback appearance only. Maintenance edits/publishes the DOCX itself.
const DEFAULT_DOCUMENT_STYLE = Object.freeze({
  marginMm: 12, bodyFontPt: 9, tableFontPt: 8, titleFontPt: 16,
  sectionFontPt: 10, cellPaddingMm: 1, headerLeftPercent: 60,
  signatureWidthPercent: 43,
});
const FONT = 'Arial';
const PAGE_WIDTH = 16838; // A4 landscape, twentieths of a point.
const twipsFromMm = value => Math.round(value * 1440 / 25.4);
const hp = points => Math.round(points * 2);
const str = x => String(x ?? '');
const border = {style: BorderStyle.SINGLE, size: 4, color: '444444'};
const borders = {top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border};
const none = {style:BorderStyle.NONE};
const noBorders = {top:none,bottom:none,left:none,right:none,insideHorizontal:none,insideVertical:none};
const run = (text, size, opts = {}) => new TextRun({text: str(text), font: FONT, size: hp(size), ...opts});

function splitWidths(widths, availableWidth) {
  const total = widths.reduce((a,b)=>a+b,0);
  const result = widths.map(x=>Math.round(x / total * availableWidth));
  result[result.length-1] += availableWidth - result.reduce((a,b)=>a+b,0);
  return result;
}
function textPara(text, size, options = {}) {
  return new Paragraph({children:[run(text, size, {bold: options.bold || false})],
    alignment: options.align || AlignmentType.LEFT,
    spacing: {before:0,after: options.after ?? 55},
    keepWithNext: !!options.keepWithNext,
  });
}
function heading(text, layout) {
  return textPara(text, layout.sectionFontPt, {bold:true, after:55,keepWithNext:true});
}
function richLines(html, layout) {
  const normalized = str(html)
    .replace(/<\s*br\s*\/?\s*>|<\/(?:div|p|li)>/gi,'\n')
    .replace(/<[^>]*>/g,'')
    .replace(/&nbsp;/gi,' ').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&amp;/gi,'&')
    .trim();
  const lines = normalized.split('\n').map(line=>line.trim()).filter(Boolean);
  return (lines.length ? lines : [' ']).map(line => textPara(line,layout.bodyFontPt,{after:30}));
}
function textCell(text, layout, {header=false, align=AlignmentType.CENTER, columnSpan, rowSpan}={}) {
  return new TableCell({
    children:[textPara(text, layout.tableFontPt,{bold:header,align,after:0})],
    verticalAlign: VerticalAlign.CENTER,
    margins:{top:twipsFromMm(layout.cellPaddingMm),bottom:twipsFromMm(layout.cellPaddingMm),left:50,right:50},
    shading:header?{fill:'F0F0F0'}:undefined,
    ...(columnSpan?{columnSpan}:{}), ...(rowSpan?{rowSpan}:{}),
  });
}
function gridTable(headers, rows, keyOrder, proportions, layout, availableWidth) {
  const widths=splitWidths(proportions,availableWidth);
  const row = values => new TableRow({cantSplit:true,children:values.map(value=>textCell(value,layout))});
  return new Table({width:{size:availableWidth,type:WidthType.DXA},columnWidths:widths,
    borders,rows:[new TableRow({tableHeader:true,cantSplit:true,children:headers.map(text=>textCell(text,layout,{header:true}))}),
      ...rows.map(values=>row(keyOrder.map(key=>str(values[key]))))]});
}
function admissionTable(m, layout, availableWidth) {
  const keys=['ward','admissionEC','admissionCC','transferIn','discharge','transferOut','death','totalPatient','emptyBed','ventilator','bipap','hfnc','staff'];
  const widths=splitWidths([850,...Array(6).fill(710),1850,1600,1550,1500,1450,2340],availableWidth);
  const top=[['Ward',1,2],['Admission',3],['Discharge',3],['Total Patient',1,2],['Empty Bed',1,2],['Vent. Case',1,2],['BiPAP Case',1,2],['HFNC Case',1,2],['AM/PM Staff No.',1,2]];
  const topRow = new TableRow({tableHeader:true,cantSplit:true,children:top.map(([text,colSpan,rowSpan])=>textCell(text,layout,{header:true,columnSpan:colSpan,rowSpan}))});
  const subRow = new TableRow({tableHeader:true,cantSplit:true,children:['E/C','C/C','T/I','Home','T/O','Death'].map(text=>textCell(text,layout,{header:true}))});
  const dataRows=(m.mainTableRows||[]).map(r=>new TableRow({cantSplit:true,children:keys.map(k=>textCell(r[k],layout))}));
  return new Table({width:{size:availableWidth,type:WidthType.DXA},columnWidths:widths,borders,rows:[topRow,subRow,...dataRows]});
}
function headerBlock(header, layout, availableWidth) {
  const leftWidth=Math.round(availableWidth*layout.headerLeftPercent/100);
  const rightWidth=availableWidth-leftWidth;
  const left = [
    `From : N.O./APN, ${str(header.fromName)}`,
    `Dect Phone : ${str(header.dectPhone)}`,
    `Call (Team) : ${str(header.callTeam)}`,
  ];
  const right = [`To : DOM / Medical (QEH)`,`Date : ${str(header.date)}`];
  const cell = lines => new TableCell({children:lines.map(line=>textPara(line,layout.bodyFontPt,{after:10})),
    verticalAlign:VerticalAlign.TOP,margins:{top:0,bottom:0,left:0,right:70}});
  return new Table({width:{size:availableWidth,type:WidthType.DXA},columnWidths:[leftWidth,rightWidth],
    borders:noBorders,rows:[new TableRow({cantSplit:true,children:[cell(left),cell(right)]})]});
}
function signatureBlock(signature,layout,availableWidth) {
  const rightWidth=Math.round(availableWidth*layout.signatureWidthPercent/100);
  const leftWidth=availableWidth-rightWidth;
  // The signature follows the final content in normal flow. There is deliberately
  // no absolute positioning, page-break, footer or table heading.
  const name=str(signature.name).trim();
  const designation=str(signature.designation || 'N.O./APN').trim();
  const lines=[
    `Signature: ________________________________`,
    `${designation}: ${name || '________________________________'}`,
  ];
  const right=new TableCell({children:lines.map((line,i)=>textPara(line,layout.bodyFontPt,{after:i?0:90,keepWithNext:i===0})),
    margins:{top:60,bottom:0,left:0,right:0}});
  const left=new TableCell({children:[textPara(' ',layout.bodyFontPt,{after:0})],margins:{top:0,bottom:0,left:0,right:0}});
  return new Table({width:{size:availableWidth,type:WidthType.DXA},columnWidths:[leftWidth,rightWidth],
    borders:noBorders,rows:[new TableRow({cantSplit:true,children:[left,right]})]});
}

export function createNightMemoDocument(m={}) {
  const layout=DEFAULT_DOCUMENT_STYLE;
  const h=m.header||{},c=m.ct||{},s=m.signature||{};
  const margin=twipsFromMm(layout.marginMm);
  const width=PAGE_WIDTH-2*margin;
  const infectionKeys=['ward','covid','cre','vre','mdra','cd','influenza','hdCapd','remarks'];
  const infectionHeaders=['Ward','COVID-19','CRE','VRE','MDRA','CD','Influenza','No. of HD / CAPD case','Remarks'];
  const children=[
    new Paragraph({children:[run(m.title||'Night Memo',layout.titleFontPt,{bold:true,underline:{color:'000000'}})],
      alignment:AlignmentType.CENTER,spacing:{after:150},keepWithNext:true}),
    headerBlock(h,layout,width),
    heading('Admission / Discharge',layout),
    admissionTable(m,layout,width),
    heading('Infectious Case:',layout),
    gridTable(infectionHeaders,m.infectionRows||[],infectionKeys,[950,1700,1700,1550,1500,950,1750,3150,2150],layout,width),
    heading('Early bird:',layout),...richLines(m.earlyBirdHtml,layout),
    heading('Empty Bed:',layout),...richLines(m.emptyBedHtml,layout),
    heading('Additional Report:',layout),...richLines(m.additionalReportHtml,layout),
    heading(`Total No. of CT scan done: ${str(c.total)}`,layout),
    textPara('At 6:00',layout.bodyFontPt,{after:30,keepWithNext:true}),
    gridTable(['','General','Cohort'],[
      {label:'Male',general:c.maleGeneral,cohort:c.maleCohort},
      {label:'Female',general:c.femaleGeneral,cohort:c.femaleCohort},
    ],['label','general','cohort'],[2200,1700,1700],layout,Math.round(width*.37)),
    signatureBlock(s,layout,width),
  ];
  return new Document({sections:[{properties:{page:{size:{width:11906,height:PAGE_WIDTH,orientation:PageOrientation.LANDSCAPE},
    margin:{top:margin,bottom:margin,left:margin,right:margin,header:360,footer:360}}},children}]});
}
export async function buildPatrolDocxBytes(model) {
  return new Uint8Array(await (await Packer.toBlob(createNightMemoDocument(model))).arrayBuffer());
}
