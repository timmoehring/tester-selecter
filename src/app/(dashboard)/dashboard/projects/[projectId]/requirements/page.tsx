"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { WorkflowSteps } from "@/components/layout/workflow-steps";
import { TagInput } from "@/components/ui/tag-input";

interface Requirement {
  name: string;
  description: string;
  type: "HARD" | "SOFT";
  acceptedValues: string[];
  weight: number;
}

interface Segmentation {
  name: string;
  targetPercentages: Record<string, number>;
  tolerance: number;
}

export default function RequirementsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [segmentations, setSegmentations] = useState<Segmentation[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/requirements`)
      .then((r) => r.json())
      .then((data) => {
        if (data.requirements?.length) setRequirements(data.requirements);
        if (data.segmentations?.length) setSegmentations(data.segmentations);
      });
  }, [projectId]);

  function addRequirement() {
    setRequirements([
      ...requirements,
      { name: "", description: "", type: "HARD", acceptedValues: [], weight: 1 },
    ]);
  }

  function updateRequirement(i: number, field: keyof Requirement, value: Requirement[keyof Requirement]) {
    const updated = [...requirements];
    updated[i] = { ...updated[i], [field]: value };
    setRequirements(updated);
  }

  function removeRequirement(i: number) {
    setRequirements(requirements.filter((_, idx) => idx !== i));
  }

  function addSegmentation() {
    setSegmentations([
      ...segmentations,
      { name: "", targetPercentages: {}, tolerance: 5 },
    ]);
  }

  function updateSegmentation(i: number, field: keyof Segmentation, value: Segmentation[keyof Segmentation]) {
    const updated = [...segmentations];
    updated[i] = { ...updated[i], [field]: value };
    setSegmentations(updated);
  }

  function removeSegmentation(i: number) {
    setSegmentations(segmentations.filter((_, idx) => idx !== i));
  }

  function updateSegPercentage(segIdx: number, key: string, value: number) {
    const updated = [...segmentations];
    updated[segIdx] = {
      ...updated[segIdx],
      targetPercentages: { ...updated[segIdx].targetPercentages, [key]: value },
    };
    setSegmentations(updated);
  }

  function addSegPercentageEntry(segIdx: number) {
    const key = prompt("Enter segment value name (e.g., 'Male', '18-24'):");
    if (!key) return;
    updateSegPercentage(segIdx, key, 0);
  }

  function removeSegPercentageEntry(segIdx: number, key: string) {
    const updated = [...segmentations];
    const { [key]: _removed, ...rest } = updated[segIdx].targetPercentages;
    updated[segIdx] = { ...updated[segIdx], targetPercentages: rest };
    setSegmentations(updated);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/requirements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirements, segmentations }),
    });

    if (res.ok) {
      router.push(`/dashboard/projects/${projectId}/mapping`);
    } else {
      alert("Failed to save requirements");
      setSaving(false);
    }
  }

  return (
    <div>
      <WorkflowSteps currentStep="requirements" projectId={projectId} />
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="mb-6 text-2xl font-bold">
          Requirements & Segmentation
        </h1>

        {/* Requirements Section */}
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Requirements</h2>
            <button
              onClick={addRequirement}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              + Add Requirement
            </button>
          </div>

          {requirements.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No requirements defined. Add at least one to proceed.
            </p>
          ) : (
            <div className="space-y-4">
              {requirements.map((req, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <input
                        value={req.name}
                        onChange={(e) =>
                          updateRequirement(i, "name", e.target.value)
                        }
                        placeholder="Requirement name"
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                      />
                      <select
                        value={req.type}
                        onChange={(e) =>
                          updateRequirement(i, "type", e.target.value)
                        }
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                      >
                        <option value="HARD">Hard (required)</option>
                        <option value="SOFT">Soft (preferred)</option>
                      </select>
                    </div>
                    <button
                      onClick={() => removeRequirement(i)}
                      className="ml-2 text-destructive hover:text-destructive/80"
                    >
                      ×
                    </button>
                  </div>

                  <input
                    value={req.description}
                    onChange={(e) =>
                      updateRequirement(i, "description", e.target.value)
                    }
                    placeholder="Description (optional)"
                    className="mb-2 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                  />

                  <div className="flex items-center gap-3">
                    <TagInput
                      values={req.acceptedValues}
                      onChange={(vals) =>
                        updateRequirement(i, "acceptedValues", vals)
                      }
                      placeholder="Type a value and press Enter"
                    />
                    {req.type === "SOFT" && (
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-muted-foreground">
                          Weight:
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step={0.1}
                          value={req.weight}
                          onChange={(e) =>
                            updateRequirement(
                              i,
                              "weight",
                              parseFloat(e.target.value) || 1
                            )
                          }
                          className="w-16 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Segmentation Section */}
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Segmentation Dimensions</h2>
            <button
              onClick={addSegmentation}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              + Add Dimension
            </button>
          </div>

          {segmentations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No segmentation dimensions defined (optional).
            </p>
          ) : (
            <div className="space-y-4">
              {segmentations.map((seg, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <input
                      value={seg.name}
                      onChange={(e) =>
                        updateSegmentation(i, "name", e.target.value)
                      }
                      placeholder="Dimension name (e.g., Gender, Age Group)"
                      className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                    />
                    <div className="ml-3 flex items-center gap-1">
                      <label className="text-xs text-muted-foreground">
                        Tolerance %:
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={seg.tolerance}
                        onChange={(e) =>
                          updateSegmentation(
                            i,
                            "tolerance",
                            parseFloat(e.target.value) || 5
                          )
                        }
                        className="w-16 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                      />
                    </div>
                    <button
                      onClick={() => removeSegmentation(i)}
                      className="ml-2 text-destructive hover:text-destructive/80"
                    >
                      ×
                    </button>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(seg.targetPercentages).map(
                      ([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="w-32 text-sm">{key}</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={value}
                            onChange={(e) =>
                              updateSegPercentage(
                                i,
                                key,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
                          />
                          <span className="text-xs text-muted-foreground">
                            %
                          </span>
                          <button
                            onClick={() => removeSegPercentageEntry(i, key)}
                            className="text-xs text-destructive hover:underline"
                          >
                            remove
                          </button>
                        </div>
                      )
                    )}
                    <button
                      onClick={() => addSegPercentageEntry(i)}
                      className="text-xs text-primary hover:underline"
                    >
                      + Add segment value
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Continue"}
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
