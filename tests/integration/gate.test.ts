import { supabase } from '../../lib/supabaseClient';

const API_URL = 'http://localhost:3000/api/gate/access';

describe('Gate Access API - Integration Test', () => {

  // Create test tenants before all tests run
  beforeAll(async () => {
    console.log('Ensuring clean state: Deleting existing test tenants and logs...');
    // Get IDs of test tenants if they exist
    const { data: existingTenants, error: fetchError } = await supabase
      .from('tenants')
      .select('id')
      .in('gate_access_code', ['TEST_9999', 'TEST_0000']);

    if (fetchError) {
      console.error('Error fetching existing tenants for cleanup:', fetchError);
      throw fetchError;
    }

    const existingTenantIds = existingTenants.map(t => t.id);

    if (existingTenantIds.length > 0) {
      // First, delete associated gate_logs
      const { error: deleteLogsError } = await supabase
        .from('gate_logs')
        .delete()
        .in('tenant_id', existingTenantIds);

      if (deleteLogsError) {
        console.error('Error deleting existing gate logs:', deleteLogsError);
        throw deleteLogsError;
      }
      console.log('Existing gate logs cleaned up.');

      // Then, delete the tenants
      const { error: deleteTenantsError } = await supabase
        .from('tenants')
        .delete()
        .in('id', existingTenantIds);

      if (deleteTenantsError) {
        console.error('Error deleting existing tenants:', deleteTenantsError);
        throw deleteTenantsError;
      }
      console.log('Existing test tenants cleaned up.');
    } else {
      console.log('No existing test tenants found for initial cleanup.');
    }

    console.log('Creating test tenants...');
    const { error: insertError } = await supabase.from('tenants').insert([
      { 
        first_name: 'Paid Tenant',
        email: 'paid@test.com',
        phone: '555-0101',
        current_balance: 0,
        gate_access_code: 'TEST_9999',
        is_locked_out: false
      },
      { 
        first_name: 'Late Tenant',
        email: 'late@test.com',
        phone: '555-0102',
        current_balance: 100,
        gate_access_code: 'TEST_0000',
        is_locked_out: false
      }
    ]); 

    if (insertError) {
      console.error('Error creating test tenants:', insertError);
      throw insertError;
    }
    console.log('Test tenants created successfully.');
  }, 20000); // Increased timeout for beforeAll due to multiple operations

  // Test 1: Should grant access for a paid tenant
  test('should grant access for a paid tenant', async () => {
    console.log('Testing access for TEST_9999 (Paid Tenant)...');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gate_access_code: 'TEST_9999' }),
    });

    const data = await response.json();
    console.log('Response status (granted):', response.status);
    console.log('Response body (granted):', data);

    expect(response.status).toBe(200);
    expect(data.access).toBe('granted');
  }, 10000); 

  // Test 2: Should deny access for a late tenant
  test('should deny access for a late tenant with an outstanding balance', async () => {
    console.log('Testing access for TEST_0000 (Late Tenant)...');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gate_access_code: 'TEST_0000' }),
    });

    const data = await response.json();
    console.log('Response status (denied):', response.status);
    console.log('Response body (denied):', data);

    expect(response.status).toBe(403);
    expect(data.access).toBe('denied');
    expect(data.reason).toContain('outstanding balance');
  }, 10000); 

  // Clean up by deleting the test tenants after all tests have run
  afterAll(async () => {
    console.log('Cleaning up test tenants and logs...');
    // Get IDs of test tenants
    const { data: existingTenants, error: fetchError } = await supabase
      .from('tenants')
      .select('id')
      .in('gate_access_code', ['TEST_9999', 'TEST_0000']);

    if (fetchError) {
      console.error('Error fetching existing tenants for final cleanup:', fetchError);
      throw fetchError;
    }

    const existingTenantIds = existingTenants.map(t => t.id);

    if (existingTenantIds.length > 0) {
      // First, delete associated gate_logs
      const { error: deleteLogsError } = await supabase
        .from('gate_logs')
        .delete()
        .in('tenant_id', existingTenantIds);

      if (deleteLogsError) {
        console.error('Error deleting final gate logs:', deleteLogsError);
        throw deleteLogsError;
      }
      console.log('Final gate logs cleaned up.');

      // Then, delete the tenants
      const { error: deleteTenantsError } = await supabase
        .from('tenants')
        .delete()
        .in('id', existingTenantIds);

      if (deleteTenantsError) {
        console.error('Error deleting final tenants:', deleteTenantsError);
        throw deleteTenantsError;
      }
      console.log('Test tenants cleaned up successfully.');
    } else {
      console.log('No test tenants to clean up after tests.');
    }
  }, 20000); // Increased timeout for afterAll
});