import { hitAtK, mean, reciprocalRank } from '@/modules/knowledge/eval.metrics';

describe('檢索精準度指標', () => {
  it('hitAtK：命中名次在 k 內回 1，否則 0', () => {
    expect(hitAtK([3, 5], 3)).toBe(1);
    expect(hitAtK([4, 5], 3)).toBe(0);
    expect(hitAtK([], 5)).toBe(0);
  });

  it('reciprocalRank：取第一個命中名次的倒數', () => {
    expect(reciprocalRank([2, 4])).toBeCloseTo(0.5);
    expect(reciprocalRank([1])).toBe(1);
    expect(reciprocalRank([])).toBe(0);
  });

  it('mean：空陣列為 0', () => {
    expect(mean([1, 0, 0.5])).toBeCloseTo(0.5);
    expect(mean([])).toBe(0);
  });
});
