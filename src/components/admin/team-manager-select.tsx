"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { sendAdminRequest } from "@/components/admin/admin-request";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

const UNASSIGNED = "__none__";

export function TeamManagerSelect({
  teamId,
  teamName,
  managerId,
  managerOptions,
}: {
  teamId: string;
  teamName: string;
  managerId: string | null;
  managerOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function assign(value: string) {
    const nextManagerId = value === UNASSIGNED ? null : value;
    setIsSaving(true);
    const ok = await sendAdminRequest(`/api/teams/${teamId}`, "PATCH", {
      managerId: nextManagerId,
    });
    if (ok) {
      const name = managerOptions.find((option) => option.id === nextManagerId)?.name;
      toast.success(name ? `${name} now manages ${teamName}.` : `${teamName} has no manager.`);
      startTransition(() => router.refresh());
    }
    setIsSaving(false);
  }

  return (
    <Select value={managerId ?? UNASSIGNED} disabled={isSaving} onValueChange={assign}>
      <SelectTrigger className="h-8 w-44" aria-label={`Manager for ${teamName}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        {managerOptions.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
