import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api/requireUser";
import { withErrorHandling } from "@/lib/errors";
import { jobUpdateSchema } from "@/types/job";

interface RouteParams {
  params: Promise<{ id: string }>;
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
