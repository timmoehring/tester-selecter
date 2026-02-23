/**
 * Z3-based constraint solver for tester selection.
 *
 * Models tester selection as a weighted optimization problem:
 * - Hard constraints: exact count, blocklist exclusion, hard requirements
 * - Soft objectives: segmentation targets, golden tickets, community scores,
 *   active test avoidance, TGTBT penalty
 */

import { init } from "z3-solver";
import {
  TesterData,
  SolverConfig,
  DEFAULT_WEIGHTS,
  preFilter,
  preRank,
  scoreTester,
} from "./constraints";

export interface SolverResult {
  selected: string[]; // tester IDs for main selection
  backup: string[]; // tester IDs for backup pool
  scores: Record<string, number>; // tester ID -> solver score
  demographics: DemographicsSummary;
  solveTimeMs: number;
}

export interface DemographicsSummary {
  [segmentationId: string]: {
    name: string;
    targets: Record<string, number>;
    actual: Record<string, number>;
  };
}

export async function solve(
  testers: TesterData[],
  config: SolverConfig
): Promise<SolverResult> {
  const startTime = Date.now();

  // Pre-filter blocklisted and hard-requirement failures
  let eligible = preFilter(testers);
  const weights = { ...DEFAULT_WEIGHTS, ...config.weights };

  const totalNeeded = config.targetCount + config.surplusCount;

  if (eligible.length <= totalNeeded + config.backupCount) {
    // Pool is small enough — use scoring fallback directly
    return scoringFallback(eligible, config, weights, startTime);
  }

  // Pre-rank for large pools
  eligible = preRank(eligible, totalNeeded + config.backupCount, weights);

  try {
    // Attempt Z3 solve with timeout
    return await z3Solve(eligible, config, weights, startTime);
  } catch (error) {
    console.warn("Z3 solve failed, using scoring fallback:", error);
    return scoringFallback(eligible, config, weights, startTime);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function z3Solve(
  testers: TesterData[],
  config: SolverConfig,
  weights: SolverConfig["weights"],
  startTime: number
): Promise<SolverResult> {
  const { Context } = await init();
  const ctx: any = Context("main");
  const solver = new ctx.Optimize();

  const n = testers.length;
  const totalNeeded = config.targetCount + config.surplusCount;

  // Boolean variable per tester: selected or not
  const selected: any[] = testers.map((_t: TesterData, i: number) =>
    ctx.Bool.const(`sel_${i}`)
  );

  // Backup pool variables
  const backup: any[] = testers.map((_t: TesterData, i: number) =>
    ctx.Bool.const(`bak_${i}`)
  );

  // Hard constraint: can't be both selected and backup
  for (let i = 0; i < n; i++) {
    solver.add(ctx.Not(ctx.And(selected[i], backup[i])));
  }

  // Hard constraint: exact selection count
  const selectedTerms = selected.map((s: any) =>
    ctx.If(s, ctx.Int.val(1), ctx.Int.val(0))
  );
  const selectedSum = ctx.Sum(...selectedTerms);
  solver.add(ctx.Eq(selectedSum, ctx.Int.val(totalNeeded)));

  // Hard constraint: backup count
  const backupTerms = backup.map((b: any) =>
    ctx.If(b, ctx.Int.val(1), ctx.Int.val(0))
  );
  const backupSum = ctx.Sum(...backupTerms);
  solver.add(
    ctx.Eq(
      backupSum,
      ctx.Int.val(Math.min(config.backupCount, n - totalNeeded))
    )
  );

  // === Soft objectives ===
  const objectiveTerms: any[] = [];

  // 1. Community scores (maximize)
  for (let i = 0; i < n; i++) {
    const scoreInt = Math.round(testers[i].communityScore * 100);
    objectiveTerms.push(
      ctx.If(
        selected[i],
        ctx.Int.val(Math.round(scoreInt * weights.communityScore)),
        ctx.Int.val(0)
      )
    );
  }

  // 2. Golden ticket priority (maximize)
  for (let i = 0; i < n; i++) {
    if (testers[i].isGoldenTicket) {
      objectiveTerms.push(
        ctx.If(
          selected[i],
          ctx.Int.val(
            Math.round(
              testers[i].goldenTicketPriority * weights.goldenTicket * 100
            )
          ),
          ctx.Int.val(0)
        )
      );
    }
  }

  // 3. Active test penalty (minimize -> negative contribution)
  for (let i = 0; i < n; i++) {
    if (testers[i].activeTestCount > 0) {
      objectiveTerms.push(
        ctx.If(
          selected[i],
          ctx.Int.val(
            -Math.round(
              testers[i].activeTestCount * weights.activeTestPenalty * 100
            )
          ),
          ctx.Int.val(0)
        )
      );
    }
  }

  // 4. TGTBT penalty
  for (let i = 0; i < n; i++) {
    let penalty = 0;
    if (testers[i].tgtbtExtreme) penalty += weights.tgtbtPenalty * 100;
    if (testers[i].tgtbtOutlier) penalty += weights.tgtbtPenalty * 50;
    if (penalty > 0) {
      objectiveTerms.push(
        ctx.If(
          selected[i],
          ctx.Int.val(-Math.round(penalty)),
          ctx.Int.val(0)
        )
      );
    }
  }

  // 5. Soft requirement scores
  for (let i = 0; i < n; i++) {
    if (testers[i].softRequirementScore > 0) {
      objectiveTerms.push(
        ctx.If(
          selected[i],
          ctx.Int.val(
            Math.round(
              testers[i].softRequirementScore * weights.softRequirement * 100
            )
          ),
          ctx.Int.val(0)
        )
      );
    }
  }

  // 6. Segmentation targets (minimize deviation)
  for (const seg of config.segmentations) {
    for (const [targetValue, targetPct] of Object.entries(
      seg.targetPercentages
    )) {
      const targetNum = Math.round((targetPct / 100) * totalNeeded);

      const segTerms = testers.map((t: TesterData, i: number) =>
        ctx.If(
          ctx.And(
            selected[i],
            ctx.Bool.val(t.segmentValues[seg.id] === targetValue)
          ),
          ctx.Int.val(1),
          ctx.Int.val(0)
        )
      );
      const countForValue = ctx.Sum(...segTerms);

      // Penalize deviation from target
      const deviation = ctx.Sub(countForValue, ctx.Int.val(targetNum));
      const absDeviation = ctx.If(
        ctx.GE(deviation, ctx.Int.val(0)),
        deviation,
        ctx.Sub(ctx.Int.val(0), deviation)
      );

      // Use multiplication via repeated addition for compatibility
      const penaltyWeight = Math.round(weights.segmentationDeviation * 100);
      objectiveTerms.push(
        ctx.Sub(
          ctx.Int.val(0),
          ctx.Product(absDeviation, ctx.Int.val(penaltyWeight))
        )
      );
    }
  }

  // Maximize total objective
  if (objectiveTerms.length > 0) {
    const totalObjective = ctx.Sum(...objectiveTerms);
    solver.maximize(totalObjective);
  }

  // Set timeout (30 seconds)
  solver.set("timeout", 30000);

  const result = await solver.check();

  if (result !== "sat") {
    throw new Error(`Z3 solver returned: ${result}`);
  }

  const model = solver.model();

  // Extract results
  const selectedIds: string[] = [];
  const backupIds: string[] = [];
  const scores: Record<string, number> = {};

  for (let i = 0; i < n; i++) {
    const isSelected = model.eval(selected[i]).toString() === "true";
    const isBackup = model.eval(backup[i]).toString() === "true";

    scores[testers[i].id] = scoreTester(testers[i], weights);

    if (isSelected) {
      selectedIds.push(testers[i].id);
    } else if (isBackup) {
      backupIds.push(testers[i].id);
    }
  }

  // Compute demographics
  const demographics = computeDemographics(
    testers.filter((t) => selectedIds.includes(t.id)),
    config,
    totalNeeded
  );

  return {
    selected: selectedIds,
    backup: backupIds,
    scores,
    demographics,
    solveTimeMs: Date.now() - startTime,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function scoringFallback(
  testers: TesterData[],
  config: SolverConfig,
  weights: SolverConfig["weights"],
  startTime: number
): SolverResult {
  const totalNeeded = config.targetCount + config.surplusCount;

  // Score and rank all testers
  const scored = testers
    .map((t) => ({ tester: t, score: scoreTester(t, weights) }))
    .sort((a, b) => b.score - a.score);

  const selectedIds = scored.slice(0, totalNeeded).map((s) => s.tester.id);
  const backupIds = scored
    .slice(totalNeeded, totalNeeded + config.backupCount)
    .map((s) => s.tester.id);

  const scores: Record<string, number> = {};
  for (const s of scored) {
    scores[s.tester.id] = s.score;
  }

  const demographics = computeDemographics(
    scored.slice(0, totalNeeded).map((s) => s.tester),
    config,
    totalNeeded
  );

  return {
    selected: selectedIds,
    backup: backupIds,
    scores,
    demographics,
    solveTimeMs: Date.now() - startTime,
  };
}

function computeDemographics(
  selectedTesters: TesterData[],
  config: SolverConfig,
  totalCount: number
): DemographicsSummary {
  const summary: DemographicsSummary = {};

  for (const seg of config.segmentations) {
    const valueCounts: Record<string, number> = {};
    for (const t of selectedTesters) {
      const val = t.segmentValues[seg.id] || "Unknown";
      valueCounts[val] = (valueCounts[val] || 0) + 1;
    }

    const actual: Record<string, number> = {};
    for (const [val, count] of Object.entries(valueCounts)) {
      actual[val] = Math.round((count / totalCount) * 10000) / 100;
    }

    summary[seg.id] = {
      name: seg.name,
      targets: seg.targetPercentages,
      actual,
    };
  }

  return summary;
}
