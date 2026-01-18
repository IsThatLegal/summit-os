import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import {
  createTestTenant,
  deleteTestTenant,
  cleanupAllTestData,
  generateTestId,
  generateTestGateCode,
} from '../helpers/testUtils';
import {
  ensureTestAdminUser,
  makeAuthenticatedTestRequest,
  deleteTestAdminUser,
} from '../helpers/testAuth';

const API_PORT = process.env.API_PORT || 3000;
const API_URL = `http://localhost:${API_PORT}/api/tenants`;

describe('Tenant Management API - Integration Tests', () => {
  let testTenantId: string;

  beforeAll(async () => {
    await cleanupAllTestData();
    await ensureTestAdminUser();
  });

  afterAll(async () => {
    // Don't call cleanupAllTestData() here as it interferes with other running tests
    // Cleanup will happen in beforeAll of next test run
    await deleteTestAdminUser();
  });

  describe('POST /api/tenants - Create Tenant', () => {
    test('should create a new tenant with valid data', async () => {
      const testId = generateTestId();
      const tenantData = {
        first_name: `Test_Tenant_${testId}`,
        email: `test_${testId}@example.com`,
        phone: '555-1234',
        gate_access_code: generateTestGateCode(),
        current_balance: 0,
        is_locked_out: false,
      };

      const response = await makeAuthenticatedTestRequest(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenantData),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.first_name).toBe(tenantData.first_name);
      expect(data.email).toBe(tenantData.email);

      // Store for cleanup
      testTenantId = data.id;
    });

    test('should reject tenant creation with missing required fields', async () => {
      const response = await makeAuthenticatedTestRequest(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: 'Test',
          // Missing email and other required fields
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });

    test('should reject tenant with invalid email format', async () => {
      const response = await makeAuthenticatedTestRequest(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: 'Test',
          email: 'invalid-email',
          phone: '555-1234',
          gate_access_code: 'TEST123',
          current_balance: 0,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });

    test('should create tenant with zero balance', async () => {
      const testId = generateTestId();
      const tenantData = {
        first_name: `ZeroBalance_${testId}`,
        email: `zero_${testId}@example.com`,
        phone: '555-0000',
        gate_access_code: generateTestGateCode(),
        current_balance: 0,
        is_locked_out: false,
      };

      const response = await makeAuthenticatedTestRequest(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenantData),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.current_balance).toBe(0);

      // Cleanup
      await deleteTestTenant(data.id);
    });

    test('should create tenant with positive balance (cents)', async () => {
      const testId = generateTestId();
      const tenantData = {
        first_name: `PositiveBalance_${testId}`,
        email: `positive_${testId}@example.com`,
        phone: '555-0001',
        gate_access_code: generateTestGateCode(),
        current_balance: 5000, // $50.00 in cents
        is_locked_out: false,
      };

      const response = await makeAuthenticatedTestRequest(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenantData),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.current_balance).toBe(5000);

      // Cleanup
      await deleteTestTenant(data.id);
    });
  });

  describe('DELETE /api/tenants/:id - Delete Tenant', () => {
    test('should delete an existing tenant', async () => {
      // Create a test tenant first
      const tenant = await createTestTenant();

      const response = await makeAuthenticatedTestRequest(`${API_URL}/${tenant.id}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toContain('deleted');
    });

    test('should return 404 for non-existent tenant', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await makeAuthenticatedTestRequest(`${API_URL}/${fakeId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);
    });

    test('should return 400 for invalid UUID format', async () => {
      const response = await makeAuthenticatedTestRequest(`${API_URL}/invalid-id`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Tenant Business Logic', () => {
    test('should not allow duplicate gate access codes', async () => {
      const gateCode = generateTestGateCode();

      // Create first tenant
      const tenant1 = await createTestTenant({ gate_access_code: gateCode });

      // Try to create second tenant with same gate code
      const testId = generateTestId();
      const response = await makeAuthenticatedTestRequest(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: `Duplicate_${testId}`,
          email: `duplicate_${testId}@example.com`,
          phone: '555-DUPE',
          gate_access_code: gateCode,
          current_balance: 0,
        }),
      });

      // Should fail due to unique constraint
      expect(response.status).toBe(500);

      // Cleanup
      await deleteTestTenant(tenant1.id);
    });

    test('should allow tenant with locked_out flag', async () => {
      const tenant = await createTestTenant({
        is_locked_out: true,
        current_balance: 0,
      });

      expect(tenant.is_locked_out).toBe(true);

      // Cleanup
      await deleteTestTenant(tenant.id);
    });
  });
});
