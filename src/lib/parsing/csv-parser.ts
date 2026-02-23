import * as XLSX from "xlsx";

export interface ParsedSurvey {
  headers: string[];
  rows: Record<string, string>[];
  detectedOptions: Record<string, string[]>;
}

export function parseFile(buffer: Buffer, _filename: string): ParsedSurvey {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

  if (rawData.length < 2) {
    throw new Error("File must contain a header row and at least one data row");
  }

  const headers = rawData[0].map((h) => String(h).trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < rawData.length; i++) {
    const row: Record<string, string> = {};
    headers.forEach((header, j) => {
      row[header] = rawData[i]?.[j] != null ? String(rawData[i][j]).trim() : "";
    });
    rows.push(row);
  }

  // Detect options per column (for multi-choice questions)
  const detectedOptions: Record<string, string[]> = {};
  for (const header of headers) {
    const uniqueValues = new Set<string>();
    for (const row of rows) {
      const val = row[header];
      if (val) uniqueValues.add(val);
    }
    // Only track as options if ≤50 unique values (likely categorical)
    if (uniqueValues.size <= 50 && uniqueValues.size > 0) {
      detectedOptions[header] = Array.from(uniqueValues).sort();
    }
  }

  return { headers, rows, detectedOptions };
}

export function parseBlocklist(
  buffer: Buffer,
  _filename: string
): { email?: string; username?: string }[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  return rawData.map((row) => {
    const email =
      row["email"] || row["Email"] || row["EMAIL"] || row["e-mail"] || undefined;
    const username =
      row["username"] || row["Username"] || row["USERNAME"] || row["user"] || undefined;
    return { email: email?.trim(), username: username?.trim() };
  });
}

export function parseGoldenTickets(
  buffer: Buffer,
  _filename: string
): { email?: string; username?: string; priorityLevel?: number }[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  return rawData.map((row) => {
    const email =
      row["email"] || row["Email"] || row["EMAIL"] || undefined;
    const username =
      row["username"] || row["Username"] || row["USERNAME"] || undefined;
    const priority =
      row["priority"] || row["Priority"] || row["priority_level"] || "1";
    return {
      email: email?.trim(),
      username: username?.trim(),
      priorityLevel: parseInt(priority) || 1,
    };
  });
}

export function parseActiveTests(
  buffer: Buffer,
  _filename: string
): { email: string; username?: string; testName?: string }[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  return rawData.map((row) => {
    const email = row["email"] || row["Email"] || row["EMAIL"] || "";
    const username =
      row["username"] || row["Username"] || row["USERNAME"] || undefined;
    const testName =
      row["test_name"] || row["Test Name"] || row["test"] || undefined;
    return {
      email: email.trim(),
      username: username?.trim(),
      testName: testName?.trim(),
    };
  });
}
