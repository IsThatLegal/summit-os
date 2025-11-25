import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  const { license_plate } = await request.json();

  if (!license_plate) {
    return NextResponse.json({ error: 'license_plate is required' }, { status: 400 });
  }

  // 1. Query for a tenant with this license_plate
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, first_name, current_balance, is_locked_out')
    .eq('license_plate', license_plate)
    .single();

  // 3. If not found...
  if (tenantError || !tenant) {
    // We can't associate this with a tenant, but we log the denied action.
    // In a real system, we might log the license plate itself to a different table.
    await supabase.from('gate_logs').insert({ action: 'entry_denied' });
    return NextResponse.json({ success: false, reason: 'License plate not recognized.' }, { status: 404 });
  }

  // 2. If found, check their status
  const isBalanceClear = tenant.current_balance <= 0;
  const isLockedOut = tenant.is_locked_out;

  if (isBalanceClear && !isLockedOut) {
    // If allowed, log entry_granted and return success
    await supabase.from('gate_logs').insert({ tenant_id: tenant.id, action: 'entry_granted' });
    return NextResponse.json({ success: true, tenant_name: tenant.first_name });
  } else {
    // If not allowed, log entry_denied and return failure
    await supabase.from('gate_logs').insert({ tenant_id: tenant.id, action: 'entry_denied' });
    return NextResponse.json({ success: false, reason: 'Access denied. Please check account status.' }, { status: 403 });
  }
}
