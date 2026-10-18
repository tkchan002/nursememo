/**
 * Nurse Memo short-ID account-validation scheme and legacy Auth-email helper,
 * used by privileged account provisioning and bootstrap. This is NOT authorization:
 * Supabase Auth and user_access/RLS are the security boundaries.
 *
 * example.com is a reserved documentation domain. These internal addresses
 * cannot receive password reset mail: Maintenance resets passwords in-app.
 */
export const ACCOUNT_EMAIL_DOMAIN = 'accounts.nightmemo.example.com';
const LOGIN_ID = /^[A-Za-z][A-Za-z0-9_-]{1,31}$/;

export function normalizeLoginId(value) {
  const login = typeof value === 'string' ? value.trim() : '';
  if (!LOGIN_ID.test(login)) {
    throw new Error('Account ID must be 2–32 letters, numbers, underscores or hyphens, starting with a letter.');
  }
  return login;
}

export function loginIdToEmail(value) {
  return `${normalizeLoginId(value).toLowerCase()}@${ACCOUNT_EMAIL_DOMAIN}`;
}

/**
 * INSECURE TEST ACCOUNTS ONLY. Supabase Auth usually requires at least six
 * characters. For the synthetic-data test installation we let people enter
 * the same short ID in both boxes but submit a longer, predictable password.
 * This is convenience, NOT security. Never enable for real records/users.
 */
export function expandedTestPassword(loginId) {
  const id = normalizeLoginId(loginId).toLowerCase();
  // Include all common Auth password character classes; no need to weaken
  // Supabase's project-wide password policy for this disposable test data.
  return `NM-DEMO-${id}-Aa1!`;
}

