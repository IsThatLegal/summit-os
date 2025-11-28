import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';

export async function DELETE(request: Request, context: { params: any }) {
  const supabase = getSupabase();
  // This is an unconventional fix based on the specific error message from this Next.js version.
  const params = await context.params;
  const id = params.id;

  if (!id) {
    return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
  }

  try {
    // Before deleting the tenant, delete any associated records due to foreign key constraints
    
    // Delete associated transactions
    const { error: deleteTransactionsError } = await supabase
      .from('transactions')
      .delete()
      .eq('tenant_id', id);

    if (deleteTransactionsError) {
      console.error('Error deleting associated transactions:', deleteTransactionsError);
      return NextResponse.json({ error: 'Failed to delete associated transactions.' }, { status: 500 });
    }

    // Delete associated gate_logs
    const { error: deleteLogsError } = await supabase
      .from('gate_logs')
      .delete()
      .eq('tenant_id', id);

    if (deleteLogsError) {
      console.error('Error deleting associated gate logs:', deleteLogsError);
      return NextResponse.json({ error: 'Failed to delete associated gate logs.' }, { status: 500 });
    }

    const { error: deleteTenantError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', id);

    if (deleteTenantError) {
      console.error('Error deleting tenant:', deleteTenantError);
      return NextResponse.json({ error: deleteTenantError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Tenant and associated logs deleted successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
