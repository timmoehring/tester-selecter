export interface ExportRow {
  username: string;
  email: string;
  status: string;
  sentimentGrade?: string;
  communityScore: number;
  rank?: number;
}

export type ExportColumns = "username_only" | "email_only" | "both" | "full";

export function generateCSV(
  rows: ExportRow[],
  columns: ExportColumns
): string {
  const lines: string[] = [];

  // Header
  const headers: string[] = [];
  if (columns === "both" || columns === "full" || columns === "username_only") {
    headers.push("username");
  }
  if (columns === "both" || columns === "full" || columns === "email_only") {
    headers.push("email");
  }
  if (columns === "full") {
    headers.push("status", "sentiment_grade", "community_score", "rank");
  }
  lines.push(headers.join(","));

  // Data
  for (const row of rows) {
    const values: string[] = [];
    if (columns === "both" || columns === "full" || columns === "username_only") {
      values.push(escapeCSV(row.username));
    }
    if (columns === "both" || columns === "full" || columns === "email_only") {
      values.push(escapeCSV(row.email));
    }
    if (columns === "full") {
      values.push(
        escapeCSV(row.status),
        escapeCSV(row.sentimentGrade || ""),
        String(row.communityScore),
        String(row.rank || "")
      );
    }
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
