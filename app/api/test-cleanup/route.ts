import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';

// TEST-ONLY cleanup endpoint that bypasses authentication
// This endpoint is only available in development/test environments
export async function DELETE() {
  // Only allow in non-production environments
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({
      error: 'This endpoint is not available in production'
    }, { status: 403 });
  }

  try {
    console.log('🧹 Starting E2E test data cleanup (no auth)...');

    const supabase = getSupabase();

    // Delete by common test patterns
    const testPatterns = [
      '%e2e%', '%test%', '%E2E%', '%TEST%', '%movein_%', '%MoveIn%',
      '%Navigation Test%', '%Clear%', '%TEST_DATA%', '%example.com%',
      '%@test.com%', '%Testerson%'
    ];

    let totalDeleted = 0;
    let totalUnitsReset = 0;

    for (const pattern of testPatterns) {
      try {
        // Get tenants matching this pattern
        const { data: testTenants, error: fetchError } = await supabase
          .from('tenants')
          .select('id, unit_id')
          .or(`email.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern},gate_access_code.ilike.${pattern}`);

        if (!fetchError && testTenants && testTenants.length > 0) {
          console.log(`Found ${testTenants.length} tenants matching pattern: ${pattern}`);

          // Collect unit IDs to reset
          const unitIds = testTenants
            .filter(tenant => tenant.unit_id)
            .map(tenant => tenant.unit_id);

          // Reset units
          if (unitIds.length > 0) {
            const { error: unitError } = await supabase
              .from('units')
              .update({ status: 'available' })
              .in('id', unitIds);

            if (!unitError) {
              totalUnitsReset += unitIds.length;
            }
          }

          // Delete tenants
          const { error: deleteError } = await supabase
            .from('tenants')
            .delete()
            .or(`email.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern},gate_access_code.ilike.${pattern}`);

          if (!deleteError) {
            totalDeleted += testTenants.length;
          }
        }
      } catch (patternError) {
        console.warn(`Error with pattern ${pattern}:`, patternError);
      }
    }

    // Specific known test tenants
    const knownTestTenants = [
      'e2e@example.com',
      'clear@example.com',
      'nav@test.com',
      'valid@test.com'
    ];

    for (const email of knownTestTenants) {
      try {
        const { data: tenant, error: fetchError } = await supabase
          .from('tenants')
          .select('id, unit_id')
          .eq('email', email)
          .single();

        if (!fetchError && tenant) {
          console.log(`Found known test tenant: ${email}`);

          // Reset unit if exists
          if (tenant.unit_id) {
            await supabase
              .from('units')
              .update({ status: 'available' })
              .eq('id', tenant.unit_id);
            totalUnitsReset++;
          }

          // Delete tenant
          const { error: deleteError } = await supabase
            .from('tenants')
            .delete()
            .eq('email', email);

          if (!deleteError) {
            totalDeleted++;
          }
        }
      } catch (tenantError) {
        console.warn(`Error deleting tenant ${email}:`, tenantError);
      }
    }

    console.log(`🏁 Cleanup complete: ${totalDeleted} tenants, ${totalUnitsReset} units`);

    return NextResponse.json({
      message: 'Test data cleaned up successfully',
      tenantsDeleted: totalDeleted,
      unitsReset: totalUnitsReset
    });

  } catch (error) {
    console.error('Error in cleanup:', error);
    return NextResponse.json({
      error: 'Cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
