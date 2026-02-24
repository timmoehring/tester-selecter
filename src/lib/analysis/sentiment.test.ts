import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the claude-client module before importing sentiment
vi.mock("./claude-client", () => ({
  analyzeSentiment: vi.fn(),
  batchAnalyzeSentiment: vi.fn(),
}));

// Must import after vi.mock
import { analyzeSentiment, batchAnalyzeSentiment } from "./sentiment";
import {
  analyzeSentiment as mockClaudeAnalyze,
  batchAnalyzeSentiment as mockClaudeBatch,
} from "./claude-client";

const mockedClaudeAnalyze = vi.mocked(mockClaudeAnalyze);
const mockedClaudeBatch = vi.mocked(mockClaudeBatch);

describe("analyzeSentiment", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    // Reset circuit breaker state by re-importing fresh module
    // Since we can't easily reset module state, we'll work with what we have
  });

  it("returns grade C for short text (<5 chars)", async () => {
    const result = await analyzeSentiment("Hi");
    expect(result.grade).toBe("C");
    expect(result.justification).toContain("too short");
  });

  it("returns grade C for empty text", async () => {
    const result = await analyzeSentiment("");
    expect(result.grade).toBe("C");
  });

  it("uses local fallback when no API key", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const result = await analyzeSentiment("This product is absolutely wonderful and amazing!");
    expect(result.grade).toBeDefined();
    expect(result.justification).toContain("Local analysis");

    // Restore
    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("local fallback maps positive text to high grade", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const result = await analyzeSentiment(
      "This is absolutely wonderful, amazing, fantastic, great, excellent!"
    );
    expect(["A", "B"]).toContain(result.grade);

    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("local fallback maps negative text to low grade", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const result = await analyzeSentiment(
      "This is terrible, awful, horrible, disgusting, worst experience ever"
    );
    expect(["D", "F"]).toContain(result.grade);

    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("uses Claude when API key is set", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";

    mockedClaudeAnalyze.mockResolvedValueOnce({
      grade: "A",
      justification: "Very positive sentiment",
    });

    const result = await analyzeSentiment("Great product!");
    expect(result.grade).toBe("A");
    expect(mockedClaudeAnalyze).toHaveBeenCalledWith("Great product!", undefined);

    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("falls back to local on Claude failure", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";

    mockedClaudeAnalyze.mockRejectedValueOnce(new Error("API error"));

    const result = await analyzeSentiment("This is a great product, really wonderful!");
    expect(result.justification).toContain("Local analysis");

    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("local fallback maps neutral text to grade C", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const result = await analyzeSentiment(
      "The item is on the table in the room near the window"
    );
    expect(result.grade).toBe("C");

    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });
});

describe("batchAnalyzeSentiment", () => {
  it("processes all items with local fallback and returns a Map", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const items = [
      { id: "1", text: "This is great and wonderful!" },
      { id: "2", text: "This is terrible and awful!" },
    ];

    const results = await batchAnalyzeSentiment(items);

    expect(results).toBeInstanceOf(Map);
    expect(results.size).toBe(2);
    expect(results.get("1")).toBeDefined();
    expect(results.get("2")).toBeDefined();

    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("uses Claude for batch when API key is set", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";

    const mockResults = new Map([
      ["1", { grade: "A", justification: "Positive" }],
      ["2", { grade: "D", justification: "Negative" }],
    ]);
    mockedClaudeBatch.mockResolvedValueOnce(mockResults);

    const items = [
      { id: "1", text: "Great product!" },
      { id: "2", text: "Terrible product!" },
    ];
    const results = await batchAnalyzeSentiment(items);

    expect(results.size).toBe(2);
    expect(results.get("1")?.grade).toBe("A");
    expect(mockedClaudeBatch).toHaveBeenCalled();

    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("falls back to local on Claude batch failure", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";

    mockedClaudeBatch.mockRejectedValueOnce(new Error("Batch API error"));

    const items = [
      { id: "1", text: "This is a wonderful amazing great product!" },
    ];
    const results = await batchAnalyzeSentiment(items);

    expect(results.size).toBe(1);
    expect(results.get("1")?.justification).toContain("Local analysis");

    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });
});
