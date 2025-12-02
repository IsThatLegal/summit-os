import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';

export async function DELETE() {
  try {
    const supabase = getSupabase();
    
    console.log('🔥 NUKING ALL TEST TENANTS...');
    
    // Get ALL test tenants
    const { data: testTenants, error: fetchError } = await supabase
      .from('tenants')
      .select('id, unit_id, first_name, email')
      .or('email.ilike.%e2e%,email.ilike.%test%,first_name.ilike.%e2e%,first_name.ilike.%test%');

    if (fetchError) {
      throw new Error(`Failed to fetch test tenants: ${fetchError.message}`);
    }

    console.log(`Found ${testTenants?.length || 0} test tenants to delete`);

    if (!testTenants || testTenants.length === 0) {
      return NextResponse.json({ message: 'No test tenants found' });
    }

    // Step 1: Reset all their units
    const unitIds = testTenants
      .filter(tenant => tenant.unit_id)
      .map(tenant => tenant.unit_id);

    if (unitIds.length > 0) {
      console.log(`Resetting ${unitIds.length} units to available...`);
      const { error: unitError } = await supabase
        .from('units')
        .update({ status: 'available' })
        .in('id', unitIds);

      if (unitError) {
        console.error('Error resetting units:', unitError);
      } else {
        console.log('✅ Units reset successfully');
      }
    }

    // Step 2: Delete the tenants in batches
    const tenantIds = testTenants.map(tenant => tenant.id);
    console.log(`Deleting ${tenantIds.length} test tenants...`);

    // Delete in smaller batches to avoid timeouts
    const batchSize = 20;
    let totalDeleted = 0;

    for (let i = 0; i < tenantIds.length; i += batchSize) {
      const batch = tenantIds.slice(i, i + batchSize);
      console.log(`Deleting batch ${Math.floor(i/batchSize) + 1}: ${batch.length} tenants`);
      
      const { error: deleteError } = await supabase
        .from('tenants')
        .delete()
        .in('id', batch);

      if (deleteError) {
        console.error(`Error deleting batch ${Math.floor(i/batchSize) + 1}:`, deleteError);
      } else {
        totalDeleted += batch.length;
        console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} deleted successfully`);
      }
    }

    // Step 3: Verify cleanup
    const { data: remainingTenants } = await supabase
      .from('tenants')
      .select('id, first_name, email')
      .or('email.ilike.%e2e%,first_name.ilike.%e2e%');

    console.log(`Cleanup complete. Deleted: ${totalDeleted}, Remaining: ${remainingTenants?.length || 0}`);

    return NextResponse.json({ 
      message: 'Test tenant nuke completed',
      tenantsDeleted: totalDeleted,
      remainingTestTenants: remainingTenants?.length || 0,
      remainingTenants: remainingTenants
    });

  } catch (error) {
    console.error('Error in nuke operation:', error);
    return NextResponse.json({ 
      error: 'Nuke failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}