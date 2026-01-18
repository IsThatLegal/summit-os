import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import {
  createTestTenant,
  deleteTestTenant,
  cleanupAllTestData,
} from '../helpers/testUtils';
import {
  ensureTestAdminUser,
  makeAuthenticatedTestRequest,
  deleteTestAdminUser,
} from '../helpers/testAuth';
import { getSupabase } from '@/lib/supabaseClient';

const API_PORT = process.env.API_PORT || 3000;
const CHARGE_API_URL = `http://localhost:${API_PORT}/api/finance/charge`;
const CASH_API_URL = `http://localhost:${API_PORT}/api/payments/cash`;
const CHECK_API_URL = `http://localhost:${API_PORT}/api/payments/checks`;

describe('Payment Processing API - Integration Tests', () => {
  let testTenant: any;

  beforeAll(async () => {
    await cleanupAllTestData();
    await ensureTestAdminUser();
    // Create a test tenant for payment tests
    testTenant = await createTestTenant({
      current_balance: 10000, // $100 balance
    });
    console.log('Created test tenant:', testTenant);
  });

  afterAll(async () => {
    if (testTenant) {
      await deleteTestTenant(testTenant.id);
    }
    // Don't call cleanupAllTestData() here as it interferes with other running tests
    // Cleanup will happen in beforeAll of next test run
    await deleteTestAdminUser();
  });

  describe('POST /api/finance/charge - Charge Tenant', () => {
    test('should reject charge with missing tenant_id', async () => {
      const response = await makeAuthenticatedTestRequest(CHARGE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_in_cents: 5000,
          description: 'Test charge',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });

    test('should reject charge with invalid amount', async () => {
      const response = await makeAuthenticatedTestRequest(CHARGE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: testTenant.id,
          amount_in_cents: -100, // Negative amount
          description: 'Invalid charge',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });

    test('should reject charge with missing description', async () => {
      const response = await makeAuthenticatedTestRequest(CHARGE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: testTenant.id,
          amount_in_cents: 5000,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });

    test('should successfully process payment and reduce balance', async () => {
      const supabase = getSupabase();

      console.log('Test tenant ID:', testTenant?.id);

      // Get initial balance
      const { data: beforeTenant, error: fetchError } = await supabase
        .from('tenants')
        .select('current_balance')
        .eq('id', testTenant.id)
        .single();

      if (fetchError) {
        console.error('Error fetching tenant:', fetchError);
      }
      console.log('Before tenant:', beforeTenant);

      const initialBalance = beforeTenant!.current_balance;

      // Process payment (this API processes Stripe payments, not charges)
      const paymentAmount = 2500; // $25
      const response = await makeAuthenticatedTestRequest(CHARGE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: testTenant.id,
          amount_in_cents: paymentAmount,
          description: 'Payment',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.message).toContain('Charge successful');

      // Verify balance decreased (payment reduces debt)
      const { data: afterTenant } = await supabase
        .from('tenants')
        .select('current_balance')
        .eq('id', testTenant.id)
        .single();

      expect(afterTenant!.current_balance).toBe(initialBalance - paymentAmount);
    }, 15000); // 15 second timeout for Stripe API

    test('should reject charge for non-existent tenant', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await makeAuthenticatedTestRequest(CHARGE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: fakeId,
          amount_in_cents: 5000,
          description: 'Test charge',
        }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/payments/checks - Check Payment', () => {
    test('should reject check payment with missing fields', async () => {
      const response = await makeAuthenticatedTestRequest(CHECK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: testTenant.id,
          amount_in_cents: 5000,
          // Missing check details
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });

    test('should validate check number format', async () => {
      const response = await makeAuthenticatedTestRequest(CHECK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: testTenant.id,
          amount_in_cents: 5000,
          description: 'Check payment',
          check_number: '', // Empty check number
          bank_name: 'Test Bank',
          routing_number: '123456789',
          account_number: '987654321',
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Balance Calculations', () => {
    test('should correctly handle balance in cents', async () => {
      const supabase = getSupabase();

      // Create tenant with specific balance
      const tenant = await createTestTenant({
        current_balance: 12345, // $123.45
      });

      const { data } = await supabase
        .from('tenants')
        .select('current_balance')
        .eq('id', tenant.id)
        .single();

      expect(data!.current_balance).toBe(12345);

      // Cleanup
      await deleteTestTenant(tenant.id);
    });

    test('should correctly update balance after payment', async () => {
      const supabase = getSupabase();

      // Create tenant with balance
      const tenant = await createTestTenant({
        current_balance: 10000, // $100
      });

      // Make a payment (this would normally go through Stripe)
      // For now, we'll directly update via transaction
      const { error } = await supabase.from('transactions').insert({
        tenant_id: tenant.id,
        type: 'payment',
        amount: -5000, // $50 payment (negative reduces balance)
        description: 'Test payment',
      });

      expect(error).toBeNull();

      // Check balance was updated by trigger
      const { data } = await supabase
        .from('tenants')
        .select('current_balance')
        .eq('id', tenant.id)
        .single();

      // Balance should be reduced by payment
      expect(data!.current_balance).toBe(5000); // $50 remaining

      // Cleanup
      await deleteTestTenant(tenant.id);
    });
  });

  describe('Transaction Logging', () => {
    test('should create transaction record for charge', async () => {
      const supabase = getSupabase();

      const response = await makeAuthenticatedTestRequest(CHARGE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: testTenant.id,
          amount_in_cents: 1500,
          description: 'Transaction log test',
        }),
      });

      if (response.status !== 201) {
        const errorData = await response.json();
        console.error('Charge API error:', response.status, errorData);
      }

      expect(response.status).toBe(201);

      // Verify transaction was logged
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('tenant_id', testTenant.id)
        .eq('description', 'Transaction log test');

      expect(transactions).toBeDefined();
      expect(transactions!.length).toBeGreaterThan(0);
      expect(transactions![0].amount).toBe(-1500); // Payment API stores charges as negative
      expect(transactions![0].type).toBe('payment');
    });
  });
});
