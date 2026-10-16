// Browser-only DOCX generator. Ward calculations are owned by domain/manager-memo.js.
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, VerticalAlign, BorderStyle, PageOrientation } from 'docx';
const W=15400, FONT='Arial';
const border={style:BorderStyle.SINGLE,size:4,color:'858585'};
const borders={top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border};
const noBorders=Object.fromEntries(Object.keys(borders).map(x=>[x,{style:BorderStyle.NONE}]));
const str=x=>String(x??'');
const run=(t,bold=false,size=18)=>new TextRun({text:str(t),font:FONT,bold,size});
const paragraph=(t,bold=false)=>new Paragraph({children:[run(t,bold)],spacing:{after:85}});
const section=t=>new Paragraph({children:[run(t,true,21)],spacing:{before:165,after:100}});
const cell=(t,header=false)=>new TableCell({children:[new Paragraph({children:[run(t,header,header?16:18)],alignment:AlignmentType.CENTER,spacing:{before:0,after:0}})],verticalAlign:VerticalAlign.CENTER,shading:header?{fill:'E9EEF2'}:undefined,margins:{top:65,bottom:65,left:45,right:45}});
function table(headers,rows,widths,{bordered=true}={}){
  return new Table({width:{size:widths.reduce((a,b)=>a+b,0),type:WidthType.DXA},columnWidths:widths,borders:bordered?borders:noBorders,
    rows:[new TableRow({tableHeader:true,cantSplit:true,children:headers.map(h=>cell(h,bordered))}),...rows.map(values=>new TableRow({cantSplit:true,children:values.map(v=>cell(v))}))]});
}
function plain(x){return str(x).replace(/<\s*br\s*\/?\s*>|<\/(?:div|p)>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').trim();}
export function createNightMemoDocument(m={}){
 const h=m.header||{},c=m.ct||{},s=m.signature||{};
 const aKeys=['ward','admissionEC','admissionCC','transferIn','discharge','transferOut','death','totalPatient','emptyBed','ventilator','bipap','hfnc','staff'];
 const aHeads=['Ward','E/C','C/C','T/I','Home','T/O','Death','Total Patient','Empty Bed','Vent. Case','BiPAP Case','HFNC Case','AM/PM Staff No.'];
 const iKeys=['ward','covid','cre','vre','mdra','cd','influenza','hdCapd','remarks'];
 const iHeads=['Ward','COVID-19','CRE','VRE','MDRA','CD','Influenza','No. of HD / CAPD case','Remarks'];
 const children=[
  new Paragraph({children:[run(m.title||'Night Memo',true,34)],alignment:AlignmentType.CENTER,spacing:{after:130}}),
  table(['From:','N.O./APN, '+str(h.fromName),'To:','DOM/Medical (QEH)'],[
    ['DECT Phone:',h.dectPhone,'Date:',h.date],['Call (Team):',h.callTeam,'','']
  ],[1800,5850,1350,6400],{bordered:false}),
  section('Admissions / discharge / bed status'),
  table(aHeads,(m.mainTableRows||[]).map(r=>aKeys.map(k=>str(r[k]))),[850,...Array(6).fill(710),1850,1600,1550,1500,1450,2340]),
  section('Infectious Case'),
  table(iHeads,(m.infectionRows||[]).map(r=>iKeys.map(k=>str(r[k]))),[1200,1450,800,800,1000,800,1300,2900,5150]),
  section('Early Bird'),paragraph(plain(m.earlyBirdHtml)||' '),
  section('Empty Bed'),paragraph(plain(m.emptyBedHtml)||' '),
  section('Additional Report'),paragraph(plain(m.additionalReportHtml)||' '),
  section('Total No. of CT scan done: '+str(c.total)),section('At 06:00'),
  table(['','General','Cohort'],[['Male',c.maleGeneral,c.maleCohort],['Female',c.femaleGeneral,c.femaleCohort]],[2800,2500,2500]),
  section('Signature / Designation'),
  table(['Signature: '+str(s.name),'Designation: '+str(s.designation||'N.O./APN')],[],[7600,7800],{bordered:false}),
 ];
 return new Document({sections:[{properties:{page:{size:{width:11906,height:16838,orientation:PageOrientation.LANDSCAPE},margin:{top:680,bottom:680,left:700,right:700,header:360,footer:360}}},children}]});
}
export async function buildManagerDocxBytes(model){return new Uint8Array(await (await Packer.toBlob(createNightMemoDocument(model))).arrayBuffer());}
