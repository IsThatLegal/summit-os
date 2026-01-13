/**
 * Shared test utilities and helpers for integration tests
 */

import { getSupabase } from '@/lib/supabaseClient';

export const TEST_PREFIX = 'TEST_';

/**
 * Generate a unique test identifier to avoid collisions
 */
export function generateTestId(): string {
  return `${TEST_PREFIX}${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

/**
 * Generate a unique gate access code for testing
 */
export function generateTestGateCode(): string {
  return generateTestId().toUpperCase();
}

/**
 * Create a test tenant with given properties
 */
export async function createTestTenant(overrides: {
  first_name?: string;
  email?: string;
  phone?: string;
  current_balance?: number;
  gate_access_code?: string;
  is_locked_out?: boolean;
} = {}) {
  const supabase = getSupabase();
  const testId = generateTestId();

  const tenantData = {
    first_name: `Test_Tenant_${testId}`,
    email: `test_${testId}@example.com`,
    phone: `555-${testId.slice(-4)}`,
    current_balance: 0,
    gate_access_code: generateTestGateCode(),
    is_locked_out: false,
    ...overrides,
  };

  const { data, error } = await supabase
    .from('tenants')
    .insert(tenantData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a test unit with given properties
 */
export async function createTestUnit(overrides: {
  unit_number?: string;
  size?: string;
  monthly_price?: number;
  status?: string;
  door_type?: string;
} = {}) {
  const supabase = getSupabase();
  const testId = generateTestId();

  const unitData = {
    unit_number: `UNIT_${testId}`,
    size: '10x10',
    monthly_price: 10000, // $100 in cents
    status: 'available',
    door_type: 'roll-up',
    ...overrides,
  };

  const { data, error } = await supabase
    .from('units')
    .insert(unitData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete test tenant and associated records
 */
export async function deleteTestTenant(tenantId: string) {
  const supabase = getSupabase();

  // Delete associated records first
  await supabase.from('gate_logs').delete().eq('tenant_id', tenantId);
  await supabase.from('transactions').delete().eq('tenant_id', tenantId);

  // Delete the tenant
  const { error } = await supabase
    .from('tenants')
    .delete()
    .eq('id', tenantId);

  if (error) throw error;
}

/**
 * Delete test unit
 */
export async function deleteTestUnit(unitId: string) {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('units')
    .delete()
    .eq('id', unitId);

  if (error) throw error;
}

/**
 * Clean up all test data (tenants with TEST_ prefix)
 */
export async function cleanupAllTestData() {
  const supabase = getSupabase();

  // Get all test tenants
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .or(`first_name.ilike.${TEST_PREFIX}%,email.ilike.${TEST_PREFIX}%`);

  if (tenants && tenants.length > 0) {
    const tenantIds = tenants.map(t => t.id);

    // Delete associated records
    await supabase.from('gate_logs').delete().in('tenant_id', tenantIds);
    await supabase.from('transactions').delete().in('tenant_id', tenantIds);
    await supabase.from('tenants').delete().in('id', tenantIds);
  }

  // Clean up test units
  const { data: units } = await supabase
    .from('units')
    .select('id')
    .ilike('unit_number', `%${TEST_PREFIX}%`);

  if (units && units.length > 0) {
    const unitIds = units.map(u => u.id);
    await supabase.from('units').delete().in('id', unitIds);
  }
}

/**
 * Make an authenticated API request
 */
export async function makeAuthenticatedRequest(
  url: string,
  options: RequestInit = {},
  token?: string
) {
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Wait for async operation with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Generate test user credentials
 */
export function generateTestUser() {
  const testId = generateTestId();
  return {
    email: `test_user_${testId}@example.com`,
    password: `TestPassword123!${testId}`,
    firstName: `TestUser_${testId}`,
  };
}
