"use client";

import { useState, useEffect, use } from "react";
import { WorkflowSteps } from "@/components/layout/workflow-steps";

export default function ExportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [columns, setColumns] = useState("both");
  const [statusFilter, setStatusFilter] = useState("APPROVED");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/testers`)
      .then((r) => r.json())
      .then((data) => {
        const c: Record<string, number> = {};
        for (const sel of data.selections) {
          c[sel.status] = (c[sel.status] || 0) + 1;
        }
        setCounts(c);
        setLoading(false);
      });
  }, [projectId]);

  function handleExport() {
    window.open(
      `/api/projects/${projectId}/export?columns=${columns}&status=${statusFilter}`,
      "_blank"
    );
  }

  return (
    <div>
      <WorkflowSteps currentStep="export" projectId={projectId} />
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="mb-6 text-2xl font-bold">Export Testers</h1>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <>
            {/* Summary */}
            <div className="mb-6 grid grid-cols-4 gap-3">
              {Object.entries(counts).map(([status, count]) => (
                <div
                  key={status}
                  className="rounded-lg border border-border bg-card p-3 text-center"
                >
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{status}</p>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              {/* Status filter */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Export which testers?
                </label>
                <div className="flex gap-2">
                  {["APPROVED", "SELECTED", "ALL"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`rounded-md px-4 py-2 text-sm font-medium ${
                        statusFilter === s
                          ? "bg-primary text-primary-foreground"
                          : "border border-border hover:bg-muted"
                      }`}
                    >
                      {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Column format */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  CSV Format
                </label>
                <div className="flex gap-2">
                  {[
                    { value: "username_only", label: "Username Only" },
                    { value: "email_only", label: "Email Only" },
                    { value: "both", label: "Username + Email" },
                    { value: "full", label: "Full Details" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setColumns(opt.value)}
                      className={`rounded-md px-4 py-2 text-sm font-medium ${
                        columns === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "border border-border hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleExport}
                className="rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Download CSV
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
