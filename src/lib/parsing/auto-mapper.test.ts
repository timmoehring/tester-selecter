import { describe, it, expect } from "vitest";
import { autoMap } from "./auto-mapper";

describe("autoMap", () => {
  it("maps exact name match with high confidence", () => {
    const questions = [{ id: "q1", questionText: "Gender" }];
    const targets = [{ id: "r1", name: "Gender", type: "requirement" as const }];

    const results = autoMap(questions, targets);

    expect(results).toHaveLength(1);
    expect(results[0].targetId).toBe("r1");
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("maps substring match", () => {
    const questions = [
      { id: "q1", questionText: "What is your operating system?" },
    ];
    const targets = [
      { id: "r1", name: "Operating System", type: "requirement" as const },
    ];

    const results = autoMap(questions, targets);

    expect(results).toHaveLength(1);
    expect(results[0].targetId).toBe("r1");
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.3);
  });

  it("maps keyword overlap", () => {
    const questions = [{ id: "q1", questionText: "What age group do you belong to?" }];
    const targets = [
      {
        id: "r1",
        name: "Age Group",
        type: "requirement" as const,
      },
    ];

    const results = autoMap(questions, targets);

    expect(results).toHaveLength(1);
    expect(results[0].targetId).toBe("r1");
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.3);
  });

  it("returns no mapping when below threshold", () => {
    const questions = [{ id: "q1", questionText: "What is your favorite color?" }];
    const targets = [
      { id: "r1", name: "Operating System", type: "requirement" as const },
    ];

    const results = autoMap(questions, targets);

    expect(results).toHaveLength(0);
  });

  it("picks the best match when multiple targets could match", () => {
    const questions = [{ id: "q1", questionText: "Operating System" }];
    const targets = [
      { id: "r1", name: "Country", type: "requirement" as const },
      { id: "r2", name: "Operating System", type: "requirement" as const },
      { id: "r3", name: "Browser", type: "requirement" as const },
    ];

    const results = autoMap(questions, targets);

    expect(results).toHaveLength(1);
    expect(results[0].targetId).toBe("r2");
  });

  it("matches both requirement and segmentation types", () => {
    const questions = [
      { id: "q1", questionText: "Gender" },
      { id: "q2", questionText: "Operating System" },
    ];
    const targets = [
      { id: "r1", name: "Gender", type: "segmentation" as const },
      { id: "r2", name: "Operating System", type: "requirement" as const },
    ];

    const results = autoMap(questions, targets);

    expect(results).toHaveLength(2);
    const genderResult = results.find((r) => r.surveyQuestionId === "q1");
    const osResult = results.find((r) => r.surveyQuestionId === "q2");
    expect(genderResult?.targetType).toBe("segmentation");
    expect(osResult?.targetType).toBe("requirement");
  });
});
