import { getAuthClient, callbackUrl, confirmedUser, friendlyError, recoveryKey } from './auth-client.js';
import { createCloudData } from './cloud-data.js';
const $ = selector => document.querySelector(selector);
let client, cloud;
let mode = 'signin';
let user = null;
let busy = false;
let generation = 0;
const message = text => { $('#authStatus').textContent = text; };
function recoveryPending() { try { return sessionStorage.getItem(recoveryKey) === 'pending'; } catch { return false; } }
function clearRecovery() { try { sessionStorage.removeItem(recoveryKey); } catch {} }
function showDialog() { if (!$('#authDialog').open) $('#authDialog').showModal(); }
function render() {
  const connected = Boolean(client);
  const resetting = mode === 'reset' && Boolean(user) && recoveryPending();
  const signedIn = Boolean(user) && !resetting;
  $('#accountBtn').textContent = user ? 'Account ✓' : 'Account';
  $('#authModes').hidden = !connected || signedIn || resetting;
  $('#authFields').hidden = !connected || signedIn;
  $('#authEmailLabel').hidden = resetting;
  $('#authEmail').disabled = resetting || signedIn || !connected;
  $('#authPasswordLabel').hidden = mode === 'forgot';
  $('#authPassword').disabled = mode === 'forgot' || signedIn || !connected;
  $('#confirmPasswordLabel').hidden = !['signup', 'reset'].includes(mode);
  $('#authConfirmPassword').disabled = !['signup', 'reset'].includes(mode) || !connected;
  $('#authSubmit').hidden = !connected || signedIn;
  $('#signOutBtn').hidden = !user;
  $('#cloudActions').hidden = !signedIn;
  $('#resendEmailBtn').hidden = !connected || Boolean(user) || mode === 'forgot';
  $('#forgotPasswordBtn').hidden = !connected || Boolean(user) || mode === 'forgot';
  $('#passwordHint').hidden = !['signup', 'reset'].includes(mode);
  $('#authPassword').autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
  $('#authPassword').minLength = mode === 'signin' ? 1 : 12;
  $('#authSubmit').textContent = { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset email', reset: 'Save new password' }[mode];
  $('#authTitle').textContent = mode === 'reset' ? 'Reset your password' : mode === 'forgot' ? 'Forgot password' : 'Your account';
  $('#signInMode').setAttribute('aria-pressed', String(mode === 'signin'));
  $('#signUpMode').setAttribute('aria-pressed', String(mode === 'signup'));
}
function clearPasswords() { $('#authPassword').value = ''; $('#authConfirmPassword').value = ''; }
async function action(operation) {
  if (busy) return;
  busy = true;
  $('#authForm').querySelectorAll('button:not(#closeAuthBtn)').forEach(b => b.disabled = true);
  try { await operation(); }
  catch { message('Unable to complete the request. Check your connection and try again. Your local data is unchanged.'); }
  finally {
    clearPasswords();busy = false;
    $('#authForm').querySelectorAll('button').forEach(b => b.disabled = false);
    render();
  }
}
function setMode(next) { mode = next; clearPasswords(); message('');render(); }
$('#accountBtn').addEventListener('click', showDialog);
$('#closeAuthBtn').addEventListener('click', () => $('#authDialog').close());
$('#authDialog').addEventListener('close', clearPasswords);
$('#signInMode').addEventListener('click', () => setMode('signin'));
$('#signUpMode').addEventListener('click', () => setMode('signup'));
$('#forgotPasswordBtn').addEventListener('click', () => { setMode('forgot');message('Enter your email address and we will send a secure password reset link.'); });
$('#authForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!client || busy) return;
  const email = $('#authEmail').value.trim();
  const password = $('#authPassword').value;
  if (mode !== 'reset' && (!email || !$('#authEmail').validity.valid)) { message('Please enter a valid email address.');$('#authEmail').focus();return; }
  if (mode !== 'forgot' && password.length < (mode === 'signin' ? 1 : 12)) { message(mode === 'signin' ? 'Please enter your password.' : 'Please use a password with at least 12 characters.');$('#authPassword').focus();return; }
  if (['signup','reset'].includes(mode) && password !== $('#authConfirmPassword').value) { message('Your passwords do not match. Please check both fields.');$('#authConfirmPassword').focus();return; }
  action(async () => {
    if (mode === 'forgot') {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl() });
      message(error ? friendlyError(error, 'Unable to send a reset email. Please try again later.') : 'If an account exists for this email, a password reset link will arrive shortly. Check your spam folder too.');return;
    }
    if (mode === 'reset') {
      if (!recoveryPending()) { message('Request a new password reset link before changing your password.');return; }
      await confirmedUser(client);
      const { error } = await client.auth.updateUser({ password });
      if (error) { message(friendlyError(error, 'Unable to reset your password. Request a new reset link and try again.'));return; }
      clearRecovery();mode = 'signin';
      const result = await client.auth.signOut({ scope: 'local' });
      if (!result.error) { user = null;generation++; }
      message(result.error ? 'Your password was updated. Please sign out, then sign in with your new password.' : 'Your password was updated. Please sign in with your new password. Your local data is unchanged.');return;
    }
    const operation = mode;
    message(operation === 'signup' ? 'Creating account…' : 'Signing in…');
    const { data, error } = operation === 'signup'
      ? await client.auth.signUp({ email, password, options: { emailRedirectTo: callbackUrl() } })
      : await client.auth.signInWithPassword({ email, password });
    if (error) { message(friendlyError(error, operation === 'signup' ? 'Unable to create an account. Check the password policy or try again later.' : 'Sign-in failed. Check your email and password, and make sure your email is verified.'));return; }
    if (operation === 'signup') {
      if (data.session) {
        await client.auth.signOut({ scope: 'local' });user = null;generation++;
        message('Email verification must be enabled by the site administrator before account registration can be used securely.');
      } else message('If registration is available for this address, a verification email will arrive shortly. Open the link to confirm your email, then sign in.');
    } else {
      try {
        user = await confirmedUser(client);
        message(`Signed in as ${user.email}. Your local data is unchanged.`);
      } catch {
        await client.auth.signOut({ scope: 'local' });user = null;generation++;
        message('Verify your email before signing in. You can resend the verification email.');
      }
    }
  });
});
$('#resendEmailBtn').addEventListener('click', () => {
  const email = $('#authEmail').value.trim();
  if (!client || !email || !$('#authEmail').validity.valid) { message('Please enter a valid email address first.');return; }
  action(async () => {
    const { error } = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: callbackUrl() } });
    message(error ? friendlyError(error, 'Unable to send verification email. Please wait before trying again.') : 'If verification is pending, an email will arrive shortly. Check your spam folder too.');
  });
});
$('#signOutBtn').addEventListener('click', () => action(async () => {
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) { message('Sign-out failed. Please try again.');return; }
  user = null;generation++;clearRecovery();mode = 'signin';message('Signed out. Your local data is unchanged.');
}));
$('#saveCloudBtn').addEventListener('click', () => action(async () => {
  const backup = window.launchpadData?.snapshot();
  if (!backup || !window.confirm('Save a copy of local opportunities and roadmap progress to this account? Existing cloud records and local data will be kept.')) return;
  await cloud.saveGuestBackup(backup);
  message('A copy was saved to your account. Existing cloud records and local data are unchanged.');
}));
$('#downloadCloudBtn').addEventListener('click', () => action(async () => {
  const backup = await cloud.downloadBackup();
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
  const link = document.createElement('a');link.href = url;link.download = 'launchpad-account-backup.json';link.click();setTimeout(() => URL.revokeObjectURL(url),3000);
  message('Account backup downloaded. Local records were not changed. Use Restore only if you want to replace them.');
}));
render();
try {
  client = await getAuthClient();cloud = createCloudData(client);
  client.auth.onAuthStateChange((event, nextSession) => {
    generation++;
    if (event === 'SIGNED_OUT' || !nextSession) { user = null;clearRecovery();if(mode === 'reset') mode = 'signin';render(); }
    if (event === 'PASSWORD_RECOVERY') {
      try { sessionStorage.setItem(recoveryKey, 'pending'); } catch {}
      mode = 'reset';
    }
    // Do not call async Auth methods inside the SDK callback (it can hold a session lock).
    if (!busy && nextSession) setTimeout(() => validateSession(),0);
  });
  await validateSession();
  const result = new URLSearchParams(location.search).get('auth');
  if (result) { const clean = new URL(location.href);clean.searchParams.delete('auth');history.replaceState(null,'',clean); }
  if (result === 'verified' && user) message('Your email is verified. You are signed in. Your local data is unchanged.');
  if (recoveryPending() && user) { mode = 'reset';message('Choose a new password with at least 12 characters.');showDialog(); }
  else if (result) showDialog();
  render();
} catch (error) {
  client = null;user = null;render();
  message(error.message === 'not-configured' ? 'Account sign-in is not configured yet. You can continue using all local features.' : 'Authentication could not start. Local features remain available. Contact the site administrator.');
}
async function validateSession() {
  const ticket = generation;
  const { data, error } = await client.auth.getSession();
  if (error) { if(ticket === generation) message('Your session could not be restored. Please sign in again.');return; }
  if (!data.session) { if(ticket === generation && !busy) {user = null;message('Sign in or create an account with email verification.');render();}return; }
  try {
    const verified = await confirmedUser(client);
    if (ticket !== generation) return;
    user = verified;
    if (recoveryPending()) { mode = 'reset';showDialog(); }
    if (!busy) message(mode === 'reset' ? 'Choose a new password with at least 12 characters.' : `Signed in as ${user.email}. Your local data is unchanged.`);
    render();
  } catch {
    if (ticket === generation) {user = null;message('Please verify your email and sign in again.');render();}
  }
}
