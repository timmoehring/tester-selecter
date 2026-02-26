"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { WorkflowSteps } from "@/components/layout/workflow-steps";

interface SurveyQuestion {
  id: string;
  questionText: string;
  columnIndex: number;
}

interface Mapping {
  id: string;
  surveyQuestionId: string;
  requirementId?: string;
  segmentationId?: string;
  confidence: number;
  isConfirmed: boolean;
}

interface Requirement {
  id: string;
  name: string;
  type: string;
}

interface Segmentation {
  id: string;
  name: string;
}

export default function MappingPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [mappings, setMappings] = useState<
    Record<string, { targetId: string; targetType: string; confirmed: boolean }>
  >({});
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [segmentations, setSegmentations] = useState<Segmentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    const res = await fetch(`/api/projects/${projectId}/mapping`);
    const data = await res.json();
    setQuestions(data.questions);
    setRequirements(data.requirements);
    setSegmentations(data.segmentations);

    // Build mappings lookup
    const mappingMap: typeof mappings = {};
    for (const m of data.mappings as Mapping[]) {
      mappingMap[m.surveyQuestionId] = {
        targetId: m.requirementId || m.segmentationId || "",
        targetType: m.requirementId ? "requirement" : "segmentation",
        confirmed: m.isConfirmed,
      };
    }
    setMappings(mappingMap);
    setLoading(false);
  }

  async function runAutoMap() {
    setLoading(true);
    await fetch(`/api/projects/${projectId}/mapping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "auto-map" }),
    });
    await loadData();
  }

  function updateMapping(
    questionId: string,
    targetId: string,
    targetType: string
  ) {
    setMappings((prev) => ({
      ...prev,
      [questionId]: { targetId, targetType, confirmed: true },
    }));
  }

  function clearMapping(questionId: string) {
    setMappings((prev) => {
      const { [questionId]: _removed, ...rest } = prev;
      return rest;
    });
  }

  async function handleSave() {
    setSaving(true);
    const mappingData = Object.entries(mappings).map(
      ([surveyQuestionId, m]) => ({
        surveyQuestionId,
        requirementId: m.targetType === "requirement" ? m.targetId : undefined,
        segmentationId:
          m.targetType === "segmentation" ? m.targetId : undefined,
        isConfirmed: m.confirmed,
      })
    );

    const res = await fetch(`/api/projects/${projectId}/mapping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", mappings: mappingData }),
    });

    if (res.ok) {
      router.push(`/dashboard/projects/${projectId}/screening`);
    } else {
      alert("Failed to save mappings");
      setSaving(false);
    }
  }

  // Validation: check all hard requirements and segmentations are mapped
  const hardReqsMapped = requirements
    .filter((r) => r.type === "HARD")
    .every((r) =>
      Object.values(mappings).some(
        (m) => m.targetId === r.id && m.targetType === "requirement"
      )
    );
  const segsMapped = segmentations.every((s) =>
    Object.values(mappings).some(
      (m) => m.targetId === s.id && m.targetType === "segmentation"
    )
  );

  const allTargets = [
    ...requirements.map((r) => ({
      id: r.id,
      name: `${r.name} (${r.type})`,
      type: "requirement",
    })),
    ...segmentations.map((s) => ({
      id: s.id,
      name: `${s.name} (seg)`,
      type: "segmentation",
    })),
  ];

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Loading mapping data...</p>
      </div>
    );
  }

  return (
    <div>
      <WorkflowSteps currentStep="mapping" projectId={projectId} />
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Map Survey Questions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Match each survey question to a requirement or segmentation
              dimension
            </p>
          </div>
          <button
            onClick={runAutoMap}
            className="rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
          >
            Auto-Map
          </button>
        </div>

        {(!hardReqsMapped || !segsMapped) && (
          <div className="mb-4 rounded-md bg-warning/10 p-3 text-sm text-warning">
            {!hardReqsMapped && "Some hard requirements are not mapped. "}
            {!segsMapped && "Some segmentation dimensions are not mapped. "}
            All must be mapped before continuing.
          </div>
        )}

        <div className="space-y-2">
          {questions.map((q) => {
            const mapping = mappings[q.id];
            return (
              <div
                key={q.id}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">
                    {q.questionText}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={
                      mapping
                        ? `${mapping.targetType}:${mapping.targetId}`
                        : ""
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        clearMapping(q.id);
                      } else {
                        const [type, id] = val.split(":");
                        updateMapping(q.id, id, type);
                      }
                    }}
                    className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                  >
                    <option value="">-- Unmapped --</option>
                    {allTargets.map((t) => (
                      <option key={t.id} value={`${t.type}:${t.id}`}>
                        {t.name}
                      </option>
                    ))}
                  </select>

                  {mapping && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        mapping.confirmed
                          ? "bg-success/10 text-success"
                          : "bg-warning/10 text-warning"
                      }`}
                    >
                      {mapping.confirmed ? "Confirmed" : "Auto"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !hardReqsMapped || !segsMapped}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Confirm & Continue"}
          </button>
          <button
            onClick={() => router.back()}
            className="rounded-md border border-border px-6 py-2 text-sm font-medium hover:bg-muted"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
