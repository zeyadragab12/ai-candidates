import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  indigo: "from-indigo-500 to-indigo-700 shadow-indigo-500/35",
  sky: "from-sky-400 to-blue-600 shadow-sky-500/35",
  amber: "from-amber-400 to-amber-600 shadow-amber-500/35",
  emerald: "from-emerald-400 to-emerald-600 shadow-emerald-500/35",
} as const;

export type StatTone = keyof typeof TONE_CLASSES;

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "indigo",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: StatTone;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg",
            TONE_CLASSES[tone],
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </CardHeader>
      <CardContent>
        <p className="font-display text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
