import { describe, it, expect } from "vitest";
import {
  meetsRequirement,
  preFilter,
  scoreTester,
  preRank,
  prepareTesterData,
  TesterData,
  DEFAULT_WEIGHTS,
} from "./constraints";

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

describe("meetsRequirement", () => {
  it("returns true for exact match", () => {
    expect(meetsRequirement("Windows", ["Windows", "Mac"])).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(meetsRequirement("windows", ["Windows", "Mac"])).toBe(true);
  });

  it("trims whitespace", () => {
    expect(meetsRequirement("  Windows  ", ["Windows"])).toBe(true);
  });

  it("returns true for empty acceptedValues (always pass)", () => {
    expect(meetsRequirement("anything", [])).toBe(true);
  });

  it("returns false for no match", () => {
    expect(meetsRequirement("Linux", ["Windows", "Mac"])).toBe(false);
  });
});

describe("preFilter", () => {
  it("removes blocklisted testers", () => {
    const testers = [
      makeTester({ id: "t1", isBlocklisted: true }),
      makeTester({ id: "t2", isBlocklisted: false }),
    ];
    const result = preFilter(testers);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t2");
  });

  it("removes testers who fail hard requirements", () => {
    const testers = [
      makeTester({ id: "t1", hardRequirementsMet: false }),
      makeTester({ id: "t2", hardRequirementsMet: true }),
    ];
    const result = preFilter(testers);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t2");
  });

  it("keeps eligible testers", () => {
    const testers = [
      makeTester({ id: "t1" }),
      makeTester({ id: "t2" }),
    ];
    const result = preFilter(testers);
    expect(result).toHaveLength(2);
  });
});

describe("scoreTester", () => {
  const weights = DEFAULT_WEIGHTS;

  it("includes community score", () => {
    const score = scoreTester(makeTester({ communityScore: 0.8 }), weights);
    expect(score).toBeCloseTo(0.8 * weights.communityScore, 5);
  });

  it("adds golden ticket bonus", () => {
    const base = scoreTester(makeTester(), weights);
    const gt = scoreTester(
      makeTester({ isGoldenTicket: true, goldenTicketPriority: 2 }),
      weights
    );
    expect(gt).toBe(base + 2 * weights.goldenTicket);
  });

  it("applies active test penalty", () => {
    const base = scoreTester(makeTester(), weights);
    const active = scoreTester(makeTester({ activeTestCount: 2 }), weights);
    expect(active).toBe(base - 2 * weights.activeTestPenalty);
  });

  it("applies TGTBT extreme penalty", () => {
    const base = scoreTester(makeTester(), weights);
    const extreme = scoreTester(makeTester({ tgtbtExtreme: true }), weights);
    expect(extreme).toBe(base - weights.tgtbtPenalty);
  });

  it("applies TGTBT outlier penalty (half weight)", () => {
    const base = scoreTester(makeTester(), weights);
    const outlier = scoreTester(makeTester({ tgtbtOutlier: true }), weights);
    expect(outlier).toBe(base - weights.tgtbtPenalty * 0.5);
  });

  it("includes soft requirement score", () => {
    const base = scoreTester(makeTester(), weights);
    const soft = scoreTester(makeTester({ softRequirementScore: 3 }), weights);
    expect(soft).toBe(base + 3 * weights.softRequirement);
  });

  it("combines all factors", () => {
    const tester = makeTester({
      communityScore: 1.0,
      isGoldenTicket: true,
      goldenTicketPriority: 1,
      activeTestCount: 1,
      tgtbtExtreme: true,
      tgtbtOutlier: true,
      softRequirementScore: 2,
    });
    const score = scoreTester(tester, weights);
    const expected =
      1.0 * weights.communityScore +
      1 * weights.goldenTicket -
      1 * weights.activeTestPenalty -
      weights.tgtbtPenalty -
      weights.tgtbtPenalty * 0.5 +
      2 * weights.softRequirement;
    expect(score).toBeCloseTo(expected, 5);
  });
});

describe("preRank", () => {
  it("returns all testers if under limit", () => {
    const testers = [makeTester({ id: "t1" }), makeTester({ id: "t2" })];
    const result = preRank(testers, 10, DEFAULT_WEIGHTS);
    expect(result).toHaveLength(2);
  });

  it("trims to 3x target by score", () => {
    const testers = Array.from({ length: 10 }, (_, i) =>
      makeTester({ id: `t${i}`, communityScore: i / 10 })
    );
    // target=2 → limit=6, so top 6 by score
    const result = preRank(testers, 2, DEFAULT_WEIGHTS);
    expect(result).toHaveLength(6);
    // highest scores should be included
    expect(result.map((t) => t.id)).toContain("t9");
    expect(result.map((t) => t.id)).toContain("t8");
  });

  it("preserves score-based sort order", () => {
    const testers = Array.from({ length: 10 }, (_, i) =>
      makeTester({ id: `t${i}`, communityScore: i / 10 })
    );
    const result = preRank(testers, 2, DEFAULT_WEIGHTS);
    // First result should have highest score
    expect(result[0].id).toBe("t9");
    expect(result[1].id).toBe("t8");
  });
});

