import { it, expect, jest } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { makeAdminToken } from '../../helpers/adminToken.js';

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({ user: { findUnique: jest.fn(async () => ({ id: 1, role: 'ADMIN', isActive: true })) } })),
}));
const router = (await import('../../../src/routes/admin/customsProfiles.js')).default;
const app = buildApp(router);
it('requires admin authentication', async () => {
  expect((await request(app).get('/api/')).status).toBe(401);
});
it('returns the predefined profiles with their criteria and references', async () => {
  const res = await request(app).get('/api/').set('Cookie', `auth_admin=${makeAdminToken()}`);
  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(19);
  expect(res.body.data.find((profile) => profile.key === 'international-wool-blend-pullover')).toMatchObject({ kind: 'product', hsCode: '611011', internationalOnly: true, usHtsCode: null });
  expect(res.body.data.find((profile) => profile.key === 'international-crocheted-footwear-rubber-plastic')).toMatchObject({ kind: 'product', hsCode: '640419', internationalOnly: true, requiresConfirmation: true, usHtsCode: null });
  expect(res.body.data.find((profile) => profile.key === 'international-crocheted-scarf')).toMatchObject({ kind: 'product', hsCode: '611710', internationalOnly: true, usHtsCode: null });
  expect(res.body.data.find((profile) => profile.key === 'acrylic-adult-hat')).toMatchObject({ kind: 'product', hsCode: '650500', usHtsCode: '6505006090' });
});
