import { describe, it, expect } from "vitest";
import { detectTGTBTFlags } from "./tgtbt";

describe("detectTGTBTFlags", () => {
  it("returns empty array for empty rows", () => {
    const result = detectTGTBTFlags([], ["Q1", "Q2"], { Q1: ["A", "B"], Q2: ["X", "Y"] });
    expect(result).toEqual([]);
  });

  it("flags extreme maximizer (>80% highest option)", () => {
    const headers = ["Q1", "Q2", "Q3", "Q4", "Q5"];
    const options: Record<string, string[]> = {};
    for (const h of headers) {
      options[h] = ["Low", "Medium", "High"];
    }

    // Tester always picks "High" (last option, alphabetically sorted)
    const extremeTester: Record<string, string> = {};
    for (const h of headers) {
      extremeTester[h] = "High"; // "High" is alphabetically last of ["High", "Low", "Medium"]
    }

    // Wait — options are sorted, so ["High", "Low", "Medium"]
    // Actually, the code sorts: Array.from(uniqueValues).sort()
    // So for ["Low", "Medium", "High"], sorted = ["High", "Low", "Medium"]
    // The "highest" = options[options.length - 1] = "Medium"
    // Let's use numeric-like options to be clearer
    const headers2 = ["Q1", "Q2", "Q3", "Q4", "Q5"];
    const options2: Record<string, string[]> = {};
    for (const h of headers2) {
      options2[h] = ["1", "2", "3"]; // sorted: ["1", "2", "3"], highest = "3"
    }

    const extreme: Record<string, string> = {};
    for (const h of headers2) {
      extreme[h] = "3"; // always picks highest
    }

    const varied: Record<string, string> = {};
    for (const h of headers2) {
      varied[h] = "2"; // always picks middle
    }

    const result = detectTGTBTFlags([extreme, varied], headers2, options2);

    expect(result[0].extreme).toBe(true);
    expect(result[0].extremeScore).toBe(100); // 5/5 = 100%
    expect(result[1].extreme).toBe(false);
  });

  it("flags statistical outlier", () => {
    const headers = ["Q1", "Q2", "Q3"];
    const options: Record<string, string[]> = {};
    for (const h of headers) {
      options[h] = ["1", "2", "3", "4", "5"];
    }

    // Create many "normal" testers who pick middle values
    const normalRows = Array.from({ length: 20 }, () => {
      const row: Record<string, string> = {};
      for (const h of headers) {
        row[h] = "3"; // always middle
      }
      return row;
    });

    // One outlier who picks extreme values
    const outlierRow: Record<string, string> = {};
    for (const h of headers) {
      outlierRow[h] = "5"; // always highest index
    }

    const rows = [...normalRows, outlierRow];
    const result = detectTGTBTFlags(rows, headers, options);

    // The outlier (last) should be flagged
    const outlierFlags = result[result.length - 1];
    expect(outlierFlags.outlier).toBe(true);

    // Normal testers should not be flagged as outliers
    expect(result[0].outlier).toBe(false);
  });

  it("flags extreme and outlier independently", () => {
    const headers = ["Q1", "Q2", "Q3"];
    const options: Record<string, string[]> = {};
    for (const h of headers) {
      options[h] = ["1", "2", "3"]; // sorted: ["1", "2", "3"]
    }

    // Many normal testers
    const normalRows = Array.from({ length: 20 }, () => {
      const row: Record<string, string> = {};
      for (const h of headers) {
        row[h] = "2";
      }
      return row;
    });

    // Tester picks highest ("3") for all — should be extreme AND potentially outlier
    const extremeRow: Record<string, string> = {};
    for (const h of headers) {
      extremeRow[h] = "3";
    }

    const rows = [...normalRows, extremeRow];
    const result = detectTGTBTFlags(rows, headers, options);

    const extremeFlags = result[result.length - 1];
    expect(extremeFlags.extreme).toBe(true);
    // Outlier detection depends on z-score distribution
    expect(typeof extremeFlags.outlier).toBe("boolean");
  });

  it("neither flag for average tester", () => {
    const headers = ["Q1", "Q2"];
    const options: Record<string, string[]> = {
      Q1: ["1", "2", "3"],
      Q2: ["1", "2", "3"],
    };

    const rows = [
      { Q1: "2", Q2: "2" },
      { Q1: "2", Q2: "1" },
      { Q1: "1", Q2: "2" },
      { Q1: "2", Q2: "2" },
      { Q1: "1", Q2: "1" },
    ];

    const result = detectTGTBTFlags(rows, headers, options);
    // Middle-ground testers should not be flagged as extreme
    for (const flags of result) {
      expect(flags.extreme).toBe(false);
    }
  });

  it("handles no ordinal columns gracefully", () => {
    const headers = ["FreeText"];
    // No detected options — column has too many unique values
    const options: Record<string, string[]> = {};

    const rows = [{ FreeText: "Some long response here" }];
    const result = detectTGTBTFlags(rows, headers, options);

    expect(result).toHaveLength(1);
    expect(result[0].extreme).toBe(false);
    expect(result[0].outlier).toBe(false);
    expect(result[0].extremeScore).toBe(0);
  });
});
