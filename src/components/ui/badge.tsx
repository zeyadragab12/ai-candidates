import * as React from "react";

import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  neutral: "bg-muted text-muted-foreground",
  good: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
} as const;

export type BadgeTone = keyof typeof TONE_CLASSES;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}

export function runStatusTone(status: string): BadgeTone {
  if (status === "complete") return "good";
  if (status === "running" || status === "pending") return "warning";
  if (status === "error") return "critical";
  return "neutral";
}

/** Buckets a 0–100 match score into the tone a CEO would expect at a glance:
 * strong (green), workable (amber), weak (red). No score yet = neutral gray. */
export function matchScoreTone(score: number | null | undefined): BadgeTone {
  if (score === null || score === undefined) return "neutral";
  if (score >= 70) return "good";
  if (score >= 40) return "warning";
  return "critical";
}
