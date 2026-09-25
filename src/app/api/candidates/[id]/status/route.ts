import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/requireUser";
import { logActivity } from "@/lib/activity/log";
import { forbidUnlessOwner } from "@/lib/auth/ownership";
import { withErrorHandling } from "@/lib/errors";
import { CANDIDATE_STATUSES } from "@/lib/candidates/statuses";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const requestSchema = z.object({
  status: z.enum(CANDIDATE_STATUSES),
});

export const PUT = withErrorHandling(async (request: Request, { params }: RouteParams) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  const { id: candidateId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: `status must be one of: ${CANDIDATE_STATUSES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const existing = await supabase
    .from("candidates")
    .select("id, status, user_id")
    .eq("id", candidateId)
    .maybeSingle();

  if (existing.error) {
    return NextResponse.json(
      { error: "Failed to load candidate." },
      { status: 500 },
    );
  }
  if (!existing.data) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }
  const forbidden = forbidUnlessOwner(existing.data.user_id, auth.user.id, "candidate");
  if (forbidden) return forbidden;

  const newStatus = parsed.data.status;

  // Re-selecting the current status changes nothing, so it mustn't log a
  // "change" or notify the manager.
  if (newStatus === existing.data.status) {
    const { data: unchanged } = await supabase
      .from("candidates")
      .select()
      .eq("id", candidateId)
      .single();
    return NextResponse.json(unchanged);
  }

  // A DB trigger (candidates_record_status_change) atomically records this
  // change in candidate_status_history within the same UPDATE statement, so
  // the status can never change without a corresponding history row.
  const { data: updated, error: updateError } = await supabase
    .from("candidates")
    .update({ status: newStatus })
    .eq("id", candidateId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update candidate status." },
      { status: 500 },
    );
  }

  await logActivity(supabase, {
    userId: auth.user.id,
    action: "candidate.status_changed",
    entityType: "candidate",
    entityId: candidateId,
    description: `Changed ${updated.name ?? "a candidate"}'s status from ${existing.data.status} to ${newStatus}`,
    metadata: { oldStatus: existing.data.status, newStatus },
  });

  return NextResponse.json(updated);
});
