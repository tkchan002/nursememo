import { DB_MODE, supabase } from '../data/client.js';
import { ensureDemoState } from '../data/demo-state.js';
import { getCurrentAccess } from '../data/repositories/access-repository.js';

const LOGIN_PAGE = './index.html';

function returnToLogin() {
  location.replace(LOGIN_PAGE);
}

async function clearSession() {
  if (DB_MODE === 'demo') {
    sessionStorage.removeItem('nightMemoDemoSession');
    return;
  }
  await supabase.auth.signOut();
}

/**
 * Authenticate credentials only.
 *
 * Role/access authorization belongs to requireRole() on the destination page.
 * This avoids querying user_access once here and then immediately querying the
 * same row again after navigation. Supabase RLS / Edge Functions remain the
 * security boundary for protected data and privileged actions.
 */
export async function signIn(account, password, expectedRole = null) {
  account = String(account || '').trim();
  if (!account || !password) throw new Error('Enter account and password.');

  if (DB_MODE === 'demo') {
    const demoState = ensureDemoState(false);
    const demoAccount = demoState.accounts.find(
      row => row.login_id.toLowerCase() === account.toLowerCase(),
    );
    const expectedPassword = demoAccount?.demo_password || 'demo';
    if (!demoAccount || password !== expectedPassword) {
      throw new Error('Invalid account or password.');
    }

    // Demo mode is local, so preserving immediate wrong-role feedback has no
    // network cost. Real Supabase role authorization happens once on arrival.
    if (expectedRole && demoAccount.role !== expectedRole) {
      throw new Error('This account does not have access to that login option.');
    }

    sessionStorage.setItem(
      'nightMemoDemoSession',
      JSON.stringify({ login_id: demoAccount.login_id }),
    );
    return demoAccount;
  }

  // The separate Nurse Memo credential is verified by a privileged Edge
  // Function; the user's existing Supabase Auth password is never changed.
  const { data, error } = await supabase.functions.invoke('user-login', {
    body: {login_id: account,password},
  });
  if (error || data?.error || !data?.access_token || !data?.refresh_token) {
    let message = data?.error || 'Unable to sign in.';
    try { const body = await error?.context?.json?.(); if (body?.error) message = body.error; }
    catch { /* Transport errors have no response JSON. */ }
    throw new Error(message);
  }
  const {data: sessionData,error:sessionError} = await supabase.auth.setSession({
    access_token:data.access_token,refresh_token:data.refresh_token,
  });
  if (sessionError || !sessionData?.session || !sessionData?.user)
    throw new Error('Login succeeded but no session was returned.');

  // Do not query user_access here. The destination page performs the single
  // authoritative access/role lookup through requireRole().
  return sessionData.user;
}

export async function signOut() {
  await clearSession();
  returnToLogin();
}

export async function requireRole(roles) {
  roles = Array.isArray(roles) ? roles : [roles];
  let access = null;

  if (DB_MODE === 'supabase') {
    const { data, error } = await supabase.auth.getSession();
    const session = data?.session || null;
    if (error || !session) {
      returnToLogin();
      return null;
    }

    // getSession() reads the locally persisted authenticated session. Passing
    // the known user ID avoids an additional user-identity request before the
    // database access lookup.
    access = await getCurrentAccess(session.user.id);
  } else {
    access = await getCurrentAccess();
  }

  if (!access || !access.active || !roles.includes(access.role)) {
    // Never leave a valid Supabase session behind for a disabled account or a
    // user who entered through the wrong role workspace.
    await clearSession();
    returnToLogin();
    return null;
  }

  return access;
}
