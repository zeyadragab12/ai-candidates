import type { SupabaseClient } from "@supabase/supabase-js";

import { getDisplayName } from "@/lib/users/displayName";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export interface NotificationItem {
  id: string;
  read: boolean;
  createdAt: string;
  actorName: string;
  action: string;
  description: string;
  href: string;
}

interface NotificationActivity {
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
}

interface NotificationRow {
  id: string;
  read_at: string | null;
  created_at: string;
  activity_log: NotificationActivity | null;
}

/** Where clicking a notification should take its recipient. */
export function notificationHref(activity: NotificationActivity): string {
  const jobId = typeof activity.metadata?.jobId === "string" ? activity.metadata.jobId : null;

  if (activity.entity_type === "search_run" && activity.entity_id && jobId) {
    return `/candidates?jobId=${jobId}&runId=${activity.entity_id}`;
  }
  if (activity.entity_type === "job" && activity.entity_id) {
    return `/candidates?jobId=${activity.entity_id}`;
  }
  if (activity.entity_type === "candidate" && activity.entity_id) {
    return `/candidates/${activity.entity_id}`;
  }
  if (activity.action === "auth.access_requested") {
    return "/admin";
  }
  return activity.user_id ? `/manager/team/${activity.user_id}` : "/manager";
}

const LIST_LIMIT = 20;

/**
 * The caller's latest notifications plus their unread count. RLS limits
 * both to the caller's own rows; a notification whose activity the caller
 * can no longer read (e.g. the actor moved to another team) is dropped.
 */
export async function loadNotifications(
  supabase: AnySupabaseClient,
): Promise<{ unread: number; items: NotificationItem[]; error: boolean }> {
  const [listRes, unreadRes] = await Promise.all([
    supabase
      .from("notifications")
      .select(
        "id, read_at, created_at, activity_log(user_id, action, entity_type, entity_id, description, metadata)",
      )
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
  ]);

  const rows = ((listRes.data ?? []) as unknown as NotificationRow[]).filter(
    (row): row is NotificationRow & { activity_log: NotificationActivity } => row.activity_log !== null,
  );

  const actorIds = Array.from(
    new Set(rows.map((row) => row.activity_log.user_id).filter((id): id is string => id !== null)),
  );
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, email").in("id", actorIds)
    : { data: [] };
  const emails = new Map(((actors ?? []) as { id: string; email: string }[]).map((a) => [a.id, a.email]));

  return {
    unread: unreadRes.count ?? 0,
    items: rows.map((row) => ({
      id: row.id,
      read: row.read_at !== null,
      createdAt: row.created_at,
      actorName:
        getDisplayName(row.activity_log.user_id ? emails.get(row.activity_log.user_id) : null) ??
        "A teammate",
      action: row.activity_log.action,
      description: row.activity_log.description,
      href: notificationHref(row.activity_log),
    })),
    error: Boolean(listRes.error || unreadRes.error),
  };
}
