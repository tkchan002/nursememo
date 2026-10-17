import test from 'node:test';
import assert from 'node:assert/strict';
import { todayISO, addDaysISO } from '../core/dates.js';
import { createRequestSequencer } from '../core/request-sequencer.js';
import { normalizeDocxLayout, DEFAULT_DOCX_LAYOUT } from '../documents/docx-layout.js';

test('report date follows Hong Kong calendar day rather than UTC day', () => {
  const instant = new Date('2026-09-25T16:30:00.000Z'); // 00:30 on 26 Sep in Hong Kong
  assert.equal(todayISO('Asia/Hong_Kong', instant), '2026-09-26');
});

test('request sequencer invalidates earlier async requests', () => {
  const seq = createRequestSequencer();
  const first = seq.begin();
  const second = seq.begin();
  assert.equal(seq.isCurrent(first), false);
  assert.equal(seq.isCurrent(second), true);
});

test('DOCX template only accepts bounded numeric layout fields', () => {
  assert.deepEqual(normalizeDocxLayout({}), DEFAULT_DOCX_LAYOUT);
  assert.throws(() => normalizeDocxLayout({marginMm:100}),/Invalid DOCX layout/);
  assert.throws(() => normalizeDocxLayout({bodyFontPt:'<script>'}),/Invalid DOCX layout/);
  assert.equal(normalizeDocxLayout({evil:'ignored'}).evil,undefined);
});

test('ISO date arithmetic is timezone-independent', () => {
  assert.equal(addDaysISO('2026-10-01', -1), '2026-09-30');
  assert.equal(addDaysISO('2026-03-01', -1), '2026-02-28');
});
