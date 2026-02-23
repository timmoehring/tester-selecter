/**
 * Auto-mapper: matches survey questions to requirements/segmentations
 * using Levenshtein distance + keyword matching for confidence scores.
 */

interface MappingTarget {
  id: string;
  name: string;
  description?: string | null;
  type: "requirement" | "segmentation";
}

export interface MappingCandidate {
  surveyQuestionId: string;
  questionText: string;
  targetId: string;
  targetName: string;
  targetType: "requirement" | "segmentation";
  confidence: number;
}

export function autoMap(
  questions: { id: string; questionText: string }[],
  targets: MappingTarget[]
): MappingCandidate[] {
  const results: MappingCandidate[] = [];

  for (const question of questions) {
    let bestMatch: MappingCandidate | null = null;
    let bestScore = 0;

    for (const target of targets) {
      const score = computeSimilarity(
        question.questionText,
        target.name,
        target.description || ""
      );

      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          surveyQuestionId: question.id,
          questionText: question.questionText,
          targetId: target.id,
          targetName: target.name,
          targetType: target.type,
          confidence: score,
        };
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.3) {
      results.push(bestMatch);
    }
  }

  return results;
}

function computeSimilarity(
  questionText: string,
  targetName: string,
  targetDescription: string
): number {
  const qNorm = normalize(questionText);
  const tNorm = normalize(targetName);
  const dNorm = normalize(targetDescription);

  // 1. Levenshtein-based similarity to target name
  const levenSim = 1 - levenshteinDistance(qNorm, tNorm) / Math.max(qNorm.length, tNorm.length, 1);

  // 2. Word overlap (Jaccard)
  const qWords = new Set(qNorm.split(/\s+/));
  const tWords = new Set(tNorm.split(/\s+/).concat(dNorm.split(/\s+/)));
  const intersection = new Set([...qWords].filter((w) => tWords.has(w)));
  const union = new Set([...qWords, ...tWords]);
  const jaccard = union.size > 0 ? intersection.size / union.size : 0;

  // 3. Keyword matching: check if target name words appear in question
  const tNameWords = tNorm.split(/\s+/).filter((w) => w.length > 2);
  const keywordMatch =
    tNameWords.length > 0
      ? tNameWords.filter((w) => qNorm.includes(w)).length / tNameWords.length
      : 0;

  // 4. Substring containment bonus
  const containsBonus = qNorm.includes(tNorm) || tNorm.includes(qNorm) ? 0.3 : 0;

  // Weighted combination
  const score = Math.min(
    1,
    levenSim * 0.25 + jaccard * 0.25 + keywordMatch * 0.35 + containsBonus
  );

  return Math.round(score * 100) / 100;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}
