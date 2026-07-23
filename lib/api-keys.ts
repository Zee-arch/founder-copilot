import { randomBytes, createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";

const KEY_PREFIX = "fc_live_";
// Shown back to the user forever (in the dashboard's key list) so they can
// tell keys apart without ever re-displaying the secret itself.
const VISIBLE_PREFIX_LENGTH = 12;

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Returns the raw key exactly once — callers must show it to the user
// immediately and never persist it themselves; only its hash is stored.
export async function createApiKey(orgId: string, createdBy: string, name: string) {
  const rawKey = `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  const keyPrefix = rawKey.slice(0, VISIBLE_PREFIX_LENGTH);

  const service = createServiceClient();
  const { data: keyRow, error } = await service
    .from("api_keys")
    .insert({ org_id: orgId, created_by: createdBy, name, key_prefix: keyPrefix })
    .select("id, name, key_prefix, created_at")
    .single();

  if (error || !keyRow) {
    throw new Error(`Failed to create API key: ${error?.message}`);
  }

  const { error: secretError } = await service
    .from("api_key_secrets")
    .insert({ key_id: keyRow.id, key_hash: hashKey(rawKey) });

  if (secretError) {
    await service.from("api_keys").delete().eq("id", keyRow.id);
    throw new Error(`Failed to store API key secret: ${secretError.message}`);
  }

  return { rawKey, keyRow };
}

export async function revokeApiKey(keyId: string, orgId: string) {
  const service = createServiceClient();
  const { error } = await service
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("org_id", orgId);

  if (error) throw new Error(`Failed to revoke API key: ${error.message}`);
}

export type VerifiedApiKey = {
  keyId: string;
  orgId: string;
  orgPlan: "team" | "enterprise";
  creditsBalance: number;
};

// Verifies a raw `Authorization: Bearer <key>` value against the stored
// hash — never compares/stores the raw key itself past this function call.
export async function verifyApiKey(rawKey: string): Promise<VerifiedApiKey | null> {
  if (!rawKey.startsWith(KEY_PREFIX)) return null;

  const service = createServiceClient();
  const { data: secret } = await service
    .from("api_key_secrets")
    .select("key_id")
    .eq("key_hash", hashKey(rawKey))
    .maybeSingle();

  if (!secret) return null;

  const { data: key } = await service
    .from("api_keys")
    .select("id, org_id, revoked_at")
    .eq("id", secret.key_id)
    .maybeSingle();

  if (!key || key.revoked_at) return null;

  const { data: org } = await service
    .from("organizations")
    .select("plan, credits_balance")
    .eq("id", key.org_id)
    .maybeSingle();

  if (!org) return null;

  // Best-effort — a failed timestamp update shouldn't block the actual request.
  await service.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);

  return { keyId: key.id, orgId: key.org_id, orgPlan: org.plan, creditsBalance: org.credits_balance };
}
