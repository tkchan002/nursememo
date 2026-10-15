/** Submitted PM/Night report history. One canonical storage format. */
import { DB_MODE, supabase } from '../client.js';
import { demoRead } from '../demo-state.js';

function newestFirst(a, b) {
  return String(b.submitted_at).localeCompare(String(a.submitted_at));
}

export async function getRecentReports(wardId, limit = 30) {
  if (DB_MODE === 'demo') return demoRead().ward_reports
    .filter(row => row.ward_id === wardId && ['pm', 'night'].includes(row.report_type) && row.submitted_at)
    .sort(newestFirst).slice(0, limit);
  const { data, error } = await supabase.from('ward_reports').select('*')
    .eq('ward_id', wardId).in('report_type', ['pm', 'night'])
    .order('submitted_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

/** Previous *submitted* report of the same ward, excluding the current report. */
export async function getPreviousReport(wardId, beforeDate, excludeReportId = null) {
  if (DB_MODE === 'demo') return demoRead().ward_reports
    .filter(row => row.ward_id === wardId && row.report_date <= beforeDate
      && ['pm', 'night'].includes(row.report_type) && row.submitted_at
      && (!excludeReportId || row.id !== excludeReportId))
    .sort(newestFirst)[0] || null;
  const { data, error } = await supabase.from('ward_reports').select('*')
    .eq('ward_id', wardId).in('report_type', ['pm', 'night'])
    .lte('report_date', beforeDate)
    .order('submitted_at', { ascending: false }).limit(excludeReportId ? 10 : 1);
  if (error) throw error;
  return (data || []).find(row => row.id !== excludeReportId) || null;
}
