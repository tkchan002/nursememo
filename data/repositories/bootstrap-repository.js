/** Maintenance-only snapshot; no pre-PM/Night reporting RPCs. */
import { DB_MODE, supabase } from '../client.js';
export async function getMaintenanceWardsSnapshot() {
  if (DB_MODE !== 'supabase') return null;
  const { data, error } = await supabase.rpc('get_maintenance_wards_snapshot');
  if (error) throw error;
  return data;
}
