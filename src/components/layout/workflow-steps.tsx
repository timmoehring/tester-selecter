"use client";

const steps = [
  { key: "upload", label: "Upload Data" },
  { key: "requirements", label: "Requirements" },
  { key: "mapping", label: "Map Questions" },
  { key: "selection", label: "Run Selection" },
  { key: "review", label: "Review Testers" },
  { key: "export", label: "Export" },
];

export function WorkflowSteps({
  currentStep,
  projectId,
}: {
  currentStep: string;
  projectId: string;
}) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <nav className="flex items-center gap-2 overflow-x-auto px-6 py-3">
      {steps.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={step.key} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`h-px w-8 ${
                  isCompleted ? "bg-primary" : "bg-border"
                }`}
              />
            )}
            <a
              href={
                isCompleted || isCurrent
                  ? `/dashboard/projects/${projectId}/${step.key}`
                  : undefined
              }
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isCompleted
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  isCurrent
                    ? "bg-primary-foreground text-primary"
                    : isCompleted
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted-foreground/20 text-muted-foreground"
                }`}
              >
                {isCompleted ? "✓" : i + 1}
              </span>
              {step.label}
            </a>
          </div>
        );
      })}
    </nav>
  );
}
