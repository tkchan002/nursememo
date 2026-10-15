import test from 'node:test';
import assert from 'node:assert/strict';
import { availableEmptyBedDesignations, formatEmptyBedEntries, validateEmptyBedEntries } from '../domain/empty-bed-reporting.js';

test('current M/F/S/D/T/Other manual entries never change the calculated total', () => {
  const entries=[{quantity:1,designation:'M',remark:'TB'},{quantity:2,designation:'S',remark:''}, {quantity:1,designation:'D',remark:''}];
  assert.equal(formatEmptyBedEntries(entries),'1M (TB), 2S, 1D');
  assert.deepEqual(validateEmptyBedEntries(entries),[]);
  assert.equal(Object.hasOwn(entries,'total'),false);
});
test('S/D are ward-enabled but existing saved selections remain editable', () => {
  assert.deepEqual(availableEmptyBedDesignations({single_double_reporting_enabled:false}),['M','F','T','OTHER']);
  assert.deepEqual(availableEmptyBedDesignations({single_double_reporting_enabled:true}),['M','F','S','D','T','OTHER']);
  assert.ok(availableEmptyBedDesignations({single_double_reporting_enabled:false},'D').includes('D'));
});
