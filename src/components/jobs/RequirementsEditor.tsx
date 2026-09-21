"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobAnalysis } from "@/types/job-analysis";

type ArrayField =
  | "required_skills"
  | "preferred_skills"
  | "education"
  | "certifications"
  | "languages"
  | "industries"
  | "keywords"
  | "responsibilities";

interface RequirementsEditorProps {
  value: JobAnalysis;
  onChange: (updated: JobAnalysis) => void;
}

function EditableList({
  label,
  items,
  onChangeItems,
  testId,
}: {
  label: string;
  items: string[];
  onChangeItems: (items: string[]) => void;
  testId: string;
}) {
  const [draft, setDraft] = useState("");

  function addItem() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChangeItems([...items, trimmed]);
    setDraft("");
  }

  function removeItem(index: number) {
    onChangeItems(items.filter((_, i) => i !== index));
  }

  function editItem(index: number, newValue: string) {
    onChangeItems(items.map((item, i) => (i === index ? newValue : item)));
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-col gap-2" data-testid={testId}>
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={item}
              onChange={(e) => editItem(index, e.target.value)}
              data-testid={`${testId}-item-${index}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${item}`}
              onClick={() => removeItem(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Add ${label.toLowerCase()}...`}
          data-testid={`${testId}-add-input`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={addItem}
          data-testid={`${testId}-add-button`}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

const ARRAY_FIELD_LABELS: Record<ArrayField, string> = {
  required_skills: "Required Skills",
  preferred_skills: "Preferred Skills",
  education: "Education",
  certifications: "Certifications",
  languages: "Languages",
  industries: "Industries",
  keywords: "Keywords",
  responsibilities: "Responsibilities",
};

export function RequirementsEditor({ value, onChange }: RequirementsEditorProps) {
  function updateField<K extends keyof JobAnalysis>(
    field: K,
    fieldValue: JobAnalysis[K],
  ) {
    onChange({ ...value, [field]: fieldValue });
  }

  function updateArrayField(field: ArrayField, items: string[]) {
    updateField(field, items);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="ra-job-title">
            Job Title
          </label>
          <Input
            id="ra-job-title"
            value={value.job_title}
            onChange={(e) => updateField("job_title", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="ra-seniority">
            Seniority
          </label>
          <Input
            id="ra-seniority"
            value={value.seniority}
            onChange={(e) => updateField("seniority", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="ra-location">
            Location
          </label>
          <Input
            id="ra-location"
            value={value.location}
            onChange={(e) => updateField("location", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="ra-employment-type">
            Employment Type
          </label>
          <Input
            id="ra-employment-type"
            value={value.employment_type}
            onChange={(e) => updateField("employment_type", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="ra-min-exp">
            Minimum Years of Experience
          </label>
          <Input
            id="ra-min-exp"
            type="number"
            value={value.years_of_experience.minimum ?? ""}
            onChange={(e) =>
              updateField("years_of_experience", {
                ...value.years_of_experience,
                minimum: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="ra-max-exp">
            Maximum Years of Experience
          </label>
          <Input
            id="ra-max-exp"
            type="number"
            value={value.years_of_experience.maximum ?? ""}
            onChange={(e) =>
              updateField("years_of_experience", {
                ...value.years_of_experience,
                maximum: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </div>
      </div>

      {(Object.keys(ARRAY_FIELD_LABELS) as ArrayField[]).map((field) => (
        <EditableList
          key={field}
          label={ARRAY_FIELD_LABELS[field]}
          items={value[field]}
          onChangeItems={(items) => updateArrayField(field, items)}
          testId={`requirements-${field}`}
        />
      ))}
    </div>
  );
}
