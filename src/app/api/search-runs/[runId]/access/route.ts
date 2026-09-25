import { NextResponse } from "next/server";

import { logActivity } from "@/lib/activity/log";
import { requireUser } from "@/lib/api/requireUser";
import { withErrorHandling } from "@/lib/errors";
import { getDisplayName } from "@/lib/users/displayName";

interface RouteParams {
  params: Promise<{ runId: string }>;
}

interface RunRow {
  id: string;
  jobs: { user_id: string; title: string } | null;
}

// Re-opening the same file within this window still records an access row,
// but doesn't add another activity-log entry.
const ACTIVITY_DEDUPE_MS = 30 * 60 * 1000;

/**
 * Records that the current user opened this sourcing run's candidate list.
 * Used to compute the dashboard's "Last Accessed By" / "Last Activity Time"
 * columns — every open is logged, so "last" is just the most recent row.
 * When the opener isn't the file's owner (e.g. their manager), the access is
 * also written to the activity log so it shows up in team views.
 */
export const POST = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;
  const { runId } = await params;

  // RLS decides visibility: a run the caller can't read is a 404, so access
  // can't be recorded against (or probe the existence of) someone else's file.
  const { data: run, error: runError } = await supabase
    .from("search_runs")
    .select("id, jobs(user_id, title)")
    .eq("id", runId)
    .maybeSingle();

  if (runError) {
    return NextResponse.json({ error: "Failed to load sourcing run." }, { status: 500 });
  }
  if (!run) {
    return NextResponse.json({ error: "Sourcing run not found." }, { status: 404 });
  }

  const owner = (run as unknown as RunRow).jobs;
  const isOwner = owner?.user_id === user.id;

  let recentlyAccessed = false;
  if (!isOwner) {
    const { data: previous } = await supabase
      .from("search_run_access")
      .select("accessed_at")
      .eq("search_run_id", runId)
      .eq("user_id", user.id)
      .order("accessed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    recentlyAccessed =
      previous !== null &&
      Date.now() - new Date(previous.accessed_at).getTime() < ACTIVITY_DEDUPE_MS;
  }

  const { error } = await supabase.from("search_run_access").insert({
    search_run_id: runId,
    user_id: user.id,
    user_email: user.email,
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to record run access." },
      { status: 500 },
    );
  }

  if (!isOwner && owner && !recentlyAccessed) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", owner.user_id)
      .maybeSingle();
    const ownerName = getDisplayName(ownerProfile?.email) ?? "a teammate";

    await logActivity(supabase, {
      userId: user.id,
      action: "sourcing_file.accessed",
      entityType: "search_run",
      entityId: runId,
      description: `Opened ${ownerName}'s sourcing file "${owner.title}"`,
      metadata: { ownerId: owner.user_id },
    });
  }

  return NextResponse.json({ success: true });
});
