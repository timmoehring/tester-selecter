import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseFile, parseBlocklist, parseGoldenTickets, parseActiveTests } from "./csv-parser";

function makeCSVBuffer(headers: string[], rows: string[][]): Buffer {
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "csv" });
  return Buffer.from(buf);
}

describe("parseFile", () => {
  it("parses valid CSV with headers and rows", () => {
    const buffer = makeCSVBuffer(
      ["Name", "OS", "Age"],
      [
        ["Alice", "Windows", "25"],
        ["Bob", "Mac", "30"],
      ]
    );
    const result = parseFile(buffer, "test.csv");

    expect(result.headers).toEqual(["Name", "OS", "Age"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]["Name"]).toBe("Alice");
    expect(result.rows[1]["OS"]).toBe("Mac");
  });

  it("trims whitespace from values", () => {
    const buffer = makeCSVBuffer(
      ["Name"],
      [["  Alice  "]]
    );
    const result = parseFile(buffer, "test.csv");
    expect(result.rows[0]["Name"]).toBe("Alice");
  });

  it("detects options for columns with <=50 unique values", () => {
    const rows = Array.from({ length: 5 }, (_, i) => [
      i % 2 === 0 ? "Windows" : "Mac",
    ]);
    const buffer = makeCSVBuffer(["OS"], rows);
    const result = parseFile(buffer, "test.csv");

    expect(result.detectedOptions["OS"]).toBeDefined();
    expect(result.detectedOptions["OS"]).toContain("Mac");
    expect(result.detectedOptions["OS"]).toContain("Windows");
  });

  it("does not detect options for columns with >50 unique values", () => {
    const rows = Array.from({ length: 51 }, (_, i) => [`value_${i}`]);
    const buffer = makeCSVBuffer(["ID"], rows);
    const result = parseFile(buffer, "test.csv");

    expect(result.detectedOptions["ID"]).toBeUndefined();
  });

  it("throws on empty file", () => {
    const ws = XLSX.utils.aoa_to_sheet([]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "csv" }));

    expect(() => parseFile(buf, "empty.csv")).toThrow();
  });

  it("throws on header-only file", () => {
    const buffer = makeCSVBuffer(["Name", "OS"], []);
    expect(() => parseFile(buffer, "headers.csv")).toThrow(
      "File must contain a header row and at least one data row"
    );
  });
});

describe("parseBlocklist", () => {
  it("recognizes email column variants", () => {
    const buffer = makeCSVBuffer(["Email", "Reason"], [["bad@test.com", "spam"]]);
    const result = parseBlocklist(buffer, "blocklist.csv");
    expect(result[0].email).toBe("bad@test.com");
  });

  it("recognizes username column variants", () => {
    const buffer = makeCSVBuffer(["Username"], [["baduser"]]);
    const result = parseBlocklist(buffer, "blocklist.csv");
    expect(result[0].username).toBe("baduser");
  });

  it("handles missing columns gracefully", () => {
    const buffer = makeCSVBuffer(["Other"], [["value"]]);
    const result = parseBlocklist(buffer, "blocklist.csv");
    expect(result[0].email).toBeUndefined();
    expect(result[0].username).toBeUndefined();
  });
});

describe("parseGoldenTickets", () => {
  it("parses email and priority", () => {
    const buffer = makeCSVBuffer(
      ["Email", "priority"],
      [["vip@test.com", "3"]]
    );
    const result = parseGoldenTickets(buffer, "gt.csv");
    expect(result[0].email).toBe("vip@test.com");
    expect(result[0].priorityLevel).toBe(3);
  });

  it("defaults priority to 1 when missing", () => {
    const buffer = makeCSVBuffer(["Email"], [["vip@test.com"]]);
    const result = parseGoldenTickets(buffer, "gt.csv");
    expect(result[0].priorityLevel).toBe(1);
  });
});

describe("parseActiveTests", () => {
  it("parses email and test_name columns", () => {
    const buffer = makeCSVBuffer(
      ["Email", "test_name"],
      [["alice@test.com", "Beta Test 1"]]
    );
    const result = parseActiveTests(buffer, "active.csv");
    expect(result[0].email).toBe("alice@test.com");
    expect(result[0].testName).toBe("Beta Test 1");
  });

  it("handles missing optional columns", () => {
    const buffer = makeCSVBuffer(["Email"], [["alice@test.com"]]);
    const result = parseActiveTests(buffer, "active.csv");
    expect(result[0].email).toBe("alice@test.com");
    expect(result[0].username).toBeUndefined();
    expect(result[0].testName).toBeUndefined();
  });
});
