/**
 * form-submit.registry 單元測試：formId → 送出 service 的查表解析。
 * 已註冊回函式；未註冊丟錯（取代舊版靜默 fallback 成請假的隱性行為）。
 */
import { resolveSubmit } from '@/modules/conversation/form-submit.registry';

describe('resolveSubmit', () => {
  it.each(['leave-request', 'business-trip-domestic', 'outing-registration'])(
    '已註冊表單 %s 回傳 submit 函式',
    (formId) => {
      expect(typeof resolveSubmit(formId)).toBe('function');
    },
  );

  it('未註冊表單丟出明確錯誤（不靜默 fallback）', () => {
    expect(() => resolveSubmit('unknown-form')).toThrow(/No submit service registered/);
  });
});
