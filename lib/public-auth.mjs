// Public configuration shape only. Supabase still validates every key and session.
export function publicKeyKind(key, projectUrl) {
  if (typeof key !== "string" || key.length > 8192) return null;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return "publishable";
  // Legacy anon keys are public JWTs. Decode only to reject privileged/foreign keys;
  // this is not signature verification and never authorizes a user or a paid plan.
  try {
    const parts = key.split(".");
    if (parts.length !== 3 || !parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p)))
      return null;
    const decode = (value) =>
      JSON.parse(atob(value.replaceAll("-", "+").replaceAll("_", "/")));
    const header = decode(parts[0]),
      payload = decode(parts[1]);
    if (
      header.alg !== "HS256" ||
      header.typ !== "JWT" ||
      payload.role !== "anon" ||
      payload.iss !== "supabase" ||
      typeof payload.ref !== "string" ||
      !payload.ref
    )
      return null;
    const hostname = new URL(projectUrl).hostname;
    if (
      hostname.endsWith(".supabase.co") &&
      payload.ref !== hostname.split(".")[0]
    )
      return null;
    return "anon";
  } catch {
    return null;
  }
}
export function validatePublicAuth(config) {
  if (
    !config ||
    Object.keys(config).sort().join(",") !== "publishableKey,supabaseUrl"
  )
    throw new Error(
      "Public Auth configuration must contain only supabaseUrl and publishableKey.",
    );
  const { supabaseUrl, publishableKey } = config;
  if (supabaseUrl === "" && publishableKey === "") return "guest";
  let url;
  try {
    url = new URL(supabaseUrl);
  } catch {
    throw new Error(
      "Set the public Supabase HTTPS URL and public key together, or leave both empty for guest mode.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !publicKeyKind(publishableKey, url)
  )
    throw new Error(
      "Use an HTTPS project root and a public sb_publishable_ or legacy anon key. Secret/service_role keys are forbidden.",
    );
  return "configured";
}
