import { getAuthClient, recoveryKey } from '../auth-client.js';
const hash = new URLSearchParams(location.hash.slice(1));
const query = new URLSearchParams(location.search);
const tokenHash = hash.get('token_hash');
const type = hash.get('type');
const code = query.get('code');
const failed = hash.has('error') || query.has('error');
// Strip credentials before network requests. No analytics, third-party scripts or open redirects.
history.replaceState(null, '', location.pathname);
const status = document.querySelector('#callbackStatus');
try {
  if (failed || (!code && !tokenHash)) throw new Error('invalid-link');
  const client = await getAuthClient();
  let recovery = type === 'recovery';
  client.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') recovery = true; });
  let result;
  if (tokenHash && ['email', 'signup', 'recovery'].includes(type)) {
    result = await client.auth.verifyOtp({ token_hash: tokenHash, type });
  } else if (code && !tokenHash) {
    result = await client.auth.exchangeCodeForSession(code);
  } else throw new Error('invalid-link');
  if (result.error || !result.data.session) throw new Error('invalid-link');
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at) {
    await client.auth.signOut({ scope: 'local' });
    throw new Error('invalid-link');
  }
  // Only a successful recovery exchange enables reset UI; the server still authorizes updateUser.
  if (recovery) sessionStorage.setItem(recoveryKey, 'pending');
  else sessionStorage.removeItem(recoveryKey);
  location.replace(new URL(`../?auth=${recovery ? 'recovery' : 'verified'}`, location.href).href);
} catch {
  status.textContent = 'This link is invalid, expired, or already used. Return to Launchpad to request a new verification or password reset email. If you used the default PKCE email link, open it in the same browser where you requested it.';
}
