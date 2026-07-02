import { tenantStore } from '@/modules/tenant/tenant.store';
import { listEnabledForms } from '@/modules/conversation/form.agent-service';
import { pickFormId } from '@/modules/conversation/intent-router';

it('listEnabledForms 濾掉 disabledForms', () => {
  const t = tenantStore.createTenant('form-enabled-test');
  expect(listEnabledForms(t.id).map((d) => d.formId)).toContain('leave-request');
  tenantStore.updateTenant(t.id, { disabledForms: ['leave-request'] });
  expect(listEnabledForms(t.id).map((d) => d.formId)).not.toContain('leave-request');
});

it('pickFormId 不會選到被停用的表單', () => {
  const t = tenantStore.createTenant('pickform-test');
  tenantStore.updateTenant(t.id, { disabledForms: ['leave-request'] });
  expect(pickFormId(t.id, '我要請假')).not.toBe('leave-request');
});
