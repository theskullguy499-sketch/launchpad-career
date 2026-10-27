// Public configuration only. Supabase owns password hashing, tokens and verification.
let clientPromise;
export function getAuthClient() {
  if (!clientPromise) clientPromise = (async () => {
    const { supabaseUrl, publishableKey } = window.LAUNCHPAD_AUTH_CONFIG || {};
    let url;
    try { url = new URL(supabaseUrl); } catch { throw new Error('not-configured'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash
      || typeof publishableKey !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)
      || !['http:', 'https:'].includes(location.protocol)) throw new Error('not-configured');
    const { createClient } = await import('./vendor/supabase.js');
    return createClient(supabaseUrl, publishableKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true, storageKey: 'launchpad-auth-v1' }
    });
  })();
  return clientPromise;
}
export const recoveryKey = 'launchpad-password-recovery-v1';
export function callbackUrl() {
  return new URL('auth/callback.html', new URL('.', location.href)).href;
}
export async function confirmedUser(client) {
  // Validate with the Auth server; localStorage claims alone are not authorization.
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at) throw new Error('Please verify your email and sign in again.');
  return data.user;
}
export function friendlyError(error, fallback) {
  if (error?.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error?.code)) return 'Too many attempts. Please wait a few minutes and try again.';
  if (error?.code === 'email_not_confirmed') return 'Please verify your email before signing in. You can resend the verification email.';
  if (['weak_password', 'same_password'].includes(error?.code)) return 'Choose a new password with at least 12 characters that meets the account password policy.';
  return fallback;
}
