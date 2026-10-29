const { cloudFixture } = require("./cloud-fixture.cjs");
exports.configureCareerCloud = async (page) => {
  let user;
  const states = new Map();
  const commits = [];
  let hold = null;
  await page.route("**/auth-config.js", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: "window.LAUNCHPAD_AUTH_CONFIG={supabaseUrl:'https://career-test.supabase.co',publishableKey:'sb_publishable_mock'};",
    }),
  );
  await page.route("https://career-test.supabase.co/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    const requestUser = user;
    if (path.endsWith("/token")) {
      const email = r.request().postDataJSON().email;
      user = {
        id: email.startsWith("alice")
          ? "00000000-0000-4000-8000-000000000001"
          : "00000000-0000-4000-8000-000000000002",
        email,
        email_confirmed_at: "2026-01-01",
        last_sign_in_at: new Date().toISOString(),
        role: "authenticated",
        aud: "authenticated",
      };
      return r.fulfill({
        json: {
          access_token: "mock-access",
          refresh_token: "mock-refresh",
          token_type: "bearer",
          expires_in: 3600,
          user,
        },
      });
    }
    if (path.endsWith("/user")) return r.fulfill({ json: user });
    if (path.endsWith("/functions/v1/billing"))
      return r.fulfill({
        status: 503,
        json: { error: "Provider not configured in this client-state fixture" },
      });
    if (path.endsWith("/commit_workspace")) {
      commits.push(r.request().postDataJSON());
      if (hold) await hold;
    }
    if (requestUser) {
      if (!states.has(requestUser.id))
        states.set(requestUser.id, cloudFixture());
      if (await states.get(requestUser.id)(r)) return;
    }
    return r.fulfill({ json: {} });
  });
  return { commits, hold: (promise) => (hold = promise) };
};
