/**
 * Dual-mode sentiment service:
 * - Primary: Claude API
 * - Fallback: local `sentiment` npm package with circuit breaker
 */

import {
  analyzeSentiment as claudeAnalyze,
  batchAnalyzeSentiment as claudeBatch,
  type SentimentResult,
} from "./claude-client";
import Sentiment from "sentiment";

const localAnalyzer = new Sentiment();

// Circuit breaker state
let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 60000; // 1 minute

function isCircuitOpen(): boolean {
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    if (Date.now() < circuitOpenUntil) return true;
    // Half-open: allow one retry
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

/**
 * Local sentiment analysis fallback.
 * Maps numeric score to letter grade.
 */
function localAnalyze(text: string): SentimentResult {
  const result = localAnalyzer.analyze(text);
  const comparative = result.comparative;

  let grade: string;
  if (comparative >= 0.5) grade = "A";
  else if (comparative >= 0.2) grade = "B";
  else if (comparative >= -0.1) grade = "C";
  else if (comparative >= -0.3) grade = "D";
  else grade = "F";

  return {
    grade,
    justification: `Local analysis: sentiment score ${comparative.toFixed(2)} (${result.positive.length} positive, ${result.negative.length} negative words)`,
  };
}

/**
 * Analyze sentiment with Claude primary, local fallback.
 */
export async function analyzeSentiment(
  text: string,
  context?: string
): Promise<SentimentResult> {
  if (!text || text.trim().length < 5) {
    return { grade: "C", justification: "Response too short to analyze" };
  }

  if (!process.env.ANTHROPIC_API_KEY || isCircuitOpen()) {
    return localAnalyze(text);
  }

  try {
    const result = await claudeAnalyze(text, context);
    recordSuccess();
    return result;
  } catch (error) {
    console.warn("Claude sentiment failed, using local fallback:", error);
    recordFailure();
    return localAnalyze(text);
  }
}

/**
 * Batch analyze with Claude primary, local fallback.
 */
export async function batchAnalyzeSentiment(
  items: { id: string; text: string; context?: string }[]
): Promise<Map<string, SentimentResult>> {
  if (!process.env.ANTHROPIC_API_KEY || isCircuitOpen()) {
    const results = new Map<string, SentimentResult>();
    for (const item of items) {
      results.set(item.id, localAnalyze(item.text));
    }
    return results;
  }

  try {
    const results = await claudeBatch(items);
    recordSuccess();
    return results;
  } catch (error) {
    console.warn("Claude batch failed, using local fallback:", error);
    recordFailure();
    const results = new Map<string, SentimentResult>();
    for (const item of items) {
      results.set(item.id, localAnalyze(item.text));
    }
    return results;
  }
}

export type { SentimentResult };
