import { indexPathFor } from '@/modules/knowledge/index-path';

describe('indexPathFor', () => {
  it('依 tenantId 產生 per-tenant 檔名', () => {
    expect(indexPathFor('acme')).toMatch(/knowledge-index\.acme\.json$/);
    expect(indexPathFor('default')).toMatch(/knowledge-index\.default\.json$/);
  });
});
