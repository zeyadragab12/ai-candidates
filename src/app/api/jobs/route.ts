import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api/requireUser";
import { withErrorHandling } from "@/lib/errors";
import { jobCreateSchema } from "@/types/job";

export const GET = withErrorHandling(async (request: Request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from("jobs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load jobs." },
      { status: 500 },
    );
  }

  return NextResponse.json({ jobs: data, total: count ?? 0, page, limit });
});

export const POST = withErrorHandling(async (request: Request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = jobCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid job data." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to create job." },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
});
