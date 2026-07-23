"use client";

import { useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { inviteToOrg, removeMember, revokeInvite, updateMemberRole } from "@/app/actions/orgs";
import type { OrgInviteRow, OrgMemberRow, OrgRole } from "@/lib/org-types";

function roleLabel(role: OrgRole) {
  return role[0].toUpperCase() + role.slice(1);
}

function InviteForm({ orgId }: { orgId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    setLink("");
    setCopied(false);

    const result = await inviteToOrg(orgId, email, role);

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    setLink(`${window.location.origin}/invite/${result.token}`);
    setEmail("");
    setIsSubmitting(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="font-display text-base text-slate-text">Invite someone</p>
      <p className="mt-1 text-xs text-slate-500">
        Creates a shareable join link — copy it to whoever you&apos;re inviting. (Automatic email delivery isn&apos;t
        reliable yet on this project&apos;s free-tier email sender, so the link is the dependable path.)
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@example.com"
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as "admin" | "member")}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dim disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? "Inviting…" : "Create invite"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-signal-pivot">{error}</p>}

      {link && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 px-4 py-2.5">
          <code className="flex-1 truncate text-xs text-slate-700">{link}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dim"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}

function PendingInvites({ orgId, invites }: { orgId: string; invites: OrgInviteRow[] }) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (invites.length === 0) return null;

  async function handleRevoke(inviteId: string) {
    setRemovingId(inviteId);
    await revokeInvite(orgId, inviteId);
    setRemovingId(null);
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
      <p className="font-display text-base text-slate-text">Pending invites</p>
      <div className="mt-3 space-y-2">
        {invites.map((invite) => (
          <div key={invite.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
            <div>
              <span className="text-slate-700">{invite.email}</span>
              <span className="ml-2 text-xs text-slate-400">{roleLabel(invite.role)}</span>
            </div>
            <button
              type="button"
              onClick={() => handleRevoke(invite.id)}
              disabled={removingId === invite.id}
              className="text-slate-400 transition hover:text-signal-pivot disabled:opacity-50"
              aria-label={`Revoke invite for ${invite.email}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MemberList({
  orgId,
  myUserId,
  myRole,
  members,
}: {
  orgId: string;
  myUserId: string;
  myRole: OrgRole;
  members: OrgMemberRow[];
}) {
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const canManage = myRole === "owner" || myRole === "admin";

  async function handleRoleChange(userId: string, role: "admin" | "member") {
    setBusyUserId(userId);
    await updateMemberRole(orgId, userId, role);
    setBusyUserId(null);
  }

  async function handleRemove(userId: string) {
    setBusyUserId(userId);
    await removeMember(orgId, userId);
    setBusyUserId(null);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="font-display text-base text-slate-text">Members ({members.length})</p>
      <div className="mt-3 space-y-2">
        {members.map((member) => {
          const isSelf = member.user_id === myUserId;
          const isOwner = member.role === "owner";
          return (
            <div key={member.user_id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate text-slate-700">
                  {member.display_name || member.email}
                  {isSelf && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}
                </p>
                {member.display_name && <p className="truncate text-xs text-slate-400">{member.email}</p>}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {canManage && !isOwner && !isSelf ? (
                  <select
                    value={member.role}
                    onChange={(event) => handleRoleChange(member.user_id, event.target.value as "admin" | "member")}
                    disabled={busyUserId === member.user_id}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {roleLabel(member.role)}
                  </span>
                )}

                {canManage && !isOwner && !isSelf && (
                  <button
                    type="button"
                    onClick={() => handleRemove(member.user_id)}
                    disabled={busyUserId === member.user_id}
                    className="text-slate-400 transition hover:text-signal-pivot disabled:opacity-50"
                    aria-label={`Remove ${member.email}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OrgSettings({
  orgId,
  myUserId,
  myRole,
  members,
  invites,
}: {
  orgId: string;
  myUserId: string;
  myRole: OrgRole;
  members: OrgMemberRow[];
  invites: OrgInviteRow[];
}) {
  return (
    <div className="space-y-4">
      <InviteForm orgId={orgId} />
      <PendingInvites orgId={orgId} invites={invites} />
      <MemberList orgId={orgId} myUserId={myUserId} myRole={myRole} members={members} />
    </div>
  );
}
