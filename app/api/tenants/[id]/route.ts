import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  // This is an unconventional fix based on the specific error message from this Next.js version.
  const params = await context.params;
  const id = params.id;

  if (!id) {
    return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: 'Invalid UUID format' }, { status: 400 });
  }

  try {
    // Check if tenant exists
    const { data: existingTenant, error: fetchError } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existingTenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

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

  } catch (error: unknown) {
    console.error('API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
