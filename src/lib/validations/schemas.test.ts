import { describe, it, expect } from "vitest";
import {
  projectCreateSchema,
  projectUpdateSchema,
  userCreateSchema,
  blocklistEntrySchema,
  goldenTicketEntrySchema,
  requirementsSaveSchema,
  mappingSaveSchema,
} from "./schemas";

describe("projectCreateSchema", () => {
  it("accepts valid data", () => {
    const result = projectCreateSchema.safeParse({
      name: "Test Project",
      description: "A test",
      targetCount: 50,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = projectCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects name too long", () => {
    const result = projectCreateSchema.safeParse({
      name: "a".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative targetCount", () => {
    const result = projectCreateSchema.safeParse({
      name: "Test",
      targetCount: -1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields omitted", () => {
    const result = projectCreateSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(true);
  });
});

describe("projectUpdateSchema", () => {
  it("accepts all optional fields", () => {
    const result = projectUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid status enum", () => {
    const result = projectUpdateSchema.safeParse({ status: "DRAFT" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = projectUpdateSchema.safeParse({ status: "INVALID" });
    expect(result.success).toBe(false);
  });
});

describe("userCreateSchema", () => {
  it("accepts valid user", () => {
    const result = userCreateSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      name: "Test User",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = userCreateSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = userCreateSchema.safeParse({
      email: "test@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("blocklistEntrySchema", () => {
  it("accepts email only", () => {
    const result = blocklistEntrySchema.safeParse({
      email: "bad@test.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts username only", () => {
    const result = blocklistEntrySchema.safeParse({
      username: "baduser",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when neither email nor username provided", () => {
    const result = blocklistEntrySchema.safeParse({
      reason: "just a reason",
    });
    expect(result.success).toBe(false);
  });
});

describe("goldenTicketEntrySchema", () => {
  it("accepts valid entry with priority", () => {
    const result = goldenTicketEntrySchema.safeParse({
      email: "vip@test.com",
      priorityLevel: 2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects priority > 3", () => {
    const result = goldenTicketEntrySchema.safeParse({
      email: "vip@test.com",
      priorityLevel: 5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects priority < 1", () => {
    const result = goldenTicketEntrySchema.safeParse({
      email: "vip@test.com",
      priorityLevel: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("requirementsSaveSchema", () => {
  it("accepts nested requirements and segmentations", () => {
    const result = requirementsSaveSchema.safeParse({
      requirements: [
        { name: "OS", type: "HARD", acceptedValues: ["Windows", "Mac"] },
        { name: "Age", type: "SOFT", acceptedValues: ["18-25"], weight: 2 },
      ],
      segmentations: [
        { name: "Gender", targetPercentages: { M: 50, F: 50 } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type enum", () => {
    const result = requirementsSaveSchema.safeParse({
      requirements: [
        { name: "OS", type: "INVALID", acceptedValues: [] },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("mappingSaveSchema", () => {
  it("accepts valid mappings", () => {
    const result = mappingSaveSchema.safeParse({
      action: "save",
      mappings: [
        { surveyQuestionId: "q1", requirementId: "r1", isConfirmed: true },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing surveyQuestionId", () => {
    const result = mappingSaveSchema.safeParse({
      action: "save",
      mappings: [
        { requirementId: "r1", isConfirmed: true },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects wrong action", () => {
    const result = mappingSaveSchema.safeParse({
      action: "delete",
      mappings: [],
    });
    expect(result.success).toBe(false);
  });
});
