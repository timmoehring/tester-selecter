"use client";

interface TesterResponse {
  surveyQuestionId: string;
  responseValue: string;
  surveyQuestion: {
    id: string;
    questionText: string;
    questionType: string;
  };
}

interface Requirement {
  id: string;
  name: string;
  type: string;
  acceptedValues: string[];
}

interface QuestionMapping {
  surveyQuestionId: string;
  requirementId?: string;
  segmentationId?: string;
  requirement?: { id: string; name: string; type: string; acceptedValues: string[] } | null;
  segmentation?: { id: string; name: string } | null;
}

export interface TesterCardProps {
  selection: {
    id: string;
    status: string;
    sentimentGrade?: string | null;
    sentimentNote?: string | null;
    reviewNotes?: string | null;
    solverScore?: number | null;
    rank?: number | null;
    tester: {
      id: string;
      username: string;
      email: string;
      communityScore: number;
      tgtbtExtreme: boolean;
      tgtbtOutlier: boolean;
      surveyResponses: TesterResponse[];
    };
    isOnActiveTest: boolean;
    isGoldenTicket: boolean;
  };
  requirements: Requirement[];
  mappings: QuestionMapping[];
  onStatusChange: (testerId: string, status: string) => void;
  onNotesChange: (testerId: string, notes: string) => void;
}

const gradeColors: Record<string, string> = {
  A: "bg-success/10 text-success border-success/30",
  B: "bg-primary/10 text-primary border-primary/30",
  C: "bg-warning/10 text-warning border-warning/30",
  D: "bg-orange-100 text-orange-700 border-orange-300",
  F: "bg-destructive/10 text-destructive border-destructive/30",
};

export function TesterCard({
  selection,
  requirements: _requirements,
  mappings,
  onStatusChange,
  onNotesChange,
}: TesterCardProps) {
  const { tester } = selection;

  // Build mapping lookup: questionId -> requirement
  const questionReqMap = new Map<string, Requirement>();
  for (const m of mappings) {
    if (m.requirement) {
      questionReqMap.set(m.surveyQuestionId, m.requirement);
    }
  }

  // Find "why" response (free-text question)
  const whyResponse = tester.surveyResponses.find(
    (r) =>
      r.surveyQuestion.questionType === "text" &&
      /why|reason|explain|describe|tell us/i.test(
        r.surveyQuestion.questionText
      )
  );

  // Determine response color based on requirement match
  function getResponseColor(response: TesterResponse): string {
    const req = questionReqMap.get(response.surveyQuestionId);
    if (!req) return "";
    if (req.acceptedValues.length === 0) return "";

    const matches = req.acceptedValues.some(
      (v) => v.toLowerCase().trim() === response.responseValue.toLowerCase().trim()
    );

    if (matches) return "bg-success/5 border-l-2 border-l-success";
    return "bg-destructive/5 border-l-2 border-l-destructive";
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{tester.username}</h3>
              {selection.isGoldenTicket && (
                <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning">
                  Golden Ticket
                </span>
              )}
              {selection.isOnActiveTest && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  Active Test
                </span>
              )}
              {tester.tgtbtExtreme && (
                <span
                  className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                  title="TGTBT: Extreme Maximizer (>80% highest options)"
                >
                  TGTBT-E
                </span>
              )}
              {tester.tgtbtOutlier && (
                <span
                  className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                  title="TGTBT: Statistical Outlier (z-score >2σ)"
                >
                  TGTBT-O
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{tester.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Community Score</p>
            <p className="font-semibold">{tester.communityScore.toFixed(1)}</p>
          </div>
          {selection.sentimentGrade && (
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg border text-lg font-bold ${gradeColors[selection.sentimentGrade] || gradeColors.C}`}
              title={selection.sentimentNote || ""}
            >
              {selection.sentimentGrade}
            </div>
          )}
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              selection.status === "APPROVED"
                ? "bg-success/10 text-success"
                : selection.status === "REJECTED"
                  ? "bg-destructive/10 text-destructive"
                  : selection.status === "CONSIDER"
                    ? "bg-warning/10 text-warning"
                    : "bg-muted text-muted-foreground"
            }`}
          >
            {selection.status}
          </span>
        </div>
      </div>

      {/* "Why" response */}
      {whyResponse && (
        <div className="border-b border-border bg-accent/30 p-4">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {whyResponse.surveyQuestion.questionText}
          </p>
          <p className="text-sm italic">
            &ldquo;{whyResponse.responseValue}&rdquo;
          </p>
          {selection.sentimentNote && (
            <p className="mt-1 text-xs text-muted-foreground">
              {selection.sentimentNote}
            </p>
          )}
        </div>
      )}

      {/* Survey responses */}
      <div className="max-h-64 overflow-y-auto p-4">
        <div className="space-y-1">
          {tester.surveyResponses
            .filter((r) => r.surveyQuestionId !== whyResponse?.surveyQuestionId)
            .map((response) => (
              <div
                key={response.surveyQuestionId}
                className={`flex items-center justify-between rounded px-2 py-1 text-sm ${getResponseColor(response)}`}
              >
                <span className="flex-1 truncate text-muted-foreground">
                  {response.surveyQuestion.questionText}
                </span>
                <span className="ml-4 font-medium">
                  {response.responseValue || "-"}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-border p-4">
        <div className="flex gap-2">
          <button
            onClick={() => onStatusChange(tester.id, "APPROVED")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              selection.status === "APPROVED"
                ? "bg-success text-white"
                : "border border-success text-success hover:bg-success/10"
            }`}
          >
            Approve
          </button>
          <button
            onClick={() => onStatusChange(tester.id, "REJECTED")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              selection.status === "REJECTED"
                ? "bg-destructive text-white"
                : "border border-destructive text-destructive hover:bg-destructive/10"
            }`}
          >
            Reject
          </button>
          <button
            onClick={() => onStatusChange(tester.id, "CONSIDER")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              selection.status === "CONSIDER"
                ? "bg-warning text-white"
                : "border border-warning text-warning hover:bg-warning/10"
            }`}
          >
            Consider
          </button>
        </div>

        <input
          placeholder="Review notes..."
          defaultValue={selection.reviewNotes || ""}
          onBlur={(e) => onNotesChange(tester.id, e.target.value)}
          className="w-48 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
      </div>
    </div>
  );
}
