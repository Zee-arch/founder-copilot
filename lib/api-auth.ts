import { verifyApiKey, type VerifiedApiKey } from "@/lib/api-keys";

// Shared bearer-token check for the Team-tier /api/v1/* routes — these
// authenticate via an API key instead of a Supabase session cookie, since
// they're meant to be called from a founder's own scripts/CI, not a
// browser.
export async function requireApiKey(request: Request): Promise<{ key: VerifiedApiKey } | { error: Response }> {
  const authHeader = request.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return {
      error: Response.json(
        { error: "Missing API key. Pass it as `Authorization: Bearer <key>`." },
        { status: 401 },
      ),
    };
  }

  const key = await verifyApiKey(token);
  if (!key) {
    return { error: Response.json({ error: "Invalid or revoked API key." }, { status: 401 }) };
  }

  return { key };
}
