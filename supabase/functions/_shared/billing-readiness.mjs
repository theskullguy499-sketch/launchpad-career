// Reports local configuration gates, never proves provider connectivity or a purchase.
export function billingReadiness(env, settings, environment, origins) {
  let site;
  try {
    site = new URL(env("PUBLIC_SITE_URL"));
  } catch {}
  const local =
    environment === "sandbox" &&
    ["localhost", "127.0.0.1"].includes(site?.hostname);
  const validSite =
    !!site &&
    !site.username &&
    !site.password &&
    !site.search &&
    !site.hash &&
    !site.hostname.endsWith("github.io") &&
    (site.protocol === "https:" || (local && site.protocol === "http:"));
  const exactOrigins = [...origins].every((value) => {
    try {
      const url = new URL(value);
      return url.origin === value && ["http:", "https:"].includes(url.protocol);
    } catch {
      return false;
    }
  });
  const checks = {
    "Staging is Sandbox-only":
      site?.hostname !== "launchpad-career-staging.pages.dev" ||
      environment === "sandbox",
    "Commercial database activation": settings.enabled === true,
    "Matching Paddle environment":
      ["sandbox", "live"].includes(environment) &&
      env("PADDLE_ENVIRONMENT") === environment &&
      settings.environment === environment,
    "Checkout operator approval": env("BILLING_CHECKOUT_ENABLED") === "true",
    "Legal operator approval": env("BILLING_LEGAL_APPROVED") === "true",
    "Paddle server API configuration": !!env("PADDLE_API_KEY"),
    "Environment-matched Paddle client token": (
      env("PADDLE_CLIENT_TOKEN") || ""
    ).startsWith(environment === "sandbox" ? "test_" : "live_"),
    "Distinct monthly price IDs":
      /^pri_[a-z0-9]+$/i.test(env("PADDLE_PRICE_PRO") || "") &&
      /^pri_[a-z0-9]+$/i.test(env("PADDLE_PRICE_PREMIUM") || "") &&
      env("PADDLE_PRICE_PRO") !== env("PADDLE_PRICE_PREMIUM"),
    "Webhook signing configuration":
      (env("PADDLE_WEBHOOK_SECRET") || "").length >= 32,
    "Configured checkout site": validSite,
    "Exact site CORS origin":
      validSite && exactOrigins && origins.has(site.origin),
    "Operator identity": !!env("BUSINESS_NAME")?.trim(),
    "Monitored support email": /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      env("PUBLIC_SUPPORT_EMAIL") || "",
    ),
    "Reviewed billing terms version": !!env("BILLING_TERMS_VERSION")?.trim(),
    "Reviewed monthly catalog": ["pro", "premium"].every(
      (plan) =>
        Number.isInteger(settings.plans?.[plan]?.monthlyCents) &&
        settings.plans[plan].monthlyCents > 0,
    ),
    "Live charge guard":
      environment === "sandbox" || env("ALLOW_LIVE_BILLING") === "true",
  };
  const missing = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([label]) => label);
  return { ready: missing.length === 0, missing };
}
