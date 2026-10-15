import { loginIdToEmail } from './login-identity.mjs';

/** Combine Night Memo access rows with actual Supabase Auth users.
 * This is a pure projection: NEVER serialize Auth's password/hash, provider
 * secrets, refresh tokens, or other unrelated user metadata to the browser.
 */
export function reconcileAccountDirectory(accessRows, authUsers) {
  const usersById = new Map((authUsers || []).map(user => [user.id, user]));
  return (accessRows || []).map(access => {
    const auth = usersById.get(access.auth_user_id);
    return {
      auth_user_id: access.auth_user_id,
      login_id: access.login_id,
      display_name: access.display_name,
      role: access.role,
      ward_id: access.ward_id,
      wards: access.wards || null,
      active: access.active,
      created_at: access.created_at,
      updated_at: access.updated_at,
      auth_exists: Boolean(auth),
      auth_email: auth?.email || null,
      auth_last_sign_in_at: auth?.last_sign_in_at || null,
      auth_email_confirmed: Boolean(auth?.email_confirmed_at),
      auth_login_matches: Boolean(auth && auth.email?.toLowerCase() === loginIdToEmail(access.login_id)),
    };
  }).sort((a, b) => a.login_id.localeCompare(b.login_id));
}

/** Paginate until all Auth users are collected; never silently publish a
 * truncated directory. Admin API is only called after role authorization.
 */
export async function fetchAllAuthUsers(authAdmin, perPage = 200, maxPages = 100) {
  const users = [];
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await authAdmin.listUsers({ page, perPage });
    if (error) throw error;
    if (!Array.isArray(data?.users)) throw new Error('Invalid Supabase Auth user-list response.');
    users.push(...data.users);
    if (data.users.length < perPage) return users;
  }
  throw new Error('Supabase Auth directory exceeds the supported listing limit.');
}

/** Read canonical permissions and Supabase Auth together. Never fall back to
 * a partially populated directory if either backend fails.
 */
export async function loadAccountDirectory(db, publicColumns) {
  const { data: accessRows, error: accessError } = await db.from('user_access')
    .select(`${publicColumns},wards(id,name)`).order('login_id');
  if (accessError) throw accessError;
  const authUsers = await fetchAllAuthUsers(db.auth.admin);
  return reconcileAccountDirectory(accessRows, authUsers);
}
