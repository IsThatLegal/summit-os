import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';

export async function DELETE() {
  try {
    const supabase = getSupabase();
    
    console.log('🔥 Running aggressive SQL cleanup...');
    
    // Direct SQL approach to catch everything
    const cleanupSQL = `
      -- Update units back to available before deleting tenants
      UPDATE units 
      SET status = 'available' 
      WHERE id IN (
        SELECT unit_id 
        FROM tenants 
        WHERE 
          email ILIKE '%e2e%' OR 
          email ILIKE '%test%' OR 
          email ILIKE '%example.com%' OR
          first_name ILIKE '%e2e%' OR 
          first_name ILIKE '%test%' OR
          gate_access_code ILIKE '%e2e%' OR
          phone ILIKE '%555-E2E%' OR
          phone ILIKE '%555-CLEAR%' OR
          phone ILIKE '%555-TEST%'
      ) AND unit_id IS NOT NULL;

      -- Delete test tenants
      DELETE FROM tenants 
      WHERE 
        email ILIKE '%e2e%' OR 
        email ILIKE '%test%' OR 
        email ILIKE '%example.com%' OR
        first_name ILIKE '%e2e%' OR 
        first_name ILIKE '%test%' OR
        gate_access_code ILIKE '%e2e%' OR
        phone ILIKE '%555-E2E%' OR
        phone ILIKE '%555-CLEAR%' OR
        phone ILIKE '%555-TEST%';
    `;

    // Execute the cleanup
    const { error: sqlError } = await supabase.rpc('exec_sql', { sql: cleanupSQL });
    
    if (sqlError) {
      console.log('SQL RPC failed, trying individual operations...');
      
      // Fallback: Individual operations
      const { data: testTenants } = await supabase
        .from('tenants')
        .select('id, unit_id, first_name, email')
        .or('email.ilike.%e2e%,email.ilike.%test%,first_name.ilike.%e2e%,first_name.ilike.%test%');

      console.log('Found test tenants:', testTenants);

      if (testTenants && testTenants.length > 0) {
        // Reset units
        const unitIds = testTenants.filter(t => t.unit_id).map(t => t.unit_id);
        if (unitIds.length > 0) {
          await supabase.from('units').update({ status: 'available' }).in('id', unitIds);
        }

        // Delete tenants
        const tenantIds = testTenants.map(t => t.id);
        await supabase.from('tenants').delete().in('id', tenantIds);
      }
    }

    // Check remaining tenants
    const { data: remainingTenants } = await supabase
      .from('tenants')
      .select('id, first_name, email')
      .or('email.ilike.%e2e%,first_name.ilike.%e2e%');

    console.log('Remaining test tenants after cleanup:', remainingTenants);

    return NextResponse.json({ 
      message: 'Aggressive cleanup completed',
      remainingTestTenants: remainingTenants?.length || 0,
      tenants: remainingTenants
    });

  } catch (error) {
    console.error('Error in aggressive cleanup:', error);
    return NextResponse.json({ 
      error: 'Aggressive cleanup failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}