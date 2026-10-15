import test from 'node:test';
import assert from 'node:assert/strict';
import { reportSubmittedAt } from '../domain/report-session.js';
import { requireMemoType } from '../domain/report-cycle.js';
test('only explicit PM/Night submissions qualify as submitted reports',()=>{
  const record={report_type:'night',submitted_at:'2026-10-14T04:00:00Z'};
  assert.equal(reportSubmittedAt(record), record.submitted_at);
  assert.equal(reportSubmittedAt({updated_at:record.submitted_at}),null);
  assert.equal(reportSubmittedAt(null),null);
  assert.equal(requireMemoType('pm'),'pm');
  assert.throws(()=>requireMemoType('legacy'));
});
