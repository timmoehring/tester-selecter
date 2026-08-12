import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./claude-client", () => ({
  screenBatchResponses: vi.fn(),
  analyzeSentiment: vi.fn(),
  batchAnalyzeSentiment: vi.fn(),
}));

import {
  detectFakeNames,
  detectLowEffort,
  detectDuplicatePatterns,
  runScreening,
  resetCircuitBreaker,
  type TesterInput,
} from "./screening";
import { screenBatchResponses } from "./claude-client";

const mockedScreenBatch = vi.mocked(screenBatchResponses);

function makeTester(overrides: Partial<TesterInput> = {}): TesterInput {
  return {
    id: overrides.id ?? "t1",
    username: overrides.username ?? "normaluser",
    email: overrides.email ?? "user@gmail.com",
    responses: overrides.responses ?? [],
  };
}

describe("detectFakeNames", () => {
  it("flags single-character username", () => {
    const results = detectFakeNames([makeTester({ username: "x" })]);
    expect(results).toHaveLength(1);
    expect(results[0].flags[0].flag).toBe("FAKE_NAME");
    expect(results[0].flags[0].reason).toContain("1 character");
  });

  it("flags keyboard mash", () => {
    const results = detectFakeNames([makeTester({ username: "asdfghjk" })]);
    expect(results).toHaveLength(1);
    expect(results[0].flags[0].reason).toContain("keyboard mash");
  });

  it("flags placeholder names", () => {
    const names = ["test", "Test User", "demo", "n/a", "xxx"];
    for (const name of names) {
      const results = detectFakeNames([makeTester({ username: name })]);
      expect(results.length).toBeGreaterThanOrEqual(1);
      const hasFlag = results.some((r) =>
        r.flags.some((f) => f.flag === "FAKE_NAME")
      );
      expect(hasFlag).toBe(true);
    }
  });

  it("flags all-same-character names", () => {
    const results = detectFakeNames([makeTester({ username: "aaaa" })]);
    expect(results).toHaveLength(1);
    expect(results[0].flags[0].reason).toContain("repeated character");
  });

  it("flags no-vowel names (length > 3)", () => {
    const results = detectFakeNames([makeTester({ username: "brtfg" })]);
    expect(results).toHaveLength(1);
    expect(results[0].flags[0].reason).toContain("no vowels");
  });

  it("does not flag normal names", () => {
    const results = detectFakeNames([
      makeTester({ username: "Sarah Connor" }),
      makeTester({ id: "t2", username: "john_smith" }),
      makeTester({ id: "t3", username: "María García" }),
    ]);
    expect(results).toHaveLength(0);
  });

  it("does not flag short names with vowels", () => {
    const results = detectFakeNames([makeTester({ username: "Joe" })]);
    expect(results).toHaveLength(0);
  });
});

describe("detectLowEffort", () => {
  it("flags very short open-text responses", () => {
    const tester = makeTester({
      responses: [
        { questionText: "Why do you want to test?", questionType: "text", value: "idk" },
      ],
    });
    const results = detectLowEffort([tester]);
    expect(results).toHaveLength(1);
    expect(results[0].flags[0].flag).toBe("LOW_EFFORT");
    expect(results[0].flags[0].reason).toContain("short response");
  });

  it("flags single-word responses to open questions", () => {
    const tester = makeTester({
      responses: [
        { questionText: "Describe your experience", questionType: "text", value: "good" },
      ],
    });
    const results = detectLowEffort([tester]);
    expect(results).toHaveLength(1);
  });

  it("flags repeating character patterns", () => {
    const tester = makeTester({
      responses: [
        { questionText: "Tell us more", questionType: "text", value: "hahahahahahaha" },
      ],
    });
    const results = detectLowEffort([tester]);
    expect(results).toHaveLength(1);
    expect(results[0].flags[0].reason).toContain("Repeating");
  });

  it("ignores non-text question types", () => {
    const tester = makeTester({
      responses: [
        { questionText: "OS?", questionType: "choice", value: "Yes" },
      ],
    });
    const results = detectLowEffort([tester]);
    expect(results).toHaveLength(0);
  });

  it("does not flag reasonable responses", () => {
    const tester = makeTester({
      responses: [
        {
          questionText: "Why do you want to test?",
          questionType: "text",
          value: "I have been a beta tester for several years and enjoy providing detailed feedback",
        },
      ],
    });
    const results = detectLowEffort([tester]);
    expect(results).toHaveLength(0);
  });
});

