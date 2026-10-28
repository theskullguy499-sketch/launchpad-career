import { validatePublicAuth } from "./lib/public-auth.mjs";
// Public configuration only. Supabase owns password hashing, tokens and verification.
let clientPromise;
export function getAuthClient() {
  if (!clientPromise)
    clientPromise = (async () => {
      const { supabaseUrl, publishableKey } =
        window.LAUNCHPAD_AUTH_CONFIG || {};
      try {
        if (
          validatePublicAuth(window.LAUNCHPAD_AUTH_CONFIG) !== "configured" ||
          !["http:", "https:"].includes(location.protocol)
        )
          throw new Error("not-configured");
      } catch {
        throw new Error("not-configured");
      }
      const { createClient } = await import("./vendor/supabase.js");
      return createClient(supabaseUrl, publishableKey, {
        auth: {
          flowType: "pkce",
          detectSessionInUrl: false,
          persistSession: true,
          autoRefreshToken: true,
          storageKey: "launchpad-auth-v1",
        },
      });
    })();
  return clientPromise;
}
export const recoveryKey = "launchpad-password-recovery-v1";
export function callbackUrl() {
  return new URL("auth/callback.html", new URL(".", location.href)).href;
}
export async function confirmedUser(client) {
  // Validate with the Auth server; localStorage claims alone are not authorization.
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at)
    throw new Error("Please verify your email and sign in again.");
  return data.user;
}
export function friendlyError(error, fallback) {
  if (
    error?.status === 429 ||
    ["over_email_send_rate_limit", "over_request_rate_limit"].includes(
      error?.code,
    )
  )
    return "Too many attempts. Please wait a few minutes and try again.";
  if (error?.code === "invalid_credentials")
    return "Sign-in failed. Check your email and password, and make sure your email is verified.";
  if (error?.name === "AuthRetryableFetchError" || error instanceof TypeError)
    return "Unable to reach the account service. Check your connection and try again.";
  if (error?.code === "otp_expired")
    return "This email link has expired or was already used. Request a new link.";
  if (error?.code === "email_not_confirmed")
    return "Please verify your email before signing in. You can resend the verification email.";
  if (["weak_password", "same_password"].includes(error?.code))
    return "Choose a new password with at least 12 characters that meets the account password policy.";
  return fallback;
}
