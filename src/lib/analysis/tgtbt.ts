/**
 * TGTBT = "Too Good To Be True" detection
 *
 * Two algorithms:
 * 1. Extreme Maximizer: % of applicable questions where tester chose highest option. Flag if >80%.
 * 2. Statistical Outlier: Sum of absolute z-scores across all questions. Flag if >2 std devs above mean.
 */

export interface TGTBTFlags {
  extreme: boolean;
  outlier: boolean;
  extremeScore: number;
  outlierScore: number;
}

export function detectTGTBTFlags(
  rows: Record<string, string>[],
  headers: string[],
  detectedOptions: Record<string, string[]>
): TGTBTFlags[] {
  if (rows.length === 0) return [];

  // Only consider columns that have detected options (categorical/ordinal)
  const ordinalColumns = headers.filter(
    (h) => (detectedOptions[h]?.length || 0) >= 2
  );

  // === Algorithm 1: Extreme Maximizer ===
  // For each ordinal column, the "highest" option is the last one (alphabetically sorted)
  const extremeScores = rows.map((row) => {
    let applicableCount = 0;
    let maxChosenCount = 0;

    for (const col of ordinalColumns) {
      const options = detectedOptions[col];
      if (!options || options.length < 2) continue;

      const value = row[col];
      if (!value) continue;

      applicableCount++;
      const highestOption = options[options.length - 1];
      if (value === highestOption) {
        maxChosenCount++;
      }
    }

    return applicableCount > 0 ? maxChosenCount / applicableCount : 0;
  });

  // === Algorithm 2: Statistical Outlier ===
  // Compute z-scores for each column, sum absolute z-scores per tester
  const numericValues: Record<string, number[]> = {};

  for (const col of ordinalColumns) {
    numericValues[col] = rows.map((row) => {
      const options = detectedOptions[col];
      if (!options) return 0;
      const idx = options.indexOf(row[col]);
      return idx >= 0 ? idx : 0;
    });
  }

  // Compute mean + stddev per column
  const stats: Record<string, { mean: number; std: number }> = {};
  for (const col of ordinalColumns) {
    const vals = numericValues[col];
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance =
      vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    stats[col] = { mean, std: Math.sqrt(variance) || 1 };
  }

  // Sum of absolute z-scores per tester
  const zScoreSums = rows.map((_, i) => {
    let sum = 0;
    for (const col of ordinalColumns) {
      const val = numericValues[col][i];
      const z = Math.abs((val - stats[col].mean) / stats[col].std);
      sum += z;
    }
    return sum;
  });

  // Outlier threshold: mean + 2*std of the z-score sums
  const zMean =
    zScoreSums.reduce((a, b) => a + b, 0) / zScoreSums.length;
  const zStd =
    Math.sqrt(
      zScoreSums.reduce((a, b) => a + (b - zMean) ** 2, 0) /
        zScoreSums.length
    ) || 1;
  const outlierThreshold = zMean + 2 * zStd;

  return rows.map((_, i) => ({
    extreme: extremeScores[i] > 0.8,
    outlier: zScoreSums[i] > outlierThreshold,
    extremeScore: Math.round(extremeScores[i] * 100),
    outlierScore: Math.round(zScoreSums[i] * 100) / 100,
  }));
}
