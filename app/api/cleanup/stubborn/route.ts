import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';

export async function DELETE() {
  try {
    const supabase = getSupabase();
    
    // Get the stubborn test tenants
    const { data: stubbornTenants } = await supabase
      .from('tenants')
      .select('id, unit_id, first_name, email')
      .or('email.ilike.%e2e%,first_name.ilike.%e2e%');

    if (!stubbornTenants || stubbornTenants.length === 0) {
      return NextResponse.json({ message: 'No stubborn tenants found' });
    }

    console.log(`Found ${stubbornTenants.length} stubborn tenants`);

    let deletedCount = 0;
    let errorCount = 0;

    // Delete each one individually with detailed logging
    for (const tenant of stubbornTenants) {
      try {
        console.log(`Attempting to delete: ${tenant.first_name} (${tenant.email}) - ID: ${tenant.id}`);
        
        // Reset unit first
        if (tenant.unit_id) {
          const { error: unitError } = await supabase
            .from('units')
            .update({ status: 'available' })
            .eq('id', tenant.unit_id);
          
          if (unitError) {
            console.error(`Failed to reset unit ${tenant.unit_id}:`, unitError);
          }
        }

        // Delete tenant
        const { error: deleteError } = await supabase
          .from('tenants')
          .delete()
          .eq('id', tenant.id);

        if (deleteError) {
          console.error(`Failed to delete tenant ${tenant.id}:`, deleteError);
          errorCount++;
        } else {
          console.log(`✅ Successfully deleted tenant ${tenant.id}`);
          deletedCount++;
        }
      } catch (tenantError) {
        console.error(`Exception deleting tenant ${tenant.id}:`, tenantError);
        errorCount++;
      }
    }

    // Verify final state
    const { data: remainingTenants } = await supabase
      .from('tenants')
      .select('id, first_name, email')
      .or('email.ilike.%e2e%,first_name.ilike.%e2e%');

    return NextResponse.json({ 
      message: 'Stubborn tenant cleanup completed',
      attempted: stubbornTenants.length,
      deleted: deletedCount,
      errors: errorCount,
      remaining: remainingTenants?.length || 0,
      remainingTenants: remainingTenants
    });

  } catch (error) {
    console.error('Error in stubborn cleanup:', error);
    return NextResponse.json({ 
      error: 'Stubborn cleanup failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}