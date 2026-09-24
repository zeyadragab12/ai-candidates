const STAGE_ORDER = ["New", "Reviewed", "Shortlisted", "Contacted", "Rejected"] as const;

// Ordinal ramp for the four "in progress" stages (lightest→darkest, business
// order — furthest along the happy path gets the darkest step), per
// dataviz skill guidance for funnel/tier ordinal encoding. Rejected is a
// true status color (critical/red), not a step in the ramp, since it's a
// terminal exit rather than progress.
const STAGE_COLOR: Record<(typeof STAGE_ORDER)[number], string> = {
  New: "#86b6ef",
  Reviewed: "#5598e7",
  Shortlisted: "#2a78d6",
  Contacted: "#1c5cab",
  Rejected: "#d03b3b",
};

export function PipelineChart({ counts }: { counts: Record<string, number> }) {
  const total = STAGE_ORDER.reduce((sum, stage) => sum + (counts[stage] ?? 0), 0);
  const max = Math.max(1, ...STAGE_ORDER.map((stage) => counts[stage] ?? 0));

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No candidates yet — run a search to start building your pipeline.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3" role="img" aria-label="Candidate pipeline by stage">
      {STAGE_ORDER.map((stage) => {
        const count = counts[stage] ?? 0;
        const widthPct = Math.max(4, (count / max) * 100);
        return (
          <div key={stage} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm text-muted-foreground">{stage}</span>
            <div className="h-5 flex-1 overflow-hidden rounded-full bg-muted">
              {count > 0 && (
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{ width: `${widthPct}%`, backgroundColor: STAGE_COLOR[stage] }}
                  title={`${stage}: ${count}`}
                />
              )}
            </div>
            <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
