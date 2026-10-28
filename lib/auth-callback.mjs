// Supports the documented fragment templates, standard query templates and PKCE.
export function parseAuthCallback(href) {
  const url = new URL(href),
    query = url.searchParams,
    hash = new URLSearchParams(url.hash.slice(1));
  if (
    query.has("error") ||
    hash.has("error") ||
    query.has("error_code") ||
    hash.has("error_code")
  )
    throw new Error("invalid-link");
  for (const key of ["token_hash", "type", "code"]) {
    if (query.getAll(key).length + hash.getAll(key).length > 1)
      throw new Error("invalid-link");
  }
  const tokenHash = hash.get("token_hash") || query.get("token_hash");
  const type = hash.get("type") || query.get("type");
  const code = query.get("code");
  if (tokenHash && !code && ["email", "signup", "recovery"].includes(type))
    return { tokenHash, type, code: null };
  if (code && !tokenHash && !hash.has("code"))
    return { code, tokenHash: null, type: null };
  throw new Error("invalid-link");
}
