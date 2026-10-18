import { normalizeLoginId } from '../supabase/functions/_shared/login-identity.mjs';
// The application password is independent of the account ID and Auth password.
// Only disposable, synthetic-data demos permit short passwords.
export function validateMaintenancePassword(loginId, typedPassword, easyTestPasswords = false) {
  normalizeLoginId(loginId);
  const minimum = easyTestPasswords ? 2 : 8;
  if (typeof typedPassword !== 'string' || typedPassword.length < minimum || typedPassword.length > 128)
    throw new Error(`Password must contain ${minimum} to 128 characters.`);
  return true;
}
export function toStoredMaintenancePassword(loginId, typedPassword, easyTestPasswords = false) {
  validateMaintenancePassword(loginId, typedPassword, easyTestPasswords);
  return typedPassword; // Server hashes it; never write plaintext to SQL or to logs.
}
