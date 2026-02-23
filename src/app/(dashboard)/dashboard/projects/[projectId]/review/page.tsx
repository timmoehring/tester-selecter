"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { WorkflowSteps } from "@/components/layout/workflow-steps";
import { TesterCard, type TesterCardProps } from "@/components/review/tester-card";

type Selection = TesterCardProps["selection"];

export default function ReviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const [selections, setSelections] = useState<Selection[]>([]);
  const [requirements, setRequirements] = useState<TesterCardProps["requirements"]>([]);
  const [mappings, setMappings] = useState<TesterCardProps["mappings"]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [analyzingSentiment, setAnalyzingSentiment] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    loadTesters();
  }, [projectId]);

  async function loadTesters() {
    const res = await fetch(`/api/projects/${projectId}/testers`);
    const data = await res.json();
    setSelections(data.selections);
    setRequirements(data.requirements);
    setMappings(data.mappings);
    setLoading(false);
  }

  async function runSentimentAnalysis() {
    setAnalyzingSentiment(true);
    await fetch(`/api/projects/${projectId}/sentiment`, { method: "POST" });
    await loadTesters();
    setAnalyzingSentiment(false);
  }

  async function handleStatusChange(testerId: string, status: string) {
    await fetch(`/api/projects/${projectId}/testers/${testerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    setSelections((prev) =>
      prev.map((s) =>
        s.tester.id === testerId ? { ...s, status } : s
      )
    );
  }

  async function handleNotesChange(testerId: string, notes: string) {
    await fetch(`/api/projects/${projectId}/testers/${testerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewNotes: notes }),
    });
  }

  const filteredSelections =
    filter === "ALL"
      ? selections.filter((s) => s.status !== "BACKUP")
      : selections.filter((s) => s.status === filter);

  const statusCounts = {
    ALL: selections.filter((s) => s.status !== "BACKUP").length,
    SELECTED: selections.filter((s) => s.status === "SELECTED").length,
    APPROVED: selections.filter((s) => s.status === "APPROVED").length,
    REJECTED: selections.filter((s) => s.status === "REJECTED").length,
    CONSIDER: selections.filter((s) => s.status === "CONSIDER").length,
    BACKUP: selections.filter((s) => s.status === "BACKUP").length,
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Loading testers...</p>
      </div>
    );
  }

  const currentTester = filteredSelections[currentIndex];

  return (
    <div>
      <WorkflowSteps currentStep="review" projectId={projectId} />
      <div className="flex h-[calc(100vh-8rem)]">
        {/* Sidebar - tester list */}
        <div className="w-72 flex-shrink-0 overflow-y-auto border-r border-border bg-card">
          <div className="sticky top-0 border-b border-border bg-card p-3">
            <div className="flex flex-wrap gap-1">
              {(
                ["ALL", "SELECTED", "APPROVED", "REJECTED", "CONSIDER", "BACKUP"] as const
              ).map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setFilter(status);
                    setCurrentIndex(0);
                  }}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    filter === status
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {status} ({statusCounts[status]})
                </button>
              ))}
            </div>

            <button
              onClick={runSentimentAnalysis}
              disabled={analyzingSentiment}
              className="mt-2 w-full rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
            >
              {analyzingSentiment ? "Analyzing..." : "Run Sentiment Analysis"}
            </button>
          </div>

          <div className="space-y-0.5 p-1">
            {filteredSelections.map((sel, i) => (
              <button
                key={sel.tester.id}
                onClick={() => setCurrentIndex(i)}
                className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm ${
                  i === currentIndex
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                }`}
              >
                <span
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${
                    sel.status === "APPROVED"
                      ? "bg-success"
                      : sel.status === "REJECTED"
                        ? "bg-destructive"
                        : sel.status === "CONSIDER"
                          ? "bg-warning"
                          : "bg-muted-foreground/30"
                  }`}
                />
                <span className="flex-1 truncate">{sel.tester.username}</span>
                {sel.sentimentGrade && (
                  <span className="text-xs text-muted-foreground">
                    {sel.sentimentGrade}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentTester ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {currentIndex + 1} of {filteredSelections.length}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setCurrentIndex(Math.max(0, currentIndex - 1))
                    }
                    disabled={currentIndex === 0}
                    className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted disabled:opacity-30"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setCurrentIndex(
                        Math.min(
                          filteredSelections.length - 1,
                          currentIndex + 1
                        )
                      )
                    }
                    disabled={currentIndex >= filteredSelections.length - 1}
                    className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              </div>

              <TesterCard
                selection={currentTester}
                requirements={requirements}
                mappings={mappings}
                onStatusChange={handleStatusChange}
                onNotesChange={handleNotesChange}
              />
            </div>
          ) : (
            <p className="text-center text-muted-foreground">
              No testers to show for this filter.
            </p>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={() =>
                router.push(`/dashboard/projects/${projectId}/export`)
              }
              className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Continue to Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
