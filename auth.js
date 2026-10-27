// Authentication is deliberately separate from local opportunity/roadmap storage.
const $ = selector => document.querySelector(selector);
const config = window.LAUNCHPAD_AUTH_CONFIG || {};
let client;
let mode = 'signin';
let session = null;
let busy = false;
const message = text => { $('#authStatus').textContent = text; };
const callbackError = new URLSearchParams(location.hash.slice(1)).get('error_description');
const callbackCode = new URLSearchParams(location.search).has('code');
const redirectTo = new URL(location.pathname, location.origin).href;
function render() {
  const connected = Boolean(client);
  const signedIn = Boolean(session?.user?.email_confirmed_at);
  $('#accountBtn').textContent = signedIn ? 'Account ✓' : 'Account';
  $('#authModes').hidden = !connected || signedIn;
  $('#authFields').hidden = !connected || signedIn;
  $('#authSubmit').hidden = !connected || signedIn;
  $('#signOutBtn').hidden = !signedIn;
  $('#resendEmailBtn').hidden = !connected || signedIn || mode !== 'signup';
  $('#passwordHint').hidden = mode !== 'signup';
  $('#authPassword').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  $('#authPassword').minLength = mode === 'signup' ? 12 : 1;
  $('#authSubmit').textContent = mode === 'signup' ? 'Create account' : 'Sign in';
  $('#signInMode').setAttribute('aria-pressed', String(mode === 'signin'));
  $('#signUpMode').setAttribute('aria-pressed', String(mode === 'signup'));
}
async function action(operation) {
  if (busy) return;
  busy = true;
  $('#authForm').querySelectorAll('button:not(#closeAuthBtn)').forEach(b => b.disabled = true);
  try { await operation(); }
  catch { message('Unable to reach authentication. Check your connection and try again.'); }
  finally {
    $('#authPassword').value = '';
    busy = false;
    $('#authForm').querySelectorAll('button').forEach(b => b.disabled = false);
    render();
  }
}
$('#accountBtn').addEventListener('click', () => $('#authDialog').showModal());
$('#closeAuthBtn').addEventListener('click', () => $('#authDialog').close());
$('#authDialog').addEventListener('close', () => { $('#authPassword').value = ''; });
for (const [id, value] of [['signInMode', 'signin'], ['signUpMode', 'signup']]) {
  $(`#${id}`).addEventListener('click', () => { mode = value; $('#authPassword').value = ''; message(''); render(); });
}
$('#authForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!client || !$('#authForm').reportValidity()) return;
  action(async () => {
    const email = $('#authEmail').value.trim();
    const password = $('#authPassword').value;
    message(mode === 'signup' ? 'Creating account…' : 'Signing in…');
    const result = mode === 'signup'
      ? await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
      : await client.auth.signInWithPassword({ email, password });
    $('#authPassword').value = '';
    if (result.error) {
      // Avoid exposing whether an address is registered or echoing server details.
      message(mode === 'signup' ? 'Account creation failed. Check password requirements or try again later.' : 'Sign-in failed. Check your credentials and verify your email.');
      return;
    }
    if (mode === 'signup') {
      if (result.data.session) {
        await client.auth.signOut({ scope: 'local' });
        session = null;
        message('Email verification must be enabled by the site administrator before account registration can be used securely.');
      } else message('If registration is available for this address, a verification email will arrive shortly. Verify your email, then sign in.');
    } else {
      session = result.data.session;
      if (!session?.user?.email_confirmed_at) {
        await client.auth.signOut({ scope: 'local' });session = null;
        message('Verify your email before signing in.');
      } else message(`Signed in as ${session.user.email}. Your opportunity data remains local.`);
    }
  });
});
$('#resendEmailBtn').addEventListener('click', () => {
  if (!client || !$('#authEmail').reportValidity()) return;
  action(async () => {
    const { error } = await client.auth.resend({ type: 'signup', email: $('#authEmail').value.trim(), options: { emailRedirectTo: redirectTo } });
    message(error ? 'Unable to send verification email. Wait before trying again.' : 'If verification is pending, an email will arrive shortly. Check your spam folder too.');
  });
});
$('#signOutBtn').addEventListener('click', () => action(async () => {
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) { message('Sign-out failed. Please try again.');return; }
  session = null;$('#authPassword').value = '';message('Signed out. Your local data is unchanged.');
}));
function validConfig() {
  try {
    const url = new URL(config.supabaseUrl);
    return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash
      && typeof config.publishableKey === 'string' && /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey);
  } catch { return false; }
}
render();
if (!validConfig() || !['http:', 'https:'].includes(location.protocol)) {
  message('Account sign-in is not configured yet. You can continue using all local features.');
} else {
  message('Connecting to account service…');
  try {
    const { createClient } = await import('./vendor/supabase.js');
    client = createClient(config.supabaseUrl, config.publishableKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, storageKey: 'launchpad-auth-v1' }
    });
    client.auth.onAuthStateChange((_event, nextSession) => {
      session = nextSession;
      render();
      if (session?.user?.email_confirmed_at) message(`Signed in as ${session.user.email}. Your opportunity data remains local.`);
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    session = data.session;
    message(callbackError ? 'Email verification failed or expired. Request a new verification email.' : 'Sign in or create an account with email verification.');
    if (session?.user?.email_confirmed_at) message(`Signed in as ${session.user.email}. Your opportunity data remains local.`);
    if (callbackError || callbackCode || session) $('#authDialog').showModal();
    render();
  } catch {
    client = null;session = null;render();
    message('Authentication could not start. Local features remain available. Contact the site administrator.');
  }
}
