import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/requireUser";
import { withErrorHandling } from "@/lib/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const CANDIDATE_STATUSES = [
  "New",
  "Reviewed",
  "Shortlisted",
  "Rejected",
  "Contacted",
] as const;

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
    .select("id, status")
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

  const newStatus = parsed.data.status;

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

  return NextResponse.json(updated);
});
