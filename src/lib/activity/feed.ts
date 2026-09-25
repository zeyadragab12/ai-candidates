import { getDisplayName } from "@/lib/users/displayName";

export const ACTIVITY_FEED_COLUMNS = "id, user_id, action, entity_type, description, created_at";

export interface ActivityLogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  description: string;
  created_at: string;
}

export interface ActivityFeedItem {
  id: string;
  actorName: string;
  action: string;
  description: string;
  createdAt: string;
}

export function toActivityFeedItems(
  rows: ActivityLogRow[],
  emailsById: Map<string, string>,
): ActivityFeedItem[] {
  return rows.map((row) => ({
    id: row.id,
    actorName: getDisplayName(row.user_id ? emailsById.get(row.user_id) : null) ?? "Unknown user",
    action: row.action,
    description: row.description,
    createdAt: row.created_at,
  }));
}
