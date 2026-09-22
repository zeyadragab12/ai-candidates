"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { EmptyCell } from "@/components/ui/empty-cell";

const VISIBLE_SKILLS_LIMIT = 3;

interface SkillsCellProps {
  skills: string[];
}

export function SkillsCell({ skills }: SkillsCellProps) {
  const [expanded, setExpanded] = useState(false);

  if (skills.length === 0) return <EmptyCell />;

  const visible = expanded ? skills : skills.slice(0, VISIBLE_SKILLS_LIMIT);
  const hiddenCount = skills.length - VISIBLE_SKILLS_LIMIT;

  return (
    <div className="flex max-w-[220px] flex-wrap items-center gap-1">
      {visible.map((skill) => (
        <Badge key={skill} tone="neutral" className="font-normal">
          {skill}
        </Badge>
      ))}
      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent/70"
          data-testid="skills-expand"
          aria-label={`Show ${hiddenCount} more skills`}
        >
          +{hiddenCount}
        </button>
      )}
      {expanded && skills.length > VISIBLE_SKILLS_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
        >
          Show less
        </button>
      )}
    </div>
  );
}
