"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { WorkflowSteps } from "@/components/layout/workflow-steps";

interface DemographicData {
  [segId: string]: {
    name: string;
    targets: Record<string, number>;
    actual: Record<string, number>;
  };
}

export default function SelectionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const [solving, setSolving] = useState(false);
  const [result, setResult] = useState<{
    selectedCount: number;
    backupCount: number;
    demographics: DemographicData;
    solveTimeMs: number;
  } | null>(null);
  const [error, setError] = useState("");

  async function runSolver() {
    setSolving(true);
    setError("");

    const res = await fetch(`/api/projects/${projectId}/solve`, {
      method: "POST",
    });

    if (res.ok) {
      const data = await res.json();
      setResult(data);
    } else {
      const data = await res.json();
      setError(data.error || "Solver failed");
    }
    setSolving(false);
  }

  return (
    <div>
      <WorkflowSteps currentStep="selection" projectId={projectId} />
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="mb-6 text-2xl font-bold">Run Selection</h1>

        {!result ? (
          <div className="text-center">
            <p className="mb-4 text-muted-foreground">
              Run the constraint solver to select optimal testers based on your
              requirements and segmentation targets.
            </p>

            {error && (
              <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              onClick={runSolver}
              disabled={solving}
              className="rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {solving ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="opacity-25"
                    />
                    <path
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      fill="currentColor"
                      className="opacity-75"
                    />
                  </svg>
                  Solving...
                </span>
              ) : (
                "Run Solver"
              )}
            </button>
          </div>
        ) : (
          <div>
            {/* Summary */}
            <div className="mb-6 grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-primary">
                  {result.selectedCount}
                </p>
                <p className="text-xs text-muted-foreground">Selected</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold">{result.backupCount}</p>
                <p className="text-xs text-muted-foreground">Backup Pool</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold">
                  {(result.solveTimeMs / 1000).toFixed(1)}s
                </p>
                <p className="text-xs text-muted-foreground">Solve Time</p>
              </div>
            </div>

            {/* Demographics Overview */}
            {Object.keys(result.demographics).length > 0 && (
              <div className="mb-6">
                <h2 className="mb-3 text-lg font-semibold">
                  Demographics Overview
                </h2>
                <div className="space-y-4">
                  {Object.entries(result.demographics).map(
                    ([segId, segData]) => (
                      <div
                        key={segId}
                        className="rounded-lg border border-border bg-card p-4"
                      >
                        <h3 className="mb-2 text-sm font-medium">
                          {segData.name}
                        </h3>
                        <div className="space-y-2">
                          {Object.entries(segData.targets).map(
                            ([value, target]) => {
                              const actual = segData.actual[value] || 0;
                              const diff = actual - target;
                              const color =
                                Math.abs(diff) <= 5
                                  ? "bg-success"
                                  : Math.abs(diff) <= 10
                                    ? "bg-warning"
                                    : "bg-destructive";

                              return (
                                <div key={value}>
                                  <div className="flex justify-between text-xs">
                                    <span>{value}</span>
                                    <span>
                                      {actual.toFixed(1)}% / {target}% target
                                      <span
                                        className={`ml-1 ${
                                          diff >= 0
                                            ? "text-success"
                                            : "text-destructive"
                                        }`}
                                      >
                                        ({diff >= 0 ? "+" : ""}
                                        {diff.toFixed(1)}%)
                                      </span>
                                    </span>
                                  </div>
                                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={`h-full rounded-full ${color}`}
                                      style={{
                                        width: `${Math.min(actual, 100)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() =>
                  router.push(
                    `/dashboard/projects/${projectId}/review`
                  )
                }
                className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Review Testers
              </button>
              <button
                onClick={runSolver}
                className="rounded-md border border-border px-6 py-2 text-sm font-medium hover:bg-muted"
              >
                Re-Run Solver
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
