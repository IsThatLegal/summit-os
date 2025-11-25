import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function POST(request: Request) {
  const { gate_access_code } = await request.json();

  if (!gate_access_code) {
    return NextResponse.json({ error: 'gate_access_code is required' }, { status: 400 });
  }

  // Find the tenant with the given access code
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('gate_access_code', gate_access_code)
    .single();

  if (tenantError || !tenant) {
    // Log the failed attempt. Since we don't have a tenant_id, we can't log it against a specific tenant.
    // In a real-world scenario, you might log this to a separate table for unknown access attempts.
    return NextResponse.json({ access: 'denied', reason: 'Invalid access code.' }, { status: 403 });
  }

  // Check if tenant's balance is clear and they are not locked out
  const isBalanceClear = tenant.current_balance <= 0;
  const isLockedOut = tenant.is_locked_out;

  if (isBalanceClear && !isLockedOut) {
    // Log the successful entry
    await supabase.from('gate_logs').insert({ tenant_id: tenant.id, action: 'entry' });
    return NextResponse.json({ access: 'granted' });
  } else {
    // Log the denied entry
    await supabase.from('gate_logs').insert({ tenant_id: tenant.id, action: 'denied_payment' });
    
    let reason = 'Access denied.';
    if (isLockedOut) {
      reason = 'Account locked. Please contact management.';
    } else if (!isBalanceClear) {
      reason = `Access denied due to outstanding balance of $${tenant.current_balance}.`;
    }
    
    return NextResponse.json({ access: 'denied', reason: reason }, { status: 403 });
  }
}
