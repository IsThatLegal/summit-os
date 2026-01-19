import { NextResponse, NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth, addSecurityHeaders } from '@/lib/auth';

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // Authenticate and authorize user - only admins can delete tenants
  const auth = await withAuth(request, ['PROPERTY_ADMIN', 'SUPER_ADMIN']);
  if (auth.response) {
    return addSecurityHeaders(auth.response);
  }

  const supabase = getSupabase();
  const params = await context.params;
  const id = params.id;

  if (!id) {
    return addSecurityHeaders(NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 }));
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return addSecurityHeaders(NextResponse.json({ error: 'Invalid UUID format' }, { status: 400 }));
  }

  try {
    // Check if tenant exists
    const { data: existingTenant, error: fetchError } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existingTenant) {
      return addSecurityHeaders(NextResponse.json({ error: 'Tenant not found' }, { status: 404 }));
    }

    // Before deleting the tenant, delete any associated records due to foreign key constraints

    // Delete associated transactions
    const { error: deleteTransactionsError } = await supabase
      .from('transactions')
      .delete()
      .eq('tenant_id', id);

    if (deleteTransactionsError) {
      console.error('Error deleting associated transactions:', deleteTransactionsError);
      return addSecurityHeaders(NextResponse.json({ error: 'Failed to delete associated transactions.' }, { status: 500 }));
    }

    // Delete associated gate_logs
    const { error: deleteLogsError } = await supabase
      .from('gate_logs')
      .delete()
      .eq('tenant_id', id);

    if (deleteLogsError) {
      console.error('Error deleting associated gate logs:', deleteLogsError);
      return addSecurityHeaders(NextResponse.json({ error: 'Failed to delete associated gate logs.' }, { status: 500 }));
    }

    const { error: deleteTenantError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', id);

    if (deleteTenantError) {
      console.error('Error deleting tenant:', deleteTenantError);
      return addSecurityHeaders(NextResponse.json({ error: deleteTenantError.message }, { status: 500 }));
    }

    return addSecurityHeaders(NextResponse.json({ message: 'Tenant and associated logs deleted successfully.' }, { status: 200 }));

  } catch (error: unknown) {
    console.error('API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return addSecurityHeaders(NextResponse.json({ error: errorMessage }, { status: 500 }));
  }
}
