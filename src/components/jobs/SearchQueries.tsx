"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchQueriesProps {
  queries: string[];
  onChange: (queries: string[]) => void;
}

export function SearchQueries({ queries, onChange }: SearchQueriesProps) {
  const [draft, setDraft] = useState("");

  function addQuery() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...queries, trimmed]);
    setDraft("");
  }

  function removeQuery(index: number) {
    onChange(queries.filter((_, i) => i !== index));
  }

  function editQuery(index: number, newValue: string) {
    onChange(queries.map((query, i) => (i === index ? newValue : query)));
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Search Queries</span>
      <div className="flex flex-col gap-2" data-testid="search-queries-list">
        {queries.map((query, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => editQuery(index, e.target.value)}
              data-testid={`search-query-item-${index}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove query: ${query}`}
              onClick={() => removeQuery(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {queries.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No search queries yet. Add one below.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a custom search query..."
          data-testid="search-query-add-input"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addQuery();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={addQuery}
          data-testid="search-query-add-button"
        >
          Add
        </Button>
      </div>
    </div>
  );
}
