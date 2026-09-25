import { History } from "lucide-react";

import type { AdminActivityRow } from "@/lib/admin/getAdminDashboardData";
import { formatRelativeTime } from "@/lib/dates/formatRelativeTime";

export function ActivityFeed({ activity }: { activity: AdminActivityRow[] }) {
  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <History className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-slate-900">No activity recorded yet</p>
        <p className="mt-1 max-w-xs text-xs text-slate-500">
          Job creation, status changes, and team changes will appear here.
        </p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col divide-y divide-slate-100" data-testid="admin-activity-feed">
      {activity.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-4 py-3">
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">{item.actorName}</span>{" "}
            {item.description.charAt(0).toLowerCase() + item.description.slice(1)}
          </p>
          <span className="shrink-0 text-xs text-slate-500">
            {formatRelativeTime(item.createdAt)}
          </span>
        </li>
      ))}
    </ol>
  );
}
