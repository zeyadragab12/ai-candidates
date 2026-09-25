"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { sendAdminRequest } from "@/components/admin/admin-request";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/auth/roleDefinitions";
import { formatRelativeTime } from "@/lib/dates/formatRelativeTime";

// Radix Select can't use "" as an item value.
const NO_TEAM = "__none__";

type TeamOption = { id: string; name: string };

function RoleSelect({
  value,
  onChange,
  label,
}: {
  value: Role;
  onChange: (role: Role) => void;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as Role)}>
      <SelectTrigger className="h-9 w-36 bg-white" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {ROLE_LABELS[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TeamSelect({
  value,
  onChange,
  teams,
  label,
}: {
  value: string | null;
  onChange: (teamId: string | null) => void;
  teams: TeamOption[];
  label: string;
}) {
  return (
    <Select
      value={value ?? NO_TEAM}
      onValueChange={(next) => onChange(next === NO_TEAM ? null : next)}
    >
      <SelectTrigger className="h-9 w-44 bg-white" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TEAM}>No team</SelectItem>
        {teams.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            {team.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AccessRequestRow({
  request,
  teams,
  onDone,
}: {
  request: { id: string; email: string; name: string; requestedAt: string };
  teams: TeamOption[];
  onDone: () => void;
}) {
  const [role, setRole] = useState<Role>("hr_user");
  const [teamId, setTeamId] = useState<string | null>(teams[0]?.id ?? null);
  const [isSaving, setIsSaving] = useState(false);

  async function approve() {
    setIsSaving(true);
    const ok = await sendAdminRequest("/api/admin/invites", "POST", {
      email: request.email,
      role,
      teamId,
    });
    setIsSaving(false);
    if (ok) {
      toast.success(`${request.name} can now sign in as ${ROLE_LABELS[role]}.`);
      onDone();
    }
  }

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{request.email}</p>
        <p className="text-xs text-slate-500">
          Tried to sign in {formatRelativeTime(request.requestedAt)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RoleSelect value={role} onChange={setRole} label={`Role for ${request.email}`} />
        <TeamSelect
          value={teamId}
          onChange={setTeamId}
          teams={teams}
          label={`Team for ${request.email}`}
        />
        <Button size="sm" className="h-9" disabled={isSaving} onClick={approve}>
          Approve
        </Button>
      </div>
    </li>
  );
}

export function AccessManagement({
  teams,
  accessRequests,
  pendingInvites,
}: {
  teams: TeamOption[];
  accessRequests: { id: string; email: string; name: string; requestedAt: string }[];
  pendingInvites: { email: string; role: Role; teamName: string | null; invitedAt: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("hr_user");
  const [teamId, setTeamId] = useState<string | null>(teams[0]?.id ?? null);
  const [isInviting, setIsInviting] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  const refresh = () => startTransition(() => router.refresh());

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setIsInviting(true);
    const ok = await sendAdminRequest("/api/admin/invites", "POST", { email: trimmed, role, teamId });
    setIsInviting(false);
    if (ok) {
      toast.success(`${trimmed} can sign in as ${ROLE_LABELS[role]}.`);
      setEmail("");
      refresh();
    }
  }

  async function withdraw(inviteEmail: string) {
    setWithdrawing(inviteEmail);
    const ok = await sendAdminRequest(
      `/api/admin/invites?email=${encodeURIComponent(inviteEmail)}`,
      "DELETE",
      undefined,
    );
    setWithdrawing(null);
    if (ok) {
      toast.success(`Invite for ${inviteEmail} withdrawn.`);
      refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleInvite}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3"
        aria-label="Invite a user"
      >
        <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
          <label htmlFor="invite-email" className="text-xs font-medium text-slate-500">
            Email
          </label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            className="h-9 bg-white"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Role</span>
          <RoleSelect value={role} onChange={setRole} label="Role for invited user" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Team</span>
          <TeamSelect value={teamId} onChange={setTeamId} teams={teams} label="Team for invited user" />
        </div>
        <Button type="submit" className="h-9" disabled={isInviting || !email.trim()}>
          <UserPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Invite
        </Button>
      </form>

      <section aria-labelledby="access-requests-heading">
        <h3 id="access-requests-heading" className="text-sm font-semibold text-slate-900">
          Access requests{" "}
          <span className="font-normal text-slate-500">({accessRequests.length})</span>
        </h3>
        <p className="text-xs text-slate-500">
          People who signed in without an invite. They can&apos;t use the app until approved.
        </p>
        {accessRequests.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">No pending requests.</p>
        ) : (
          <ul className="divide-y divide-slate-100" data-testid="access-requests">
            {accessRequests.map((request) => (
              <AccessRequestRow key={request.id} request={request} teams={teams} onDone={refresh} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pending-invites-heading">
        <h3 id="pending-invites-heading" className="text-sm font-semibold text-slate-900">
          Pending invites{" "}
          <span className="font-normal text-slate-500">({pendingInvites.length})</span>
        </h3>
        <p className="text-xs text-slate-500">
          Invited people who haven&apos;t signed in yet. Their role and team apply on first sign-in.
        </p>
        {pendingInvites.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">No pending invites.</p>
        ) : (
          <ul className="divide-y divide-slate-100" data-testid="pending-invites">
            {pendingInvites.map((invite) => (
              <li key={invite.email} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{invite.email}</p>
                  <p className="text-xs text-slate-500">
                    {ROLE_LABELS[invite.role]}
                    {invite.teamName && ` · ${invite.teamName}`} · invited{" "}
                    {formatRelativeTime(invite.invitedAt)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-normal"
                  disabled={withdrawing === invite.email}
                  onClick={() => withdraw(invite.email)}
                >
                  Withdraw
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
