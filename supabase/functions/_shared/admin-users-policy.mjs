import { normalizeLoginId } from './login-identity.mjs';
/** Input contract for the privileged account-management Edge Function.
 * Kept independent of Supabase/Deno so it can be tested in Node.
 */
export class InputError extends Error {
  constructor(message) { super(message); this.name = 'InputError'; }
}

const ROLES = new Set(['ward', 'patrol', 'maintenance']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value, name, maxLength, required = true) {
  if (value == null && !required) return null;
  if (typeof value !== 'string') throw new InputError(`${name} must be text.`);
  const normalized = value.trim();
  if (required && !normalized) throw new InputError(`${name} is required.`);
  if (normalized.length > maxLength) throw new InputError(`${name} is too long.`);
  return normalized || null;
}

function userId(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new InputError('Invalid user ID.');
  return value;
}

function accountId(value) {
  try { return normalizeLoginId(value); }
  catch (error) { throw new InputError(error.message); }
}

function password(value) {
  if (typeof value !== 'string' || value.length < 2 || value.length > 128) {
    throw new InputError('Password must contain 2 to 128 characters.');
  }
  return value;
}

function access(body) {
  if (!ROLES.has(body.role)) throw new InputError('Invalid account role.');
  if (body.role === 'ward') {
    if (!UUID.test(String(body.ward_id || ''))) throw new InputError('A ward account needs a valid assigned ward.');
  }
  return { role: body.role, ward_id: body.role === 'ward' ? body.ward_id : null };
}

function optionalDisplayName(value) {
  return text(value ?? '', 'Display name', 100, false);
}

function validateFields(body, fields) {
  for (const key of Object.keys(body)) {
    if (!fields.includes(key)) throw new InputError(`Unexpected field: ${key}.`);
  }
}

export function parseAdminCommand(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new InputError('Expected a JSON object.');
  }
  switch (body.action) {
    case 'list_accounts':
      validateFields(body, ['action']);
      return { action: 'list_accounts' };
    case 'create':
      validateFields(body, ['action', 'login_id', 'display_name', 'role', 'ward_id', 'password']);
      return {
        action: 'create', login_id: accountId(body.login_id),
        display_name: optionalDisplayName(body.display_name),
        ...access(body), password: password(body.password),
      };
    case 'update_account':
      validateFields(body, ['action','auth_user_id','login_id','display_name','role','ward_id','active']);
      {
        const changes = {};
        if (Object.hasOwn(body,'login_id')) changes.login_id = accountId(body.login_id);
        if (Object.hasOwn(body,'display_name')) changes.display_name = optionalDisplayName(body.display_name);
        if (Object.hasOwn(body,'role')) {
          Object.assign(changes,access(body));
        } else if (Object.hasOwn(body,'ward_id')) {
          changes.ward_id = body.ward_id;
        }
        if (Object.hasOwn(body,'active')) {
          if (typeof body.active !== 'boolean') throw new InputError('Invalid active status.');
          changes.active = body.active;
        }
        return {action:'update_account',auth_user_id:userId(body.auth_user_id),changes};
      }
    case 'rename_login':
      validateFields(body, ['action', 'auth_user_id', 'login_id', 'display_name']);
      return {
        action: 'rename_login', auth_user_id: userId(body.auth_user_id),
        login_id: accountId(body.login_id), display_name: optionalDisplayName(body.display_name),
      };
    case 'update_access':
      validateFields(body, ['action', 'auth_user_id', 'role', 'ward_id', 'active', 'display_name']);
      if (typeof body.active !== 'boolean') throw new InputError('Active status must be true or false.');
      return {
        action: 'update_access', auth_user_id: userId(body.auth_user_id),
        ...access(body), active: body.active, display_name: optionalDisplayName(body.display_name),
      };
    case 'reset_password':
      validateFields(body, ['action', 'auth_user_id', 'password']);
      return {
        action: 'reset_password', auth_user_id: userId(body.auth_user_id),
        password: password(body.password),
      };
    default:
      throw new InputError('Unsupported account operation.');
  }
}
