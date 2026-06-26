/**
 * form-submit.registry 單元測試：formId → 送出 service 的查表解析。
 * 內建表單回專屬 service；其餘（含 Designer 自建）回通用送出函式（schema 驅動），皆為函式。
 */
import { resolveSubmit } from '@/modules/conversation/form-submit.registry';

describe('resolveSubmit', () => {
  it.each(['leave-request', 'business-trip-domestic', 'outing-registration'])(
    '已註冊表單 %s 回傳 submit 函式',
    (formId) => {
      expect(typeof resolveSubmit(formId)).toBe('function');
    },
  );

  it('未註冊表單回傳通用送出函式（schema 驅動，不丟錯）', () => {
    expect(typeof resolveSubmit('any-designed-form')).toBe('function');
  });
});
