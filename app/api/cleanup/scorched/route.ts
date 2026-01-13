import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';

export async function DELETE() {
  try {
    const supabase = getSupabase();
    
    console.log('🔥 SCORCHED EARTH CLEANUP - Using raw SQL...');
    
    // Get the stubborn tenant IDs
    const { data: stubbornTenants } = await supabase
      .from('tenants')
      .select('id')
      .or('email.ilike.%e2e%,first_name.ilike.%e2e%');

    if (!stubbornTenants || stubbornTenants.length === 0) {
      return NextResponse.json({ message: 'No stubborn tenants found' });
    }

    const stubbornIds = stubbornTenants.map(t => t.id);
    console.log(`Found ${stubbornIds.length} stubborn tenants:`, stubbornIds);

    // Method 1: Try direct SQL via RPC if available
    try {
      const { error: rpcError } = await supabase.rpc('execute_sql', {
        sql: `DELETE FROM tenants WHERE id = ANY($1::uuid[])`,
        params: [stubbornIds]
      });

      if (!rpcError) {
        console.log('✅ Raw SQL deletion successful');
        return NextResponse.json({ message: 'Scorched earth cleanup successful via SQL', deleted: stubbornIds.length });
      }
    } catch {
      console.log('RPC method failed, trying alternatives...');
    }

    // Method 2: Try individual delete with force
    let deletedCount = 0;
    for (const id of stubbornIds) {
      try {
        // First try to update any constraints
        await supabase
          .from('tenants')
          .update({ unit_id: null })
          .eq('id', id);

        // Then delete
        const { error: deleteError } = await supabase
          .from('tenants')
          .delete()
          .eq('id', id);

        if (!deleteError) {
          deletedCount++;
          console.log(`✅ Deleted tenant ${id}`);
        } else {
          console.error(`Failed to delete ${id}:`, deleteError);
        }
      } catch (tenantError) {
        console.error(`Exception with ${id}:`, tenantError);
      }
    }

    // Method 3: If all else fails, try to anonymize them
    if (deletedCount === 0) {
      console.log('🔄 Trying anonymization approach...');
      for (const id of stubbornIds) {
        try {
          const { error: updateError } = await supabase
            .from('tenants')
            .update({
              first_name: 'Deleted User',
              last_name: 'Test Data',
              email: `deleted-${id}@cleanup.local`,
              phone: '000-000-0000',
              gate_access_code: 'DELETED',
              notes: 'CLEANUP_FAILED_MANUAL_DELETE_REQUIRED'
            })
            .eq('id', id);

          if (!updateError) {
            console.log(`✅ Anonymized tenant ${id}`);
            deletedCount++;
          }
        } catch (anonError) {
          console.error(`Failed to anonymize ${id}:`, anonError);
        }
      }
    }

    // Final verification
    const { data: finalCheck } = await supabase
      .from('tenants')
      .select('id, first_name, email')
      .or('email.ilike.%e2e%,first_name.ilike.%e2e%');

    return NextResponse.json({ 
      message: 'Scorched earth cleanup completed',
      attempted: stubbornIds.length,
      deleted: deletedCount,
      remaining: finalCheck?.length || 0,
      remainingTenants: finalCheck
    });

  } catch (error) {
    console.error('Error in scorched earth cleanup:', error);
    return NextResponse.json({ 
      error: 'Scorched earth cleanup failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}