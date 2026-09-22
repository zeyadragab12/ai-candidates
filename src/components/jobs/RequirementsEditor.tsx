"use client";

import { useState } from "react";
import { X, Plus, GraduationCap, Briefcase, Tag, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { JobAnalysis } from "@/types/job-analysis";
import { cn } from "@/lib/utils";

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
  placeholder,
  badgeTone = "neutral",
}: {
  label: string;
  items: string[];
  onChangeItems: (items: string[]) => void;
  testId: string;
  placeholder?: string;
  badgeTone?: "neutral" | "good" | "warning";
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
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{label}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {items.length}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" data-testid={testId}>
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              "group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 pl-2.5 pr-1.5 py-1 text-xs transition-all hover:bg-white hover:shadow-xs",
              badgeTone === "good" && "border-emerald-200 bg-emerald-50/60 text-emerald-950",
              badgeTone === "warning" && "border-amber-200 bg-amber-50/60 text-amber-950"
            )}
          >
            <input
              value={item}
              onChange={(e) => editItem(index, e.target.value)}
              data-testid={`${testId}-item-${index}`}
              className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none min-w-[60px]"
              aria-label={`${label} item ${index + 1}`}
            />
            <button
              type="button"
              className="rounded p-0.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
              aria-label={`Remove ${item}`}
              onClick={() => removeItem(index)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder || `Add ${label.toLowerCase()}...`}
          data-testid={`${testId}-add-input`}
          className="h-8 text-xs bg-slate-50/50"
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
          size="sm"
          onClick={addItem}
          data-testid={`${testId}-add-button`}
          className="h-8 px-3 text-xs shrink-0"
        >
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>
    </div>
  );
}

export function RequirementsEditor({ value, onChange }: RequirementsEditorProps) {
  const [activeTab, setActiveTab] = useState<"skills" | "qualifications" | "overview">("skills");

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
      
      {/* Top Role Overview Card */}
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-indigo-100/80">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Extracted Role Profile</h3>
          </div>
          <span className="text-xs text-indigo-600 bg-indigo-50 font-medium px-2.5 py-0.5 rounded-full border border-indigo-200/60">
            AI-Analyzed
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700" htmlFor="ra-job-title">
              Job Title
            </label>
            <Input
              id="ra-job-title"
              value={value.job_title}
              onChange={(e) => updateField("job_title", e.target.value)}
              className="bg-white text-sm h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700" htmlFor="ra-seniority">
              Seniority Level
            </label>
            <Input
              id="ra-seniority"
              value={value.seniority}
              onChange={(e) => updateField("seniority", e.target.value)}
              placeholder="e.g. Senior, Lead, Mid"
              className="bg-white text-sm h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700" htmlFor="ra-location">
              Location
            </label>
            <Input
              id="ra-location"
              value={value.location}
              onChange={(e) => updateField("location", e.target.value)}
              className="bg-white text-sm h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700" htmlFor="ra-employment-type">
              Employment Type
            </label>
            <Input
              id="ra-employment-type"
              value={value.employment_type}
              onChange={(e) => updateField("employment_type", e.target.value)}
              className="bg-white text-sm h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700" htmlFor="ra-min-exp">
              Min Experience (Years)
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
              className="bg-white text-sm h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700" htmlFor="ra-max-exp">
              Max Experience (Years)
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
              className="bg-white text-sm h-9"
            />
          </div>
        </div>
      </div>

      {/* Navigation Tabs for Clean Organization */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("skills")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "skills"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <Tag className="h-4 w-4" />
          Skills & Technologies
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs">
            {value.required_skills.length + value.preferred_skills.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("qualifications")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "qualifications"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <GraduationCap className="h-4 w-4" />
          Education & Qualifications
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "overview"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <Briefcase className="h-4 w-4" />
          Responsibilities & Keywords
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "skills" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <EditableList
            label="Required Skills"
            items={value.required_skills}
            onChangeItems={(items) => updateArrayField("required_skills", items)}
            testId="requirements-required_skills"
            badgeTone="good"
            placeholder="Add required skill (e.g. React)..."
          />

          <EditableList
            label="Preferred Skills"
            items={value.preferred_skills}
            onChangeItems={(items) => updateArrayField("preferred_skills", items)}
            testId="requirements-preferred_skills"
            badgeTone="warning"
            placeholder="Add nice-to-have skill..."
          />
        </div>
      )}

      {activeTab === "qualifications" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <EditableList
            label="Education"
            items={value.education}
            onChangeItems={(items) => updateArrayField("education", items)}
            testId="requirements-education"
          />

          <EditableList
            label="Certifications"
            items={value.certifications}
            onChangeItems={(items) => updateArrayField("certifications", items)}
            testId="requirements-certifications"
          />

          <EditableList
            label="Languages"
            items={value.languages}
            onChangeItems={(items) => updateArrayField("languages", items)}
            testId="requirements-languages"
          />

          <EditableList
            label="Industries"
            items={value.industries}
            onChangeItems={(items) => updateArrayField("industries", items)}
            testId="requirements-industries"
          />
        </div>
      )}

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <EditableList
            label="Responsibilities"
            items={value.responsibilities}
            onChangeItems={(items) => updateArrayField("responsibilities", items)}
            testId="requirements-responsibilities"
          />

          <EditableList
            label="Keywords"
            items={value.keywords}
            onChangeItems={(items) => updateArrayField("keywords", items)}
            testId="requirements-keywords"
          />
        </div>
      )}

    </div>
  );
}

