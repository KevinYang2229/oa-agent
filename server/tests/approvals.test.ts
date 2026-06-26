/**
 * approvals 單元測試：依送出時間推算各關卡 approved/current/pending（Demo 每 15 秒推進一關）。
 * 用相對「現在」的時間偏移建構送出時間，並避開 15s 邊界以免 flaky。
 */
import { computeApprovals, refreshApprovals, stepDefs } from '@/modules/form/approvals';
import { getDefinition } from '@/modules/form/form.registry';

const steps = [
  { name: '主管審核', type: 'manager' },
  { name: '人資審核', type: 'hr' },
  { name: '總經理核准', type: 'gm' },
];

/** N 毫秒前的 ISO 時間字串 */
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

describe('computeApprovals', () => {
  it('剛送出（<15s）：第一關 current，其餘 pending', () => {
    const r = computeApprovals(steps, ago(5_000));
    expect(r.map((s) => s.status)).toEqual(['current', 'pending', 'pending']);
  });

  it('過一關時間（~20s）：第一關 approved、第二關 current', () => {
    const r = computeApprovals(steps, ago(20_000));
    expect(r.map((s) => s.status)).toEqual(['approved', 'current', 'pending']);
  });

  it('時間夠久：全部 approved，無 current（流程完成）', () => {
    const r = computeApprovals(steps, ago(999_000));
    expect(r.every((s) => s.status === 'approved')).toBe(true);
  });

  it('保留每關的 name 與 type', () => {
    const r = computeApprovals(steps, ago(1_000));
    expect(r[0]).toMatchObject({ name: '主管審核', type: 'manager' });
  });

  it('空關卡回空陣列', () => {
    expect(computeApprovals([], ago(0))).toEqual([]);
  });
});

describe('stepDefs', () => {
  it('無 workflow 回空陣列', () => {
    expect(stepDefs({ workflow: undefined } as never)).toEqual([]);
  });

  it('真實表單回關卡定義（每關有 type）', () => {
    const defs = stepDefs(getDefinition('leave-request'));
    expect(defs.length).toBeGreaterThan(0);
    expect(defs[0]).toHaveProperty('type');
    expect(defs[0]).toHaveProperty('name');
  });
});

describe('refreshApprovals', () => {
  it('無 submittedAt：原樣回傳同一參考', () => {
    const appr = computeApprovals(steps, ago(0));
    expect(refreshApprovals(appr, undefined)).toBe(appr);
  });

  it('空清單：原樣回傳', () => {
    expect(refreshApprovals([], ago(0))).toEqual([]);
  });

  it('有 submittedAt：依時間重新計算狀態', () => {
    const appr = steps.map((s) => ({ ...s, status: 'pending' as const }));
    const r = refreshApprovals(appr, ago(20_000));
    expect(r[0].status).toBe('approved');
    expect(r[1].status).toBe('current');
  });
});
