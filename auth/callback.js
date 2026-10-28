import { getAuthClient, recoveryKey } from "../auth-client.js";
import { parseAuthCallback } from "../lib/auth-callback.mjs";
const callbackLocation = location.href;
// Remove all link credentials before client initialization or verification requests.
history.replaceState(null, "", location.pathname);
const status = document.querySelector("#callbackStatus");
let subscription;
try {
  const { tokenHash, type, code } = parseAuthCallback(callbackLocation);
  const client = await getAuthClient();
  let recovery = type === "recovery";
  subscription = client.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") recovery = true;
  }).data.subscription;
  const result = tokenHash
    ? await client.auth.verifyOtp({ token_hash: tokenHash, type })
    : await client.auth.exchangeCodeForSession(code);
  if (result.error || !result.data.session) throw new Error("invalid-link");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at) {
    await client.auth.signOut({ scope: "local" });
    throw new Error("invalid-link");
  }
  try {
    if (recovery) sessionStorage.setItem(recoveryKey, "pending");
    else sessionStorage.removeItem(recoveryKey);
  } catch {
    await client.auth.signOut({ scope: "local" });
    throw new Error("storage-unavailable");
  }
  location.replace(
    new URL(`../?auth=${recovery ? "recovery" : "verified"}`, location.href)
      .href,
  );
} catch (error) {
  status.textContent =
    error.message === "not-configured"
      ? "Account verification is not configured on this site yet. Contact the operator; do not share your email link."
      : error.message === "storage-unavailable"
        ? "Your browser could not safely continue the password flow. Allow site storage, then request a new link. No password was changed."
        : "This link is invalid, expired, or already used, or the account service could not be reached. Return to Launchpad to request a new verification or password reset email. If you used the default PKCE email link, open it in the same browser where you requested it.";
} finally {
  subscription?.unsubscribe();
}
