import { tenantStore } from '@/modules/tenant/tenant.store';

describe('tenantStore.deleteTenant', () => {
  it('刪除租戶並連帶移除其金鑰', () => {
    const t = tenantStore.createTenant('del-test');
    const key = tenantStore.createApiKey(t.id, 'publishable');
    expect(tenantStore.deleteTenant(t.id)).toBe(true);
    expect(tenantStore.getTenant(t.id)).toBeUndefined();
    expect(tenantStore.getApiKey(key.key)).toBeUndefined();
  });

  it('預設租戶不可刪、不存在回 false', () => {
    expect(tenantStore.deleteTenant('default')).toBe(false);
    expect(tenantStore.deleteTenant('no-such-tenant')).toBe(false);
  });
});
