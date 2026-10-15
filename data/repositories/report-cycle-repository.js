/** Typed report persistence; never uses rolling submission time windows. */
import { DB_MODE, supabase } from '../client.js';
import { demoRead, demoWrite, uid } from '../demo-state.js';
import { requireMemoType } from '../../domain/report-cycle.js';

function requireCurrentSchema(error) {
  if (/PGRST202|42883|42703|PGRST205|could not find|does not exist|unknown column/i.test(`${error?.code || ''} ${error?.message || ''}`)) {
    throw new Error('The database does not match the current Night Memo schema. Use a separate clean Supabase project configured for this version.');
  }
  if (/REPORT_CONFLICT/.test(error?.message || '')) {
    throw new Error(error.message);
  }
  throw error;
}
export async function getWardCycleReport(wardId, date, type) {
  requireMemoType(type);
  if (DB_MODE === 'demo') return demoRead().ward_reports.find(r => r.ward_id === wardId && r.report_date === date && r.report_type === type) || null;
  const { data, error } = await supabase.from('ward_reports').select('*').eq('ward_id', wardId).eq('report_date', date).eq('report_type', type).maybeSingle();
  if (error) requireCurrentSchema(error);
  return data;
}
export async function getCycleReports(date) {
  if (DB_MODE === 'demo') return demoRead().ward_reports.filter(r => r.report_date === date && ['pm','night'].includes(r.report_type));
  const { data, error } = await supabase.from('ward_reports').select('*').eq('report_date', date).in('report_type', ['pm', 'night']);
  if (error) requireCurrentSchema(error);
  return data || [];
}
export async function submitWardCycleReport(row) {
  requireMemoType(row.report_type);
  if (DB_MODE === 'demo') {
    const state = demoRead();
    const index = state.ward_reports.findIndex(r => r.ward_id === row.ward_id && r.report_date === row.report_date && r.report_type === row.report_type);
    const old = index < 0 ? null : state.ward_reports[index];
    const now = new Date().toISOString();
    const draft = (state.ward_cycle_drafts || []).find(d => d.ward_id === row.ward_id && d.report_date === row.report_date && d.report_type === row.report_type);
    if ((old?.revision || 0) !== row.expected_report_revision || (draft?.revision || 0) !== row.expected_draft_revision) {
      throw new Error('REPORT_CONFLICT: Memo or draft was changed elsewhere. Copy your unsaved changes and reload.');
    }
    const { expected_report_revision, expected_draft_revision, ...data } = row;
    const report = { ...old, ...data, id: old?.id || uid('report'), revision: (old?.revision || 0) + 1, submitted_at: now, updated_at: now, created_at: old?.created_at || now };
    if (index < 0) state.ward_reports.push(report); else state.ward_reports[index] = report;
    state.ward_cycle_drafts = (state.ward_cycle_drafts || []).filter(d => !(d.ward_id === row.ward_id && d.report_date === row.report_date && d.report_type === row.report_type));
    demoWrite(state); return report;
  }
  const { data, error } = await supabase.rpc('submit_ward_cycle_report', { p_row: row });
  if (error) requireCurrentSchema(error);
  return data;
}
export async function getWardCycleDraft(wardId, date, type) {
  requireMemoType(type);
  if (DB_MODE === 'demo') return (demoRead().ward_cycle_drafts || []).find(r => r.ward_id === wardId && r.report_date === date && r.report_type === type) || null;
  const { data, error } = await supabase.rpc('get_ward_cycle_draft', { p_ward_id: wardId, p_report_date: date, p_report_type: type });
  if (error) requireCurrentSchema(error);
  return data;
}
export async function saveWardCycleDraft(row) {
  requireMemoType(row.report_type);
  if (DB_MODE === 'demo') {
    const state = demoRead(); state.ward_cycle_drafts ||= [];
    const index = state.ward_cycle_drafts.findIndex(r => r.ward_id === row.ward_id && r.report_date === row.report_date && r.report_type === row.report_type);
    const old = index >= 0 ? state.ward_cycle_drafts[index] : null;
    const report = state.ward_reports.find(r => r.ward_id === row.ward_id && r.report_date === row.report_date && r.report_type === row.report_type);
    if ((old?.revision || 0) !== row.expected_draft_revision || (report?.revision || 0) !== row.expected_report_revision) {
      throw new Error('REPORT_CONFLICT: Memo or draft was changed elsewhere. Copy your unsaved changes and reload.');
    }
    const now = new Date().toISOString();
    const { expected_report_revision, expected_draft_revision, ...data } = row;
    const draft = { ...old, ...data, revision: (old?.revision || 0) + 1, updated_at: now };
    if (index < 0) state.ward_cycle_drafts.push(draft); else state.ward_cycle_drafts[index] = draft;
    demoWrite(state); return draft;
  }
  const { data, error } = await supabase.rpc('save_ward_cycle_draft', { p_row: row });
  if (error) requireCurrentSchema(error);
  return data;
}
export async function deleteWardCycleDraft(wardId, date, type, expectedRevision) {
  requireMemoType(type);
  if (DB_MODE === 'demo') {
    const state = demoRead();
    const draft = (state.ward_cycle_drafts || []).find(r => r.ward_id === wardId && r.report_date === date && r.report_type === type);
    if ((draft?.revision || 0) !== expectedRevision) throw new Error('REPORT_CONFLICT: Draft changed elsewhere.');
    state.ward_cycle_drafts = (state.ward_cycle_drafts || []).filter(r => !(r.ward_id === wardId && r.report_date === date && r.report_type === type));
    demoWrite(state); return true;
  }
  const { data, error } = await supabase.rpc('delete_ward_cycle_draft', { p_ward_id: wardId, p_report_date: date, p_report_type: type, p_expected_revision: expectedRevision });
  if (error) requireCurrentSchema(error);
  return data;
}
