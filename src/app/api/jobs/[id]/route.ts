import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api/requireUser";
import { forbidUnlessOwner } from "@/lib/auth/ownership";
import type { createClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/errors";
import { jobUpdateSchema } from "@/types/job";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function checkJobOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobId: string,
  userId: string,
): Promise<NextResponse | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select("user_id")
    .eq("id", jobId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to load job." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  return forbidUnlessOwner(data.user_id, userId, "job");
}

export const GET = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to load job." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  return NextResponse.json(data);
});

export const PUT = withErrorHandling(async (request: Request, { params }: RouteParams) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = jobUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid job data." },
      { status: 400 },
    );
  }

  const ownerCheck = await checkJobOwner(supabase, id, auth.user.id);
  if (ownerCheck) return ownerCheck;

  const { data, error } = await supabase
    .from("jobs")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update job." },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  return NextResponse.json(data);
});

export const DELETE = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  const ownerCheck = await checkJobOwner(supabase, id, auth.user.id);
  if (ownerCheck) return ownerCheck;

  const { data, error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete job." },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
});
