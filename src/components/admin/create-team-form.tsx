"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { sendAdminRequest } from "@/components/admin/admin-request";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

export function CreateTeamForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsSaving(true);
    const ok = await sendAdminRequest("/api/teams", "POST", { name: trimmed });
    if (ok) {
      toast.success(`Created team "${trimmed}".`);
      setName("");
      startTransition(() => router.refresh());
    }
    setIsSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="New team name"
        aria-label="New team name"
        className="h-8 w-44"
        maxLength={80}
      />
      <Button type="submit" size="sm" disabled={isSaving || !name.trim()}>
        <Plus className="mr-1.5 h-4 w-4" />
        Add Team
      </Button>
    </form>
  );
}
