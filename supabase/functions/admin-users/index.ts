import { withSupabase } from 'npm:@supabase/server@1';
import { InputError, parseAdminCommand } from '../_shared/admin-users-policy.mjs';
import { loginIdToEmail } from '../_shared/login-identity.mjs';

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
    let targetId: string;
    let result: unknown;

    if (command.action === 'create') {
      // Auth users and app permissions are separate records. If the second
      // write fails, clean up the newly-created Auth user rather than leave
      // an orphaned account that cannot log in.
      const { data: created, error: authError } = await db.auth.admin.createUser({
        email: loginIdToEmail(command.login_id),
        password: command.password,
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
      result = data;
    } else {
      targetId = command.auth_user_id;
      const { data: existing, error: lookupError } = await db.from('user_access')
        .select(PUBLIC_COLUMNS).eq('auth_user_id', targetId).maybeSingle();
      if (lookupError) return databaseError(lookupError);
      if (!existing) return reply('Account not found.', 404);

      if (command.action === 'reset_password') {
        const { error: auditError } = await db.from('audit_log').insert({
          actor_user_id: actorId, action: 'account.reset_password.requested',
          entity_type: 'user_access', entity_id: targetId, details: {},
        });
        if (auditError) return databaseError(auditError);
        const { error } = await db.auth.admin.updateUserById(targetId, { password: command.password });
        if (error) {
          console.error('Password reset failed:', error.code || 'unknown');
          return reply('Unable to reset password.', 500);
        }
        result = { auth_user_id: targetId, password_reset: true };
      } else if (command.action === 'update_access') {
        if (targetId === actorId && (command.role !== 'maintenance' || !command.active)) {
          return reply('You cannot revoke your own maintenance access.', 400);
        }
        const { data, error } = await writeAccess(db, actorId, 'update_access', {
          auth_user_id: targetId, role: command.role, ward_id: command.ward_id,
          active: command.active, display_name: command.display_name,
        });
        if (error) return databaseError(error);
        result = data;
      } else if (command.action === 'rename_login') {
        // Keep Auth email and the app login ID synchronized. Roll back Auth
        // email if the database update fails (e.g., unique login constraint).
        const { data: authUser, error: findError } = await db.auth.admin.getUserById(targetId);
        if (findError || !authUser?.user?.email) return reply('Authentication account not found.', 404);
        const previousEmail = authUser.user.email;
        const { error: renameError } = await db.auth.admin.updateUserById(targetId, {
          email: loginIdToEmail(command.login_id), email_confirm: true,
        });
        if (renameError) return reply('Unable to change account email.', 409);
        const { data, error } = await writeAccess(db, actorId, 'rename_login', {
          auth_user_id: targetId, login_id: command.login_id, display_name: command.display_name,
        });
        if (error) {
          const { error: rollbackError } = await db.auth.admin.updateUserById(targetId, {
            email: previousEmail, email_confirm: true,
          });
          if (rollbackError) console.error('Email rollback failed:', rollbackError.code || 'unknown');
          return databaseError(error);
        }
        result = data;
      }
    }

    // Metadata writes are audited in the same PostgreSQL transaction. Password
    // reset requests are audited before the Auth API is invoked. Never log a password.
    return Response.json(result);
  }),
};
