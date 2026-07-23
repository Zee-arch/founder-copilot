"use client";

import { useState, useTransition } from "react";
import { Key, Trash2, Copy, Check } from "lucide-react";
import { createTeamApiKeyAction, revokeTeamApiKeyAction } from "@/app/actions/billing";

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export function ApiKeysManager({ initialKeys, canManage }: { initialKeys: ApiKeyRow[]; canManage: boolean }) {
  const [keys, setKeys] = useState(initialKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createTeamApiKeyAction(newKeyName);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setRevealedKey(result.rawKey);
      setNewKeyName("");
      setKeys((prev) => [
        { id: result.id, name: newKeyName.trim() || "API key", key_prefix: result.keyPrefix, created_at: new Date().toISOString(), last_used_at: null, revoked_at: null },
        ...prev,
      ]);
    });
  }

  function handleRevoke(keyId: string) {
    setError(null);
    startTransition(async () => {
      const result = await revokeTeamApiKeyAction(keyId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, revoked_at: new Date().toISOString() } : k)));
    });
  }

  async function copyKey() {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Key className="h-4 w-4 text-brand" />
        <p className="font-display text-lg text-slate-text">API keys</p>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Use a key to call <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/api/v1/validate</code> and{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/api/v1/batch</code> programmatically.
      </p>

      {revealedKey && (
        <div className="mt-4 rounded-xl border border-signal-refine/40 bg-signal-refine/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Copy this now — it won&apos;t be shown again
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-white px-3 py-2 text-sm text-slate-700">{revealedKey}</code>
            <button
              type="button"
              onClick={copyKey}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-signal-pivot">{error}</p>}

      {canManage && (
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. CI pipeline)"
            className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dim disabled:opacity-60"
          >
            {isPending ? "Creating…" : "Create key"}
          </button>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {keys.length === 0 && <p className="text-sm text-slate-400">No API keys yet.</p>}
        {keys.map((key) => (
          <div
            key={key.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium text-slate-700">
                {key.name} <span className="text-slate-400">— {key.key_prefix}…</span>
              </p>
              <p className="text-xs text-slate-400">
                {key.revoked_at ? "Revoked" : key.last_used_at ? `Last used ${new Date(key.last_used_at).toLocaleDateString()}` : "Never used"}
              </p>
            </div>
            {canManage && !key.revoked_at && (
              <button
                type="button"
                onClick={() => handleRevoke(key.id)}
                disabled={isPending}
                className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:border-signal-pivot/40 hover:text-signal-pivot disabled:opacity-60"
              >
                <Trash2 className="h-3 w-3" />
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
