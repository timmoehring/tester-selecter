/**
 * Two-tier screening module for detecting suspicious/fake testers.
 *
 * Tier 1: Local heuristics (fast, no API, always runs)
 *   - Fake/gibberish names
 *   - Low-effort open text responses
 *   - Duplicate/bot patterns
 *
 * Tier 2: Claude API (nuanced, skipped if unavailable)
 *   - Generic/templated response detection
 */

import { screenBatchResponses } from "./claude-client";

// ── Types ──────────────────────────────────────────────────────

export type FlagType =
  | "FAKE_NAME"
  | "LOW_EFFORT"
  | "DUPLICATE_PATTERN"
  | "GENERIC_RESPONSE";

export interface ScreeningFlag {
  flag: FlagType;
  reason: string;
}

export interface ScreeningResult {
  testerId: string;
  flags: ScreeningFlag[];
}

export interface TesterInput {
  id: string;
  username: string;
  email: string;
  responses: { questionText: string; questionType: string; value: string }[];
}

// ── Circuit Breaker (same pattern as sentiment.ts) ─────────────

let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 60_000;

function isCircuitOpen(): boolean {
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    if (Date.now() < circuitOpenUntil) return true;
    consecutiveFailures = FAILURE_THRESHOLD - 1;
  }
  return false;
}

function recordSuccess() {
  consecutiveFailures = 0;
}

function recordFailure() {
  consecutiveFailures++;
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
  }
}

// For testing
export function resetCircuitBreaker() {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

// ── Tier 1: Local Heuristics ──────────────────────────────────

const KEYBOARD_PATTERNS = [
  "qwerty",
  "qwertz",
  "asdf",
  "zxcv",
  "wasd",
  "hjkl",
  "1234",
  "abcd",
];

const PLACEHOLDER_NAMES = [
  "test",
  "tester",
  "user",
  "demo",
  "admin",
  "sample",
  "example",
  "none",
  "n/a",
  "na",
  "null",
  "undefined",
  "xxx",
  "aaa",
  "abc",
  "foo",
  "bar",
  "john doe",
  "jane doe",
  "test user",
];

function hasVowels(str: string): boolean {
  return /[aeiou]/i.test(str);
}

function isAllSameChar(str: string): boolean {
  if (str.length < 2) return false;
  return str.split("").every((c) => c === str[0]);
}

function isKeyboardMash(str: string): boolean {
  const lower = str.toLowerCase().replace(/[^a-z]/g, "");
  return KEYBOARD_PATTERNS.some((p) => lower.includes(p));
}

export function detectFakeNames(testers: TesterInput[]): ScreeningResult[] {
  const results: ScreeningResult[] = [];

  for (const tester of testers) {
    const name = tester.username.trim();
    const lower = name.toLowerCase();
    const flags: ScreeningFlag[] = [];

    if (name.length <= 1) {
      flags.push({ flag: "FAKE_NAME", reason: `Username is only ${name.length} character(s)` });
    } else if (isAllSameChar(lower)) {
      flags.push({ flag: "FAKE_NAME", reason: `Username is repeated character: "${name}"` });
    } else if (isKeyboardMash(lower)) {
      flags.push({ flag: "FAKE_NAME", reason: `Username looks like a keyboard mash: "${name}"` });
    } else if (PLACEHOLDER_NAMES.includes(lower)) {
      flags.push({ flag: "FAKE_NAME", reason: `Username matches placeholder: "${name}"` });
    } else if (lower.length > 3 && !hasVowels(lower)) {
      flags.push({ flag: "FAKE_NAME", reason: `Username has no vowels: "${name}"` });
    }

    if (flags.length > 0) {
      results.push({ testerId: tester.id, flags });
    }
  }

  return results;
}

function isOpenTextQuestion(questionType: string): boolean {
  return questionType === "text" || questionType === "open";
}

function hasRepeatingPattern(str: string): boolean {
  const lower = str.toLowerCase().replace(/\s/g, "");
  if (lower.length < 4) return false;
  // Check 1-3 char repeating patterns
  for (let len = 1; len <= 3; len++) {
    const pattern = lower.slice(0, len);
    const repeated = pattern.repeat(Math.ceil(lower.length / len)).slice(0, lower.length);
    if (repeated === lower) return true;
  }
  return false;
}

export function detectLowEffort(testers: TesterInput[]): ScreeningResult[] {
  const results: ScreeningResult[] = [];

  for (const tester of testers) {
    const flags: ScreeningFlag[] = [];
    const textResponses = tester.responses.filter((r) =>
      isOpenTextQuestion(r.questionType)
    );

    for (const resp of textResponses) {
      const val = resp.value.trim();
      if (!val) continue;

      if (val.length < 10) {
        flags.push({
          flag: "LOW_EFFORT",
          reason: `Very short response (${val.length} chars) to "${resp.questionText}"`,
        });
      } else if (hasRepeatingPattern(val)) {
        flags.push({
          flag: "LOW_EFFORT",
          reason: `Repeating character pattern in response to "${resp.questionText}"`,
        });
      } else if (val.split(/\s+/).length === 1 && val.length < 20) {
        flags.push({
          flag: "LOW_EFFORT",
          reason: `Single-word response to open question "${resp.questionText}"`,
        });
      }
    }

    if (flags.length > 0) {
      results.push({ testerId: tester.id, flags });
    }
  }

  return results;
}

const COMMON_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "live.com",
  "msn.com",
  "mail.com",
  "protonmail.com",
  "proton.me",
  "ymail.com",
]);

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function stripTrailingDigits(s: string): string {
  return s.replace(/\d+$/, "");
}

