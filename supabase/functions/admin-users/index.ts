import { withSupabase } from 'npm:@supabase/server@1';
import { InputError, parseAdminCommand } from '../_shared/admin-users-policy.mjs';
import { loadAccountDirectory } from '../_shared/account-directory.mjs';

// The browser MUST never receive a service-role/secret key. The wrapper supplies
// an RLS-scoped client for authentication and an admin client for controlled writes.
const PUBLIC_COLUMNS = 'auth_user_id,login_id,display_name,role,ward_id,active,created_at,updated_at';

async function writeAccess(db: any, actor: string, action: string, account: Record<string, unknown>) {
  return await db.rpc('admin_write_user_access', { p_actor: actor, p_action: action, p_account: account });
}

function reply(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function databaseError(error: { code?: string } | null) {
  if (error?.code === '23505') return reply('Account or ward assignment already exists.', 409);
  if (error?.code === '23503') return reply('Assigned ward does not exist.', 400);
  if (error?.code === '23514') return reply('Account values violate database rules.', 400);
  console.error('Account database operation failed:', error?.code || 'unknown');
  return reply('Unable to complete account operation.', 500);
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, ctx) => {
    if (request.method !== 'POST') return reply('Method not allowed.', 405);

    const actorId = ctx.userClaims?.id;
    if (!actorId) return reply('Authentication required.', 401);

    // The caller-scoped client obeys RLS; no privileged operation occurs until
    // this explicit maintenance-role authorization succeeds.
    const { data: caller, error: callerError } = await ctx.supabase
      .from('user_access')
      .select('role,active')
      .eq('auth_user_id', actorId)
      .maybeSingle();
    if (callerError) return reply('Cannot verify account permissions.', 500);
    if (!caller?.active || caller.role !== 'maintenance') {
      return reply('Maintenance permission required.', 403);
    }

    let command;
    try {
      command = parseAdminCommand(await request.json());
    } catch (error) {
      if (error instanceof InputError || error instanceof SyntaxError) {
        return reply(error.message, 400);
      }
      return reply('Invalid request body.', 400);
    }

    const db = ctx.supabaseAdmin;
    if (command.action === 'list_accounts') {
      // Both public.user_access and the actual Auth directory are read under
      // the already-verified Maintenance permission. Never return Auth's full
      // user objects: they can contain sensitive, irrelevant information.
      try {
        return Response.json(await loadAccountDirectory(db, PUBLIC_COLUMNS));
      } catch (error) {
        console.error('Supabase Auth account listing failed:', error instanceof Error ? error.name : 'unknown');
        return reply('Unable to verify Supabase Authentication accounts.', 503);
      }
    }
    let targetId: string;
    let result: unknown;

    if (command.action === 'create') {
      // Auth users and app permissions are separate records. If the second
      // write fails, clean up the newly-created Auth user rather than leave
      // an orphaned account that cannot log in.
      const secretBytes = crypto.getRandomValues(new Uint8Array(48));
      const internalPassword = Array.from(secretBytes, b => b.toString(16).padStart(2,'0')).join('');
      const { data: created, error: authError } = await db.auth.admin.createUser({
        email: `app-${crypto.randomUUID()}@accounts.nightmemo.example.com`,
        password: internalPassword,
        email_confirm: true,
      });
      if (authError || !created?.user) {
        console.error('Auth user creation failed:', authError?.code || 'unknown');
        return reply('Unable to create login; the email may already exist.', 409);
      }
      targetId = created.user.id;
      const { data, error } = await writeAccess(db, actorId, 'create', {
        auth_user_id: targetId, login_id: command.login_id,
        display_name: command.display_name,
        role: command.role, ward_id: command.ward_id, active: true,
      });
      if (error) {
        const { error: rollbackError } = await db.auth.admin.deleteUser(targetId);
        if (rollbackError) console.error('Auth rollback failed:', rollbackError.code || 'unknown');
        return databaseError(error);
      }
      const { error: credentialError } = await db.rpc('app_login_set_password', {
        p_actor:actorId,p_user_id:targetId,p_password:command.password,
      });
      if (credentialError) {
        const { error: rollbackError } = await db.auth.admin.deleteUser(targetId);
        if (rollbackError) console.error('Account rollback failed:', rollbackError.code || 'unknown');
        return databaseError(credentialError);
      }
      result = data;
    } else {
      targetId = command.auth_user_id;
      const { data: existing, error: lookupError } = await db.from('user_access')
        .select(PUBLIC_COLUMNS).eq('auth_user_id', targetId).maybeSingle();
      if (lookupError) return databaseError(lookupError);
      if (!existing) return reply('Account not found.', 404);

      if (command.action === 'reset_password') {
        const { error } = await db.rpc('app_login_set_password', {
          p_actor:actorId,p_user_id:targetId,p_password:command.password,
        });
        if (error) return databaseError(error);
        result = {auth_user_id:targetId,password_reset:true};
      } else if (command.action === 'update_account') {
        const { data, error } = await db.rpc('app_update_account', {
          p_actor:actorId,p_target:targetId,p_changes:command.changes,
        });
        if (error) return databaseError(error);
        result = data;
      } else {
        return reply('This account operation is no longer available. Refresh Maintenance.', 400);
      }
    }

    // App account edits are audited atomically by PostgreSQL. Password hashes
    // are stored only in protected database rows; never log a password.
    return Response.json(result);
  }),
};
