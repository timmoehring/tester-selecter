import { describe, it, expect } from "vitest";
import { solve } from "./z3-solver";
import { TesterData, SolverConfig, DEFAULT_WEIGHTS } from "./constraints";

function makeTester(overrides: Partial<TesterData> = {}): TesterData {
  return {
    id: "t1",
    email: "test@example.com",
    username: "testuser",
    communityScore: 0.5,
    tgtbtExtreme: false,
    tgtbtOutlier: false,
    responses: {},
    isBlocklisted: false,
    isGoldenTicket: false,
    goldenTicketPriority: 0,
    activeTestCount: 0,
    hardRequirementsMet: true,
    softRequirementScore: 0,
    segmentValues: {},
    ...overrides,
  };
}

function makeConfig(overrides: Partial<SolverConfig> = {}): SolverConfig {
  return {
    targetCount: 2,
    surplusCount: 0,
    backupCount: 1,
    segmentations: [],
    weights: DEFAULT_WEIGHTS,
    ...overrides,
  };
}

describe("solve (scoring fallback)", () => {
  it("selects correct number of testers and backups", async () => {
    const testers = [
      makeTester({ id: "t1", communityScore: 0.9 }),
      makeTester({ id: "t2", communityScore: 0.7 }),
      makeTester({ id: "t3", communityScore: 0.5 }),
    ];
    const config = makeConfig({ targetCount: 2, surplusCount: 0, backupCount: 1 });

    const result = await solve(testers, config);

    expect(result.selected).toHaveLength(2);
    expect(result.backup).toHaveLength(1);
  });

  it("ranks by score — highest scores selected first", async () => {
    const testers = [
      makeTester({ id: "low", communityScore: 0.1 }),
      makeTester({ id: "high", communityScore: 0.9 }),
      makeTester({ id: "mid", communityScore: 0.5 }),
    ];
    const config = makeConfig({ targetCount: 2, surplusCount: 0, backupCount: 1 });

    const result = await solve(testers, config);

    expect(result.selected).toEqual(["high", "mid"]);
    expect(result.backup).toEqual(["low"]);
  });

  it("handles all blocklisted — empty result", async () => {
    const testers = [
      makeTester({ id: "t1", isBlocklisted: true }),
      makeTester({ id: "t2", isBlocklisted: true }),
    ];
    const config = makeConfig({ targetCount: 2, surplusCount: 0, backupCount: 0 });

    const result = await solve(testers, config);

    expect(result.selected).toHaveLength(0);
    expect(result.backup).toHaveLength(0);
  });

  it("computes demographics for segmentations", async () => {
    const testers = [
      makeTester({ id: "t1", communityScore: 0.9, segmentValues: { gender: "M" } }),
      makeTester({ id: "t2", communityScore: 0.8, segmentValues: { gender: "F" } }),
      makeTester({ id: "t3", communityScore: 0.1, segmentValues: { gender: "M" } }),
    ];
    const config = makeConfig({
      targetCount: 2,
      surplusCount: 0,
      backupCount: 1,
      segmentations: [
        {
          id: "gender",
          name: "Gender",
          targetPercentages: { M: 50, F: 50 },
          tolerance: 10,
        },
      ],
    });

    const result = await solve(testers, config);

    expect(result.demographics).toHaveProperty("gender");
    expect(result.demographics["gender"].name).toBe("Gender");
    expect(result.demographics["gender"].actual).toBeDefined();
  });

  it("ranks golden tickets higher", async () => {
    const testers = [
      makeTester({ id: "regular", communityScore: 0.8 }),
      makeTester({
        id: "golden",
        communityScore: 0.3,
        isGoldenTicket: true,
        goldenTicketPriority: 2,
      }),
      makeTester({ id: "backup", communityScore: 0.1 }),
    ];
    const config = makeConfig({ targetCount: 2, surplusCount: 0, backupCount: 1 });

    const result = await solve(testers, config);

    expect(result.selected).toContain("golden");
  });

  it("returns scores for all testers", async () => {
    const testers = [
      makeTester({ id: "t1", communityScore: 0.9 }),
      makeTester({ id: "t2", communityScore: 0.5 }),
    ];
    const config = makeConfig({ targetCount: 1, surplusCount: 0, backupCount: 1 });

    const result = await solve(testers, config);

    expect(result.scores).toHaveProperty("t1");
    expect(result.scores).toHaveProperty("t2");
    expect(result.scores["t1"]).toBeGreaterThan(result.scores["t2"]);
  });
});
