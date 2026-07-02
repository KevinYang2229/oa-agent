import { tenantStore } from '@/modules/tenant/tenant.store';

it('updateTenant 存取 disabledServices / disabledForms', () => {
  const t = tenantStore.createTenant('toggle-test');
  const updated = tenantStore.updateTenant(t.id, {
    disabledServices: ['knowledge'],
    disabledForms: ['business-trip-domestic'],
  });
  expect(updated?.disabledServices).toEqual(['knowledge']);
  expect(tenantStore.getTenant(t.id)?.disabledForms).toEqual(['business-trip-domestic']);
});
