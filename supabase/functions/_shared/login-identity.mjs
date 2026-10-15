/**
 * Night Memo short-ID credential scheme, shared by the website, privileged
 * account management and one-time bootstrap. This is NOT authorization:
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
