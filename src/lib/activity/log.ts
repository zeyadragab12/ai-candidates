import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ActivityEvent {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Writes to the append-only activity_log (no update/delete policy exists on
 * that table, so this is the only way rows get in). Failures are logged and
 * swallowed rather than thrown — an audit-trail write must never fail the
 * user-facing action it's describing.
 */
export async function logActivity(
  supabase: SupabaseClient,
  event: ActivityEvent,
): Promise<void> {
  const { error } = await supabase.from("activity_log").insert({
    user_id: event.userId,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    description: event.description,
    metadata: event.metadata ?? {},
  });

  if (error) {
    createLogger("activity-log").error("Failed to record activity", { error, event });
  }
}
