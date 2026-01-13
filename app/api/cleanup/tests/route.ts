import { NextResponse, NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth, addSecurityHeaders } from '@/lib/auth';

export async function DELETE(request: NextRequest) {
  // Authenticate and authorize user (only admins can cleanup)
  const auth = await withAuth(request, ['SUPER_ADMIN', 'PROPERTY_ADMIN']);
  if (auth.response) {
    return addSecurityHeaders(auth.response);
  }
  try {
    console.log('🧹 Starting aggressive test data cleanup...');
    
    // Try multiple approaches to clean up test data
    const supabase = getSupabase();
    
    // Approach 1: Delete by common test patterns
    const testPatterns = [
      '%e2e%', '%test%', '%E2E%', '%TEST%', '%movein_%', '%MoveIn%', 
      '%Navigation Test%', '%Clear%', '%TEST_DATA%', '%example.com%'
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

    // Approach 2: Specific known test tenants
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

    // Approach 3: Clean up any units with test-like unit numbers
    try {
      const { data: testUnits } = await supabase
        .from('units')
        .select('id, unit_number')
        .or('unit_number.ilike.%A101%,unit_number.ilike.%A102%,unit_number.ilike.%B101%');

      if (testUnits && testUnits.length > 0) {
        const { error: unitResetError } = await supabase
          .from('units')
          .update({ status: 'available' })
          .in('id', testUnits.map((u: { id: string }) => u.id));

        if (!unitResetError) {
          totalUnitsReset += testUnits.length;
        }
      }
    } catch (unitError) {
      console.warn('Error resetting test units:', unitError);
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