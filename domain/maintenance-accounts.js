import { normalizeLoginId, passwordForSupabase } from '../supabase/functions/_shared/login-identity.mjs';

/** Browser-side UX check. The privileged function independently enforces the
 * stronger 8-128 character rule on the actual stored password.
 */
export function validateMaintenancePassword(loginId, typedPassword, easyTestPasswords = false) {
  const id = normalizeLoginId(loginId);
  if (typeof typedPassword !== 'string') throw new Error('Enter a new password.');
  if (typedPassword.length > 128) throw new Error('Password must not exceed 128 characters.');
  if (easyTestPasswords === true && typedPassword.toLowerCase() === id.toLowerCase()) return true;
  if (typedPassword.length < 8) {
    throw new Error('Use at least 8 characters, or the matching account ID in the explicitly enabled test environment.');
  }
  return true;
}

/** A matching short ID is expanded ONLY in deliberately insecure test mode.
 * No environment toggles, hashes, or passwords are persisted by this module.
 */
export function toStoredMaintenancePassword(loginId, typedPassword, easyTestPasswords = false, dbMode = 'supabase') {
  validateMaintenancePassword(loginId, typedPassword, easyTestPasswords);
  return dbMode === 'supabase'
    ? passwordForSupabase(loginId, typedPassword, easyTestPasswords)
    : typedPassword;
}
