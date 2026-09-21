const BUCKETS = [
  { label: "0–20", min: 0, max: 20 },
  { label: "21–40", min: 21, max: 40 },
  { label: "41–60", min: 41, max: 60 },
  { label: "61–80", min: 61, max: 80 },
  { label: "81–100", min: 81, max: 100 },
] as const;

export function ScoreDistributionChart({ scores }: { scores: number[] }) {
  if (scores.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No candidates scored yet — run &ldquo;Score Candidates&rdquo; on a job to see the
        match-quality breakdown here.
      </p>
    );
  }

  const counts = BUCKETS.map(
    (bucket) => scores.filter((score) => score >= bucket.min && score <= bucket.max).length,
  );
  const max = Math.max(1, ...counts);

  return (
    <div
      className="flex h-40 items-end gap-3"
      role="img"
      aria-label="Distribution of candidate match scores"
    >
      {BUCKETS.map((bucket, i) => {
        const count = counts[i] ?? 0;
        const heightPct = count === 0 ? 0 : Math.max(6, (count / max) * 100);
        return (
          <div key={bucket.label} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-xs font-medium tabular-nums text-foreground">{count}</span>
            <div className="flex h-28 w-full items-end">
              <div
                className="w-full rounded-t-md bg-primary"
                style={{ height: `${heightPct}%` }}
                title={`${bucket.label}%: ${count} candidate${count === 1 ? "" : "s"}`}
              />
            </div>
            <span className="text-xs text-muted-foreground">{bucket.label}</span>
          </div>
        );
      })}
    </div>
  );
}
