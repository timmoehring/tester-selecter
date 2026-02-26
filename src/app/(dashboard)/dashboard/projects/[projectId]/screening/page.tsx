"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { WorkflowSteps } from "@/components/layout/workflow-steps";

interface FlagData {
  id: string;
  flag: string;
  reason: string;
  excluded: boolean;
}

interface FlaggedTester {
  testerId: string;
  username: string;
  email: string;
  flags: FlagData[];
}

const FLAG_COLORS: Record<string, string> = {
  FAKE_NAME: "bg-red-100 text-red-800",
  LOW_EFFORT: "bg-orange-100 text-orange-800",
  DUPLICATE_PATTERN: "bg-purple-100 text-purple-800",
  GENERIC_RESPONSE: "bg-yellow-100 text-yellow-800",
};

const FLAG_LABELS: Record<string, string> = {
  FAKE_NAME: "Fake Name",
  LOW_EFFORT: "Low Effort",
  DUPLICATE_PATTERN: "Duplicate Pattern",
  GENERIC_RESPONSE: "Generic Response",
};

export default function ScreeningPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const [screening, setScreening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flaggedTesters, setFlaggedTesters] = useState<FlaggedTester[]>([]);
  const [totalApplicants, setTotalApplicants] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadScreeningResults();
  }, [projectId]);

  async function loadScreeningResults() {
    const res = await fetch(`/api/projects/${projectId}/screening`);
    if (res.ok) {
      const data = await res.json();
      setFlaggedTesters(data.flaggedTesters || []);
      setTotalApplicants(data.totalApplicants || 0);

      // Initialize decisions from existing data
      const initial: Record<string, boolean> = {};
      for (const tester of data.flaggedTesters || []) {
        // Default to excluded for flagged testers
        const anyExcluded = tester.flags.some(
          (f: FlagData) => f.excluded
        );
        initial[tester.testerId] = anyExcluded;
      }
      setDecisions(initial);
    }
    setLoaded(true);
  }

  async function runScreening() {
    setScreening(true);
    const res = await fetch(`/api/projects/${projectId}/screening`, {
      method: "POST",
    });

    if (res.ok) {
      await loadScreeningResults();
      // Default all flagged testers to excluded
      const newDecisions: Record<string, boolean> = {};
      for (const tester of flaggedTesters) {
        newDecisions[tester.testerId] = true;
      }
      setDecisions(newDecisions);
    }
    setScreening(false);
  }

  function setAll(excluded: boolean) {
    const updated: Record<string, boolean> = {};
    for (const tester of flaggedTesters) {
      updated[tester.testerId] = excluded;
    }
    setDecisions(updated);
  }

  async function confirmAndContinue() {
    setSaving(true);
    const decisionList = flaggedTesters.map((t) => ({
      testerId: t.testerId,
      excluded: decisions[t.testerId] ?? true,
    }));

    const res = await fetch(`/api/projects/${projectId}/screening`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisions: decisionList }),
    });

    if (res.ok) {
      router.push(`/dashboard/projects/${projectId}/selection`);
    } else {
      alert("Failed to save screening decisions");
      setSaving(false);
    }
  }

  async function skipAndContinue() {
    setSaving(true);
    // Save empty decisions to advance workflow
    const res = await fetch(`/api/projects/${projectId}/screening`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisions: [] }),
    });

    if (res.ok) {
      router.push(`/dashboard/projects/${projectId}/selection`);
    } else {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const hasResults = flaggedTesters.length > 0;
  const hasRun = loaded && totalApplicants > 0 && flaggedTesters !== null;

  return (
    <div>
      <WorkflowSteps currentStep="screening" projectId={projectId} />
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="mb-6 text-2xl font-bold">Screening</h1>

        {!hasResults ? (
          <div className="text-center">
            <p className="mb-4 text-muted-foreground">
              Scan all applicants for suspicious patterns (fake names,
              low-effort responses, duplicate accounts) before running the
              solver.
            </p>

            <div className="flex justify-center gap-3">
              <button
                onClick={runScreening}
                disabled={screening}
                className="rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {screening ? (
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
                    Screening...
                  </span>
                ) : (
                  "Run Screening"
                )}
              </button>

              {hasRun && (
                <button
                  onClick={skipAndContinue}
                  disabled={saving}
                  className="rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  Skip & Continue
                </button>
              )}
            </div>

            {loaded && totalApplicants > 0 && flaggedTesters.length === 0 && (
              <div className="mt-6 rounded-lg border border-success/30 bg-success/10 p-4">
                <p className="text-sm font-medium text-success">
                  No suspicious testers detected. All clear!
                </p>
                <button
                  onClick={skipAndContinue}
                  disabled={saving}
                  className="mt-3 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Continuing..." : "Continue to Selection"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Summary bar */}
            <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-card p-4">
              <p className="text-sm">
                <span className="font-semibold text-warning">
                  {flaggedTesters.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold">{totalApplicants}</span>{" "}
                testers flagged
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setAll(true)}
                  className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-muted"
                >
                  Exclude All
                </button>
                <button
                  onClick={() => setAll(false)}
                  className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-muted"
                >
                  Include All
                </button>
              </div>
            </div>

            {/* Flagged testers list */}
            <div className="space-y-3">
              {flaggedTesters.map((tester) => {
                const excluded = decisions[tester.testerId] ?? true;

                return (
                  <div
                    key={tester.testerId}
                    className={`rounded-lg border p-4 transition-colors ${
                      excluded
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {tester.username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tester.email}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setDecisions((prev) => ({
                              ...prev,
                              [tester.testerId]: false,
                            }))
                          }
                          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                            !excluded
                              ? "bg-success/10 text-success"
                              : "border border-border hover:bg-muted"
                          }`}
                        >
                          Include
                        </button>
                        <button
                          onClick={() =>
                            setDecisions((prev) => ({
                              ...prev,
                              [tester.testerId]: true,
                            }))
                          }
                          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                            excluded
                              ? "bg-destructive/10 text-destructive"
                              : "border border-border hover:bg-muted"
                          }`}
                        >
                          Exclude
                        </button>
                      </div>
                    </div>

                    {/* Flag badges */}
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {tester.flags.map((f, i) => (
                        <span
                          key={i}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            FLAG_COLORS[f.flag] || "bg-muted text-muted-foreground"
                          }`}
                        >
                          {FLAG_LABELS[f.flag] || f.flag}
                        </span>
                      ))}
                    </div>

                    {/* Reasons */}
                    <div className="space-y-1">
                      {tester.flags.map((f, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {f.reason}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={confirmAndContinue}
                disabled={saving}
                className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Confirm & Continue"}
              </button>
              <button
                onClick={runScreening}
                disabled={screening}
                className="rounded-md border border-border px-6 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Re-Run Screening
              </button>
              <button
                onClick={() => router.back()}
                className="rounded-md border border-border px-6 py-2 text-sm font-medium hover:bg-muted"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
