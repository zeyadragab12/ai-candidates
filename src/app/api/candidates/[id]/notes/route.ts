import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireUser } from "@/lib/api/requireUser";
import { withErrorHandling } from "@/lib/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const requestSchema = z.object({
  note: z.string().trim().min(1, "Note cannot be empty."),
});

async function verifyCandidateOwnership(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  candidateId: string,
) {
  const { data, error } = await supabase
    .from("candidates")
    .select("id")
    .eq("id", candidateId)
    .maybeSingle();
  return { exists: !error && !!data, error };
}

export const GET = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  const { id: candidateId } = await params;

  const ownership = await verifyCandidateOwnership(supabase, candidateId);
  if (ownership.error) {
    return NextResponse.json({ error: "Failed to load candidate." }, { status: 500 });
  }
  if (!ownership.exists) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("candidate_notes")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load notes." }, { status: 500 });
  }

  return NextResponse.json({ notes: data ?? [] });
});

export const POST = withErrorHandling(async (request: Request, { params }: RouteParams) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;
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
      { error: parsed.error.issues[0]?.message ?? "Invalid note." },
      { status: 400 },
    );
  }

  const ownership = await verifyCandidateOwnership(supabase, candidateId);
  if (ownership.error) {
    return NextResponse.json({ error: "Failed to load candidate." }, { status: 500 });
  }
  if (!ownership.exists) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("candidate_notes")
    .insert({
      candidate_id: candidateId,
      user_id: user.id,
      note: parsed.data.note,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to save note." }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
});
