import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under limit", () => {
    const result = rateLimit("test-user", 5, 60000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("decrements remaining on each request", () => {
    const r1 = rateLimit("decrement-test", 3, 60000);
    expect(r1.remaining).toBe(2);

    const r2 = rateLimit("decrement-test", 3, 60000);
    expect(r2.remaining).toBe(1);

    const r3 = rateLimit("decrement-test", 3, 60000);
    expect(r3.remaining).toBe(0);
  });

  it("blocks at limit", () => {
    // Use up all requests
    rateLimit("blocked-user", 2, 60000);
    rateLimit("blocked-user", 2, 60000);

    const result = rateLimit("blocked-user", 2, 60000);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after window expires", () => {
    rateLimit("reset-user", 1, 10000);

    // At limit
    const blocked = rateLimit("reset-user", 1, 10000);
    expect(blocked.success).toBe(false);

    // Advance past window
    vi.advanceTimersByTime(11000);

    const reset = rateLimit("reset-user", 1, 10000);
    expect(reset.success).toBe(true);
    expect(reset.remaining).toBe(0);
  });

  it("tracks different keys independently", () => {
    // Exhaust limit for user A
    rateLimit("user-a", 1, 60000);
    const blockedA = rateLimit("user-a", 1, 60000);
    expect(blockedA.success).toBe(false);

    // User B should still have access
    const resultB = rateLimit("user-b", 1, 60000);
    expect(resultB.success).toBe(true);
  });

  it("handles exact boundary — limit=3, 3rd succeeds, 4th fails", () => {
    rateLimit("boundary", 3, 60000); // 1st
    rateLimit("boundary", 3, 60000); // 2nd
    const third = rateLimit("boundary", 3, 60000); // 3rd
    expect(third.success).toBe(true);
    expect(third.remaining).toBe(0);

    const fourth = rateLimit("boundary", 3, 60000); // 4th
    expect(fourth.success).toBe(false);
    expect(fourth.remaining).toBe(0);
  });
});
