import { Button } from "@/components/ui/button";

interface ExportButtonProps {
  jobId: string;
  queryString?: string;
}

/**
 * A plain anchor (not a JS-driven download) so the browser handles the
 * download natively and picks up the server's dynamic filename from the
 * Content-Disposition header — no filename logic duplicated client-side.
 */
export function ExportButton({ jobId, queryString }: ExportButtonProps) {
  const href = `/api/jobs/${jobId}/export${queryString ? `?${queryString}` : ""}`;

  return (
    <Button asChild variant="outline" data-testid="export-button">
      <a href={href}>Export Excel</a>
    </Button>
  );
}