describe("detectDuplicatePatterns", () => {
  it("flags near-identical usernames (with numeric suffixes)", () => {
    const testers = [
      makeTester({ id: "t1", username: "botuser1" }),
      makeTester({ id: "t2", username: "botuser2" }),
    ];
    const results = detectDuplicatePatterns(testers);
    expect(results.length).toBeGreaterThanOrEqual(1);
    const allFlags = results.flatMap((r) => r.flags);
    expect(allFlags.some((f) => f.flag === "DUPLICATE_PATTERN")).toBe(true);
  });

  it("flags identical free-text responses across testers", () => {
    const sharedResponse = "I am very excited to test this product and provide feedback";
    const testers = [
      makeTester({
        id: "t1",
        username: "alice",
        responses: [{ questionText: "Why?", questionType: "text", value: sharedResponse }],
      }),
      makeTester({
        id: "t2",
        username: "bob",
        responses: [{ questionText: "Why?", questionType: "text", value: sharedResponse }],
      }),
    ];
    const results = detectDuplicatePatterns(testers);
    expect(results.length).toBe(2);
    expect(results[0].flags[0].reason).toContain("Identical response");
  });

  it("flags uncommon shared email domains (3+)", () => {
    const testers = [
      makeTester({ id: "t1", username: "alice", email: "a@fakecorp.biz" }),
      makeTester({ id: "t2", username: "robert", email: "b@fakecorp.biz" }),
      makeTester({ id: "t3", username: "charlie", email: "c@fakecorp.biz" }),
    ];
    const results = detectDuplicatePatterns(testers);
    expect(results.length).toBe(3);
    const domainFlags = results.flatMap((r) =>
      r.flags.filter((f) => f.reason.includes("@fakecorp.biz"))
    );
    expect(domainFlags.length).toBe(3);
  });

  it("does not flag common email domains", () => {
    const testers = [
      makeTester({ id: "t1", email: "a@gmail.com" }),
      makeTester({ id: "t2", email: "b@gmail.com" }),
      makeTester({ id: "t3", email: "c@gmail.com" }),
    ];
    const results = detectDuplicatePatterns(testers);
    const domainFlags = results.flatMap((r) =>
      r.flags.filter((f) => f.reason.includes("@gmail.com"))
    );
    expect(domainFlags).toHaveLength(0);
  });

  it("does not flag distinct usernames", () => {
    const testers = [
      makeTester({ id: "t1", username: "alice" }),
      makeTester({ id: "t2", username: "robert" }),
    ];
    const results = detectDuplicatePatterns(testers);
    const nameFlags = results.flatMap((r) =>
      r.flags.filter((f) => f.reason.includes("Username similar"))
    );
    expect(nameFlags).toHaveLength(0);
  });
});

describe("runScreening", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetCircuitBreaker();
  });

  it("merges flags from all tiers", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";

    // Mock Claude to flag a tester
    mockedScreenBatch.mockResolvedValue(
      new Map([
        ["t1", { flagged: true, reason: "Generic template response" }],
      ])
    );

    const testers = [
      makeTester({
        id: "t1",
        username: "asdfgh",
        responses: [
          {
            questionText: "Why test?",
            questionType: "text",
            value: "I would love to help test this amazing product for your company",
          },
        ],
      }),
    ];

    const results = await runScreening(testers);
    expect(results).toHaveLength(1);
    expect(results[0].testerId).toBe("t1");

    const flagTypes = results[0].flags.map((f) => f.flag);
    expect(flagTypes).toContain("FAKE_NAME");
    expect(flagTypes).toContain("GENERIC_RESPONSE");

    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("works without Claude API key", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const testers = [makeTester({ username: "qwerty123" })];
    const results = await runScreening(testers);

    expect(results).toHaveLength(1);
    expect(results[0].flags[0].flag).toBe("FAKE_NAME");
    expect(mockedScreenBatch).not.toHaveBeenCalled();

    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("returns empty for clean testers", async () => {
    mockedScreenBatch.mockResolvedValue(new Map());

    const testers = [
      makeTester({
        id: "t1",
        username: "Sarah Connor",
        email: "sarah@gmail.com",
        responses: [
          {
            questionText: "Why test?",
            questionType: "text",
            value: "I have been beta testing software for five years and enjoy finding edge cases",
          },
        ],
      }),
    ];

    const results = await runScreening(testers);
    expect(results).toHaveLength(0);
  });
});
