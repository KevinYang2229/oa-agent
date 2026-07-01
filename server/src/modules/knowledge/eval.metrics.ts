/**
 * 檢索精準度指標（純函式，可單元測試）。
 *
 * hitRanks = 相關片段在檢索結果中的 1-based 名次陣列（無命中則空陣列）。
 */

/** hit@k：前 k 名內是否至少命中一個相關片段（1 或 0） */
export function hitAtK(hitRanks: number[], k: number): number {
  return hitRanks.some((r) => r <= k) ? 1 : 0;
}

/** Reciprocal Rank：第一個命中的名次倒數；無命中為 0 */
export function reciprocalRank(hitRanks: number[]): number {
  return hitRanks.length ? 1 / Math.min(...hitRanks) : 0;
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
