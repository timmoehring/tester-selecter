/**
 * Constraint builder functions for the Z3 solver.
 * These functions prepare the data structures needed for the solver.
 */

export interface TesterData {
  id: string;
  email: string;
  username: string;
  communityScore: number;
  tgtbtExtreme: boolean;
  tgtbtOutlier: boolean;
  responses: Record<string, string>; // questionId -> responseValue
  isBlocklisted: boolean;
  isGoldenTicket: boolean;
  goldenTicketPriority: number;
  activeTestCount: number;
  hardRequirementsMet: boolean;
  softRequirementScore: number;
  segmentValues: Record<string, string>; // segmentationId -> value
}

export interface SolverConfig {
  targetCount: number;
  surplusCount: number;
  backupCount: number;
  segmentations: {
    id: string;
    name: string;
    targetPercentages: Record<string, number>;
    tolerance: number;
  }[];
  weights: {
    communityScore: number;
    goldenTicket: number;
    activeTestPenalty: number;
    tgtbtPenalty: number;
    segmentationDeviation: number;
    softRequirement: number;
  };
}

export const DEFAULT_WEIGHTS: SolverConfig["weights"] = {
  communityScore: 1.0,
  goldenTicket: 5.0,
  activeTestPenalty: 3.0,
  tgtbtPenalty: 1.5,
  segmentationDeviation: 2.0,
  softRequirement: 1.0,
};

/**
 * Pre-filter: remove blocklisted and hard-requirement-failing testers.
 */
export function preFilter(testers: TesterData[]): TesterData[] {
  return testers.filter((t) => !t.isBlocklisted && t.hardRequirementsMet);
}

/**
 * Score a tester for pre-ranking (used when pool > 3x target).
 */
export function scoreTester(
  tester: TesterData,
  weights: SolverConfig["weights"]
): number {
  let score = 0;

  // Community score (normalized 0-1 assumed)
  score += tester.communityScore * weights.communityScore;

  // Golden ticket bonus
  if (tester.isGoldenTicket) {
    score += tester.goldenTicketPriority * weights.goldenTicket;
  }

  // Active test penalty
  score -= tester.activeTestCount * weights.activeTestPenalty;

  // TGTBT penalty
  if (tester.tgtbtExtreme) score -= weights.tgtbtPenalty;
  if (tester.tgtbtOutlier) score -= weights.tgtbtPenalty * 0.5;

  // Soft requirement satisfaction
  score += tester.softRequirementScore * weights.softRequirement;

  return score;
}

/**
 * Pre-rank: for large pools, score and take top 3x target count.
 */
export function preRank(
  testers: TesterData[],
  targetCount: number,
  weights: SolverConfig["weights"]
): TesterData[] {
  const limit = targetCount * 3;
  if (testers.length <= limit) return testers;

  return testers
    .map((t) => ({ tester: t, score: scoreTester(t, weights) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((t) => t.tester);
}

/**
 * Check if a tester meets a requirement given their response.
 */
export function meetsRequirement(
  responseValue: string,
  acceptedValues: string[]
): boolean {
  if (acceptedValues.length === 0) return true;
  const normalizedResponse = responseValue.toLowerCase().trim();
  return acceptedValues.some(
    (v) => v.toLowerCase().trim() === normalizedResponse
  );
}

/**
 * Prepare tester data from DB records with all enrichment.
 */
export function prepareTesterData(
  applicants: {
    id: string;
    email: string;
    username: string;
    communityScore: number;
    tgtbtExtreme: boolean;
    tgtbtOutlier: boolean;
    surveyResponses: { surveyQuestionId: string; responseValue: string }[];
  }[],
  hardRequirements: {
    id: string;
    acceptedValues: string[];
    questionMappings: { surveyQuestionId: string }[];
  }[],
  softRequirements: {
    id: string;
    acceptedValues: string[];
    weight: number;
    questionMappings: { surveyQuestionId: string }[];
  }[],
  segmentations: {
    id: string;
    questionMappings: { surveyQuestionId: string }[];
  }[],
  blocklistedEmails: Set<string>,
  blocklistedUsernames: Set<string>,
  goldenTickets: Map<string, number>,
  activeTestEmails: Set<string>
): TesterData[] {
  return applicants.map((applicant) => {
    const responses: Record<string, string> = {};
    for (const r of applicant.surveyResponses) {
      responses[r.surveyQuestionId] = r.responseValue;
    }

    const isBlocklisted =
      blocklistedEmails.has(applicant.email.toLowerCase()) ||
      blocklistedUsernames.has(applicant.username.toLowerCase());

    const gtPriority =
      goldenTickets.get(applicant.email.toLowerCase()) ||
      goldenTickets.get(applicant.username.toLowerCase()) ||
      0;

    // Check hard requirements
    const hardRequirementsMet = hardRequirements.every((req) => {
      const mapping = req.questionMappings[0];
      if (!mapping) return true;
      return meetsRequirement(
        responses[mapping.surveyQuestionId] || "",
        req.acceptedValues
      );
    });

    // Compute soft requirement score
    let softScore = 0;
    for (const req of softRequirements) {
      const mapping = req.questionMappings[0];
      if (!mapping) continue;
      if (
        meetsRequirement(
          responses[mapping.surveyQuestionId] || "",
          req.acceptedValues
        )
      ) {
        softScore += req.weight;
      }
    }

    // Get segmentation values
    const segmentValues: Record<string, string> = {};
    for (const seg of segmentations) {
      const mapping = seg.questionMappings[0];
      if (mapping) {
        segmentValues[seg.id] = responses[mapping.surveyQuestionId] || "";
      }
    }

    return {
      id: applicant.id,
      email: applicant.email,
      username: applicant.username,
      communityScore: applicant.communityScore,
      tgtbtExtreme: applicant.tgtbtExtreme,
      tgtbtOutlier: applicant.tgtbtOutlier,
      responses,
      isBlocklisted,
      isGoldenTicket: gtPriority > 0,
      goldenTicketPriority: gtPriority,
      activeTestCount: activeTestEmails.has(applicant.email.toLowerCase())
        ? 1
        : 0,
      hardRequirementsMet,
      softRequirementScore: softScore,
      segmentValues,
    };
  });
}
