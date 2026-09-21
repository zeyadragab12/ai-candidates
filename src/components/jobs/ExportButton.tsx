"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

interface ExportButtonProps {
  jobId: string;
  queryString?: string;
}

export function ExportButton({ jobId, queryString }: ExportButtonProps) {
  const href = `/api/jobs/${jobId}/export${queryString ? `?${queryString}` : ""}`;

  return (
    <Button
      asChild
      variant="outline"
      data-testid="export-button"
      onClick={() => {
        toast.success("Downloading candidate export spreadsheet...", "Export Initiated");
      }}
    >
      <a href={href} className="inline-flex items-center gap-1.5">
        <Download className="h-4 w-4" />
        Export Excel
      </a>
    </Button>
  );
}
