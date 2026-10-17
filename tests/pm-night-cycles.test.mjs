import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  reportNightDate, defaultMemoType, requireMemoType,
  combinedMovementValue, missingMemoTypes, selectLatestCensus,
} from '../domain/report-cycle.js';
import {
  buildManagerMemoData,
  sourceSnapshotFromBundle, sourceSnapshotSignature,
} from '../domain/manager-memo.js';
import { normalizeReportPayload } from '../domain/report-model.js';

const pm = { id: 'pm-1', ward_id: 'w1', report_type: 'pm', submitted_at: '2026-10-12T13:12:00Z', payload: {
  admissionEC: '3', admissionCC: '1', transferIn: '0', discharge: '2', transferOut: '0', death: '0', totalPatientM: '26',
  admissionBySex: { admissionEC: { M: 2, F: 1 }, admissionCC: { M: 1, F: 0 }, transferIn: { M: 0, F: 0 } },
  emptyBeds: { count: 4, entries: [{ quantity: 2, designation: 'T', remark: 'Review' }] },
} };
const night = { id: 'night-1', ward_id: 'w1', report_type: 'night', submitted_at: '2026-10-12T20:04:00Z', payload: {
  admissionEC: '2', admissionCC: '0', transferIn: '1', discharge: '1', transferOut: '1', death: '0', totalPatientM: '27',
  admissionBySex: { admissionEC: { M: 0, F: 2 }, admissionCC: { M: 0, F: 0 }, transferIn: { M: 1, F: 0 } },
  emptyBeds: { count: 3, entries: [{ quantity: 1, designation: 'OTHER', customDesignation: 'ISO', remark: 'TB' }] },
} };
const ward = { id: 'w1', name: 'Ward A', empty_bed_gender_mode: 'male' };
const bundle = [{ ward, capacity: 30, pmReport: pm, nightReport: night, report: night }];

test('reporting-night identity is the same at 9PM and following 4AM in Hong Kong', () => {
  assert.equal(reportNightDate(new Date('2026-10-12T21:00:00+08:00')), '2026-10-12');
  assert.equal(reportNightDate(new Date('2026-10-13T04:00:00+08:00')), '2026-10-12');
  assert.equal(defaultMemoType(new Date('2026-10-13T04:00:00+08:00')), 'night');
  assert.equal(defaultMemoType(new Date('2026-10-12T21:00:00+08:00')), 'pm');
  assert.throws(() => requireMemoType('legacy'));
});

test('non-overlapping PM and Night movements are added, never latest-only', () => {
  const row = buildManagerMemoData({ bundle, reportingDate: '2026-10-12' }).mainTableRows[0];
  assert.equal(row.admissionEC,'5');
  assert.equal(row.admissionCC,'1');
  assert.equal(row.transferIn,'1');
  assert.equal(row.discharge,'3');
  assert.equal(row.transferOut,'1');
  assert.equal(row.death,'0');
});

test('4AM census is latest and not the sum of PM + Night', () => {
  const row = buildManagerMemoData({ bundle }).mainTableRows[0];
  assert.equal(row.totalPatient,'27');
  assert.match(row.emptyBed,/3 \(1ISO \(TB\)\)/);
  assert.equal(selectLatestCensus(pm, night), night);
});

test('missing memo is visible to callers rather than treated as completed zero', () => {
  assert.deepEqual(missingMemoTypes(pm, null), ['night']);
  assert.deepEqual(missingMemoTypes(null, night), ['pm']);
  assert.deepEqual(missingMemoTypes(null, null), ['pm', 'night']);
  assert.equal(combinedMovementValue(null, null, 'admissionEC'), '');
  const partial = buildManagerMemoData({ bundle: [{ ward, capacity: 30, pmReport: pm, nightReport: null, report: pm }] }).mainTableRows[0];
  assert.equal(partial.admissionEC,'3');
  assert.equal(partial.totalPatient,'26');
});

test('manager source snapshot records both original source report IDs and their type', () => {
  const snapshot = sourceSnapshotFromBundle(bundle);
  assert.equal(snapshot.length, 2);
  assert.deepEqual(snapshot.map(x => [x.memo_type, x.report_id]), [['night', 'night-1'], ['pm', 'pm-1']]);
  assert.notEqual(sourceSnapshotSignature(snapshot), sourceSnapshotSignature(snapshot.slice(0, 1)));
});

test('regeneration source data is independent of existing edited DOCX bytes',()=>{
  const initial=buildManagerMemoData({bundle});
  const regenerated=buildManagerMemoData({bundle:[{ward,capacity:30,pmReport:null,nightReport:night,report:night}]});
  assert.notEqual(initial.mainTableRows[0].admissionEC,regenerated.mainTableRows[0].admissionEC);
  assert.ok(Object.hasOwn(regenerated,'additionalReportHtml'));
});

test('current report default includes explicit M/F categories',()=>{
 const current=normalizeReportPayload({admissionEC:'7'});
 assert.equal(current.admissionEC,'7');
 assert.deepEqual(current.admissionBySex.admissionEC,{M:0,F:0});
 const typed=normalizeReportPayload(night.payload);
 assert.equal(typed.admissionBySex.admissionEC.F,2);
});

test('server migration scopes reports by ward, reporting date and memo type, preserving revisions', async () => {
  const sql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /unique \(ward_id, report_date, report_type\)/i);
  assert.match(sql, /report_type in \('pm','night'\)/i);
  assert.match(sql, /create table public\.ward_cycle_revisions/i);
  assert.match(sql, /on conflict \(ward_id, report_date, report_type\)/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /ward_operating_periods/i);
  const submitSql = sql.split('create or replace function public.submit_ward_cycle_report(')[1].split('create or replace function public.get_ward_cycle_draft(')[0];
  assert.doesNotMatch(submitSql, /ward_operational_on\(/i); 
});