export function detectDuplicatePatterns(testers: TesterInput[]): ScreeningResult[] {
  const flagMap = new Map<string, ScreeningFlag[]>();

  // 1. Near-identical usernames
  for (let i = 0; i < testers.length; i++) {
    for (let j = i + 1; j < testers.length; j++) {
      const a = stripTrailingDigits(testers[i].username.toLowerCase());
      const b = stripTrailingDigits(testers[j].username.toLowerCase());
      if (a.length > 2 && b.length > 2 && levenshtein(a, b) <= 2) {
        const flag: ScreeningFlag = {
          flag: "DUPLICATE_PATTERN",
          reason: `Username similar to "${testers[j].username}"`,
        };
        const flagJ: ScreeningFlag = {
          flag: "DUPLICATE_PATTERN",
          reason: `Username similar to "${testers[i].username}"`,
        };
        if (!flagMap.has(testers[i].id)) flagMap.set(testers[i].id, []);
        flagMap.get(testers[i].id)!.push(flag);
        if (!flagMap.has(testers[j].id)) flagMap.set(testers[j].id, []);
        flagMap.get(testers[j].id)!.push(flagJ);
      }
    }
  }

  // 2. Matching free-text responses across testers
  const responseGroups = new Map<string, string[]>();
  for (const tester of testers) {
    for (const resp of tester.responses) {
      if (!isOpenTextQuestion(resp.questionType)) continue;
      const normalized = resp.value.toLowerCase().trim();
      if (normalized.length < 15) continue; // skip very short
      if (!responseGroups.has(normalized)) responseGroups.set(normalized, []);
      responseGroups.get(normalized)!.push(tester.id);
    }
  }
  for (const [text, testerIds] of responseGroups) {
    if (testerIds.length > 1) {
      const snippet = text.length > 40 ? text.slice(0, 40) + "..." : text;
      for (const id of testerIds) {
        if (!flagMap.has(id)) flagMap.set(id, []);
        flagMap.get(id)!.push({
          flag: "DUPLICATE_PATTERN",
          reason: `Identical response shared with ${testerIds.length - 1} other tester(s): "${snippet}"`,
        });
      }
    }
  }

  // 3. Uncommon shared email domain (3+ testers)
  const domainGroups = new Map<string, string[]>();
  for (const tester of testers) {
    const domain = tester.email.split("@")[1]?.toLowerCase();
    if (!domain || COMMON_EMAIL_DOMAINS.has(domain)) continue;
    if (!domainGroups.has(domain)) domainGroups.set(domain, []);
    domainGroups.get(domain)!.push(tester.id);
  }
  for (const [domain, testerIds] of domainGroups) {
    if (testerIds.length >= 3) {
      for (const id of testerIds) {
        if (!flagMap.has(id)) flagMap.set(id, []);
        flagMap.get(id)!.push({
          flag: "DUPLICATE_PATTERN",
          reason: `${testerIds.length} testers share uncommon email domain @${domain}`,
        });
      }
    }
  }

  return Array.from(flagMap.entries()).map(([testerId, flags]) => ({
    testerId,
    flags,
  }));
}

// ── Tier 2: Claude API ─────────────────────────────────────────

async function detectGenericResponses(
  testers: TesterInput[]
): Promise<ScreeningResult[]> {
  if (!process.env.ANTHROPIC_API_KEY || isCircuitOpen()) {
    return [];
  }

  // Collect text responses for screening
  const items: { testerId: string; text: string; context: string }[] = [];
  for (const tester of testers) {
    const textResponses = tester.responses.filter(
      (r) => isOpenTextQuestion(r.questionType) && r.value.trim().length >= 15
    );
    if (textResponses.length === 0) continue;

    const combined = textResponses
      .map((r) => `Q: ${r.questionText}\nA: ${r.value}`)
      .join("\n\n");

    items.push({
      testerId: tester.id,
      text: combined,
      context: `Tester "${tester.username}" — all open-text responses`,
    });
  }

  if (items.length === 0) return [];

  try {
    const claudeResults = await screenBatchResponses(items);
    recordSuccess();

    const results: ScreeningResult[] = [];
    for (const [testerId, result] of claudeResults) {
      if (result.flagged) {
        results.push({
          testerId,
          flags: [
            {
              flag: "GENERIC_RESPONSE",
              reason: result.reason,
            },
          ],
        });
      }
    }
    return results;
  } catch (error) {
    console.warn("Claude screening failed, skipping Tier 2:", error);
    recordFailure();
    return [];
  }
}

// ── Orchestrator ───────────────────────────────────────────────

function mergeResults(resultSets: ScreeningResult[][]): ScreeningResult[] {
  const merged = new Map<string, ScreeningFlag[]>();

  for (const results of resultSets) {
    for (const result of results) {
      if (!merged.has(result.testerId)) {
        merged.set(result.testerId, []);
      }
      merged.get(result.testerId)!.push(...result.flags);
    }
  }

  return Array.from(merged.entries()).map(([testerId, flags]) => ({
    testerId,
    flags,
  }));
}

export async function runScreening(
  testers: TesterInput[]
): Promise<ScreeningResult[]> {
  // Tier 1: Local heuristics (fast)
  const nameFlags = detectFakeNames(testers);
  const effortFlags = detectLowEffort(testers);
  const duplicateFlags = detectDuplicatePatterns(testers);

  // Tier 2: Claude API (may be skipped)
  const genericFlags = await detectGenericResponses(testers);

  return mergeResults([nameFlags, effortFlags, duplicateFlags, genericFlags]);
}
