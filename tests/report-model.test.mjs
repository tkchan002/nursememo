import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDevice, deviceCount, formatDevice, effectiveItems, normalizeReportPayload } from '../domain/report-model.js';

test('typed device count or beds normalize consistently', () => {
  assert.deepEqual(normalizeDevice({ mode:'beds', beds:[11, 12, '12'] }), {mode:'beds',count:0,beds:['11','12']});
  assert.deepEqual(normalizeDevice({mode:'count',count:'3'}),{mode:'count',count:3,beds:[]});
  assert.equal(deviceCount({mode:'count',count:3}),3);
  assert.equal(formatDevice({mode:'beds',beds:[11,12]}),'11, 12');
});
test('obsolete payload keys and old data structures do not leak into current reports', () => {
  const data=normalizeReportPayload({legacyField:'discard',emptyBeds:{count:3,details:[{remark:'old'}],reported:{male:3},entries:[{quantity:1,designation:'T',remark:'TB'}]},admissionBySex:{admissionEC:{M:2,F:1}}});
  assert.equal('legacyField' in data,false);
  assert.deepEqual(data.emptyBeds,{count:3,entries:[{quantity:1,designation:'T',customDesignation:'',remark:'TB'}]});
  assert.deepEqual(data.admissionBySex.admissionEC,{M:2,F:1});
});
test('effective report item definitions remain date-scoped',()=>{
  const items=[{key:'old',active:false,effective_from:'2026-01-01',effective_to:'2026-12-31',sort_order:2},{key:'new',active:true,effective_from:'2027-01-01',effective_to:null,sort_order:1}];
  assert.deepEqual(effectiveItems(items,'2026-09-26',{includeInactiveHistorical:true}).map(x=>x.key),['old']);
  assert.deepEqual(effectiveItems(items,'2026-09-26',{includeInactiveHistorical:false}).map(x=>x.key),[]);
});
