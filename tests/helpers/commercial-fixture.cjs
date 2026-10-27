const { cloudFixture } = require("./cloud-fixture.cjs");
exports.configureCommercial = async function (page, plans) {
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "buyer@example.com",
    email_confirmed_at: "2026-01-01",
    last_sign_in_at: new Date().toISOString(),
    role: "authenticated",
    aud: "authenticated",
  };
  const cloud = cloudFixture();
  const calls = [];
  let plan = "free",
    legacy = false,
    ageBand = "18+";
  await page.addInitScript(() => {
    window.Paddle = {
      Environment: { set: (value) => (window.checkoutEnvironment = value) },
      Initialize: (options) => (window.mockPaddleEvent = options.eventCallback),
      Checkout: {
        open: (options) => (window.mockCheckout = options),
        close: () => {
          window.mockCheckout = null;
        },
      },
    };
  });
  await page.route("**/auth-config.js", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: "window.LAUNCHPAD_AUTH_CONFIG={supabaseUrl:'https://commercial-test.supabase.co',publishableKey:'sb_publishable_mock'}",
    }),
  );
  await page.route("https://commercial-test.supabase.co/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith("/token"))
      return r.fulfill({
        json: {
          access_token: "mock-token",
          refresh_token: "mock-refresh",
          token_type: "bearer",
          expires_in: 3600,
          user,
        },
      });
    if (path.endsWith("/user")) return r.fulfill({ json: user });
    if (path.endsWith("/functions/v1/billing")) {
      const body = r.request().postDataJSON();
      calls.push(body);
      if (body.action === "catalog")
        return r.fulfill({
          json: {
            enabled: true,
            checkoutReady: true,
            termsVersion: "mock-v1",
            environment: "sandbox",
            catalog: plans,
          },
        });
      if (body.action === "status")
        return r.fulfill({
          json: {
            checkoutReady: true,
            ageBand,
            entitlement: {
              enabled: true,
              environment: "sandbox",
              plan,
              legacy,
              limits: plans[plan],
              aiUsed: 0,
              aiRemaining: plans[plan].aiMonthly,
              catalog: plans,
            },
            subscriptions: [],
            usage: [],
            configured: true,
            isAdmin: false,
          },
        });
      if (["checkout", "resume_checkout"].includes(body.action))
        return r.fulfill({
          json: {
            transactionId: "txn_mocked",
            clientToken: "test_public_mock",
            environment: "sandbox",
            notice: "Awaiting the verified webhook.",
          },
        });
      if (body.action === "admin")
        return r.fulfill({
          status: 403,
          json: { error: "Administrator access required." },
        });
      return r.fulfill({ json: { saved: true } });
    }
    if (await cloud(r)) return;
    return r.fulfill({ json: {} });
  });
  return {
    calls,
    setPlan: (value) => (plan = value),
    setLegacy: (value) => (legacy = value),
    setAge: (value) => (ageBand = value),
  };
};
