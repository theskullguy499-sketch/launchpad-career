// Read-only public diagnostics. Never signs up, sends email, writes SQL or starts checkout.
import { pathToFileURL } from "node:url";
import { validatePublicAuth } from "../lib/public-auth.mjs";
const site = "https://launchpad-career-staging.pages.dev/";
const project = "https://oyatshlhqdxosvbelsvp.supabase.co";
export function parseDeployedAuth(source) {
  // Never evaluate JavaScript downloaded from a remote page.
  const match = source
    .trim()
    .match(/^window\.LAUNCHPAD_AUTH_CONFIG\s*=\s*(\{[\s\S]*\});?$/);
  if (!match) throw new Error("Use the generated configured build.");
  const config = JSON.parse(match[1]);
  if (
    validatePublicAuth(config) !== "configured" ||
    new URL(config.supabaseUrl).origin !== project
  )
    throw new Error("The expected public project configuration is missing.");
  return config;
}
async function boundedText(response) {
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 65536) {
      await reader.cancel();
      throw new Error("Unexpectedly large diagnostic response.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
export async function checkStaging(request = fetch) {
  const checks = [];
  const get = async (url, options = {}) => {
    const result = await request(url, {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
    if (!result.ok) throw new Error("Remote check unavailable.");
    return result;
  };
  for (const [path, label] of [
    ["", "Staging HTML"],
    ["auth/callback.html", "Static email callback"],
    ["vendor/supabase.js", "Tracked browser SDK"],
  ]) {
    try {
      const response = await get(site + path);
      const mime = response.headers.get("content-type") || "";
      if (
        path.endsWith(".js")
          ? !mime.includes("javascript")
          : !mime.includes("text/html")
      )
        throw new Error("Unexpected asset MIME type.");
      checks.push({ check: label, result: "PASS" });
    } catch {
      checks.push({ check: label, result: "NOT VERIFIED" });
    }
  }
  let config;
  try {
    config = parseDeployedAuth(
      await boundedText(await get(site + "auth-config.js")),
    );
    checks.push({
      check: "Frontend public project configuration",
      result: "PASS",
    });
  } catch {
    checks.push({
      check: "Frontend public project configuration",
      result: "NOT VERIFIED",
    });
    return checks;
  }
  const headers = {
    apikey: config.publishableKey,
    Authorization: "Bearer " + config.publishableKey,
  };
  try {
    const settings = JSON.parse(
      await boundedText(await get(project + "/auth/v1/settings", { headers })),
    );
    checks.push({
      check: "Email provider and mandatory confirmation policy",
      result:
        settings.external?.email === true &&
        settings.mailer_autoconfirm === false
          ? "PASS"
          : "FAIL",
    });
  } catch {
    checks.push({
      check: "Email provider and mandatory confirmation policy",
      result: "NOT VERIFIED",
    });
  }
  try {
    const catalog = JSON.parse(
      await boundedText(
        await get(project + "/functions/v1/billing", {
          method: "POST",
          headers: {
            ...headers,
            Origin: new URL(site).origin,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "catalog" }),
        }),
      ),
    );
    checks.push({
      check: "Billing uses Sandbox",
      result: catalog.environment === "sandbox" ? "PASS" : "FAIL",
    });
    checks.push({
      check: "Server-local checkout prerequisites",
      result: catalog.checkoutReady === true ? "PASS" : "FAIL",
    });
    if (Array.isArray(catalog.setupRequired))
      checks.push({
        check: "Outstanding local billing gates",
        result: catalog.setupRequired.length === 0 ? "PASS" : "FAIL",
        count: catalog.setupRequired.length,
      });
  } catch {
    checks.push({ check: "Read-only billing catalog", result: "NOT VERIFIED" });
  }
  return checks;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const checks = await checkStaging();
  for (const row of checks)
    console.log(
      `${row.result}: ${row.check}${row.count === undefined ? "" : ` (${row.count})`}`,
    );
  console.log(
    "This read-only check does not verify mailbox delivery, accounts/RLS, Paddle domain approval or a Sandbox purchase.",
  );
  if (checks.some((row) => row.result !== "PASS")) process.exitCode = 2;
}
