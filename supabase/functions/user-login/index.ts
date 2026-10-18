import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { normalizeLoginId } from '../_shared/login-identity.mjs';
import { issueAppLoginSession } from '../_shared/app-login-flow.mjs';

// Public authentication entrypoint. Only service-role credentials are used on
// the server. Never send an admin client, secret or OTP to the browser.
const cors = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Cache-Control':'no-store',
};
function json(body: Record<string,unknown>, status=200) {
  return Response.json(body,{status,headers:cors});
}
function invalid() { return json({error:'Invalid account or password.'},401); }
export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
    if (request.method !== 'POST') return json({error:'Method not allowed.'},405);
    let login_id: string; let password: string;
    try {
      const payload = await request.json();
      if (!payload || typeof payload.password !== 'string' || payload.password.length > 128)
        return invalid();
      login_id = normalizeLoginId(payload.login_id);
      password = payload.password;
      if (!password) return invalid();
    } catch { return invalid(); }
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({error:'Login service is not configured.'},503);
    const admin = createClient(url,key,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    });
    try {
      const session = await issueAppLoginSession(admin,login_id,password);
      return session ? json(session) : invalid();
    } catch (error) {
      // Never log passwords, OTPs, access tokens, or the user directory.
      console.error('Application login failed:',error instanceof Error ? error.name : 'unknown');
      return json({error:error instanceof Error ? error.message : 'Login service unavailable.'},503);
    }
  },
};