describe("prepareTesterData", () => {
  const applicants = [
    {
      id: "a1",
      email: "alice@test.com",
      username: "alice",
      communityScore: 0.9,
      tgtbtExtreme: false,
      tgtbtOutlier: false,
      surveyResponses: [
        { surveyQuestionId: "q1", responseValue: "Windows" },
        { surveyQuestionId: "q2", responseValue: "18-25" },
      ],
    },
    {
      id: "a2",
      email: "bob@test.com",
      username: "bob",
      communityScore: 0.5,
      tgtbtExtreme: true,
      tgtbtOutlier: false,
      surveyResponses: [
        { surveyQuestionId: "q1", responseValue: "Mac" },
        { surveyQuestionId: "q2", responseValue: "26-35" },
      ],
    },
  ];

  it("flags blocklisted testers by email", () => {
    const result = prepareTesterData(
      applicants,
      [],
      [],
      [],
      new Set(["alice@test.com"]),
      new Set(),
      new Map(),
      new Set()
    );
    expect(result[0].isBlocklisted).toBe(true);
    expect(result[1].isBlocklisted).toBe(false);
  });

  it("flags blocklisted testers by username", () => {
    const result = prepareTesterData(
      applicants,
      [],
      [],
      [],
      new Set(),
      new Set(["bob"]),
      new Map(),
      new Set()
    );
    expect(result[1].isBlocklisted).toBe(true);
  });

  it("identifies golden tickets by email", () => {
    const result = prepareTesterData(
      applicants,
      [],
      [],
      [],
      new Set(),
      new Set(),
      new Map([["alice@test.com", 2]]),
      new Set()
    );
    expect(result[0].isGoldenTicket).toBe(true);
    expect(result[0].goldenTicketPriority).toBe(2);
    expect(result[1].isGoldenTicket).toBe(false);
  });

  it("identifies golden tickets by username", () => {
    const result = prepareTesterData(
      applicants,
      [],
      [],
      [],
      new Set(),
      new Set(),
      new Map([["bob", 3]]),
      new Set()
    );
    expect(result[1].isGoldenTicket).toBe(true);
    expect(result[1].goldenTicketPriority).toBe(3);
  });

  it("evaluates hard requirements via question mappings", () => {
    const hardReqs = [
      {
        id: "r1",
        acceptedValues: ["Windows"],
        questionMappings: [{ surveyQuestionId: "q1" }],
      },
    ];
    const result = prepareTesterData(
      applicants,
      hardReqs,
      [],
      [],
      new Set(),
      new Set(),
      new Map(),
      new Set()
    );
    expect(result[0].hardRequirementsMet).toBe(true); // alice: Windows
    expect(result[1].hardRequirementsMet).toBe(false); // bob: Mac
  });

  it("computes soft requirement scores", () => {
    const softReqs = [
      {
        id: "s1",
        acceptedValues: ["18-25"],
        weight: 2,
        questionMappings: [{ surveyQuestionId: "q2" }],
      },
    ];
    const result = prepareTesterData(
      applicants,
      [],
      softReqs,
      [],
      new Set(),
      new Set(),
      new Map(),
      new Set()
    );
    expect(result[0].softRequirementScore).toBe(2); // alice: 18-25 matches
    expect(result[1].softRequirementScore).toBe(0); // bob: 26-35 no match
  });

  it("extracts segmentation values", () => {
    const segs = [
      { id: "seg1", questionMappings: [{ surveyQuestionId: "q2" }] },
    ];
    const result = prepareTesterData(
      applicants,
      [],
      [],
      segs,
      new Set(),
      new Set(),
      new Map(),
      new Set()
    );
    expect(result[0].segmentValues["seg1"]).toBe("18-25");
    expect(result[1].segmentValues["seg1"]).toBe("26-35");
  });

  it("tracks active test count", () => {
    const result = prepareTesterData(
      applicants,
      [],
      [],
      [],
      new Set(),
      new Set(),
      new Map(),
      new Set(["alice@test.com"])
    );
    expect(result[0].activeTestCount).toBe(1);
    expect(result[1].activeTestCount).toBe(0);
  });
});
