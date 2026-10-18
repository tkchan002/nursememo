/** Exchange a verified Nurse Memo password for the matching Supabase Auth
 * session. An admin client is supplied ONLY from the server-side Edge Function.
 * No service-role credentials, OTPs or Auth links are sent to callers.
 */
export async function issueAppLoginSession(admin, loginId, password) {
  const {data: userId, error: verifyError} = await admin.rpc('app_login_verify', {
    p_login_id:loginId,p_password:password,
  });
  if (verifyError) {
    const error = new Error('Login service unavailable.');
    error.code = 'verify';
    throw error;
  }
  if (!userId) return null;
  const {data: account, error: accountError} = await admin.auth.admin.getUserById(userId);
  if (accountError || !account?.user?.email || account.user.id !== userId) {
    const error = new Error('Unable to establish account session.');
    error.code = 'account';
    throw error;
  }
  const {data: link, error: linkError} = await admin.auth.admin.generateLink({
    type:'magiclink', email:account.user.email,
  });
  if (linkError || !link?.properties?.hashed_token || link?.user?.id !== userId) {
    const error = new Error('Unable to establish account session.');
    error.code = 'link';
    throw error;
  }
  const {data: verified, error: otpError} = await admin.auth.verifyOtp({
    type:'magiclink',token_hash:link.properties.hashed_token,
  });
  if (otpError || verified?.user?.id !== userId || !verified?.session?.access_token ||
      !verified.session.refresh_token) {
    const error = new Error('Unable to establish account session.');
    error.code = 'otp';
    throw error;
  }
  return {
    access_token:verified.session.access_token,
    refresh_token:verified.session.refresh_token,
  };
}
