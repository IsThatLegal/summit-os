import { NextResponse, NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth, addSecurityHeaders } from '@/lib/auth';
import { rateLimits } from '@/lib/rateLimit';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await context.params;
  // Apply rate limiting
  const rateLimitResponse = rateLimits.standard(request);
  if (rateLimitResponse) {
    return addSecurityHeaders(rateLimitResponse);
  }

  // Authenticate and authorize user
  const auth = await withAuth(request, ['TENANT', 'PROPERTY_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN']);
  if (auth.response) {
    return addSecurityHeaders(auth.response);
  }

  try {
    // tenantId is already extracted above
    const supabase = getSupabase();

    // Tenants can only view their own transactions
    if (auth.user?.role === 'TENANT') {
      // Verify this tenant belongs to the authenticated user
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', tenantId)
        .eq('email', auth.user.email)
        .single();

      if (tenantError || !tenant) {
        return addSecurityHeaders(NextResponse.json(
          { error: 'Tenant not found or access denied' },
          { status: 404 }
        ));
      }
    }

    // Fetch transactions for this tenant
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50); // Limit to last 50 transactions

    if (error) {
      console.error('Error fetching transactions:', error);
      return addSecurityHeaders(NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      ));
    }

    return addSecurityHeaders(NextResponse.json(transactions || []));

  } catch (error) {
    console.error('Transaction fetch error:', error);
    return addSecurityHeaders(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}