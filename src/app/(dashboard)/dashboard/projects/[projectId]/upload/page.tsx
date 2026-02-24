"use client";

import { useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { WorkflowSteps } from "@/components/layout/workflow-steps";

export default function UploadPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const [surveyFile, setSurveyFile] = useState<File | null>(null);
  const [activeTestsFile, setActiveTestsFile] = useState<File | null>(null);
  const [usernameCol, setUsernameCol] = useState("username");
  const [emailCol, setEmailCol] = useState("email");
  const [communityScoreCol, setCommunityScoreCol] = useState("community_score");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      setSurveyFile(e.dataTransfer.files[0]);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!surveyFile) return;

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("surveyFile", surveyFile);
    formData.append("usernameCol", usernameCol);
    formData.append("emailCol", emailCol);
    formData.append("communityScoreCol", communityScoreCol);
    if (activeTestsFile) {
      formData.append("activeTestsFile", activeTestsFile);
    }

    const res = await fetch(`/api/projects/${projectId}/upload`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      alert(
        `Uploaded ${data.testerCount} testers with ${data.questionCount} questions`
      );
      router.push(`/dashboard/projects/${projectId}/requirements`);
    } else {
      const data = await res.json();
      setError(data.error || "Upload failed");
      setUploading(false);
    }
  }

  return (
    <div>
      <WorkflowSteps currentStep="upload" projectId={projectId} />
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="mb-6 text-2xl font-bold">Upload Survey Data</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Survey file drop zone */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Survey Data (CSV/Excel) *
            </label>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : surveyFile
                    ? "border-success bg-success/5"
                    : "border-border"
              }`}
            >
              {surveyFile ? (
                <div>
                  <p className="font-medium text-success">{surveyFile.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(surveyFile.size / 1024).toFixed(1)} KB
                  </p>
                  <button
                    type="button"
                    onClick={() => setSurveyFile(null)}
                    className="mt-2 text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-muted-foreground">
                    Drag and drop your survey file here, or{" "}
                    <label className="cursor-pointer text-primary hover:underline">
                      browse
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={(e) =>
                          setSurveyFile(e.target.files?.[0] || null)
                        }
                      />
                    </label>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Supports CSV, XLSX, XLS
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Column mapping */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Username Column
              </label>
              <input
                value={usernameCol}
                onChange={(e) => setUsernameCol(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Email Column
              </label>
              <input
                value={emailCol}
                onChange={(e) => setEmailCol(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Score Column
              </label>
              <input
                value={communityScoreCol}
                onChange={(e) => setCommunityScoreCol(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Active tests file */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Active Tests List (optional)
            </label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) =>
                setActiveTestsFile(e.target.files?.[0] || null)
              }
              className="w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
            />
          </div>

          <button
            type="submit"
            disabled={!surveyFile || uploading}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
