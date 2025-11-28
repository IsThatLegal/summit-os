import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  const supabase = getSupabase();
  
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  
  const { first_name, email, phone, current_balance, gate_access_code, is_locked_out, unit_id } = body;

  if (!first_name || !email || !phone || !gate_access_code) {
    return NextResponse.json({ error: 'Missing required fields: first_name, email, phone, gate_access_code' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tenants')
    .insert([{
      first_name,
      email,
      phone,
      unit_id: unit_id || null, // Handle optional unit_id
      current_balance: current_balance || 0,
      gate_access_code,
      // Auto-lock if created with a balance, otherwise respect the form input
      is_locked_out: (current_balance || 0) > 0 ? true : (is_locked_out || false)
    }])
    .select();

  if (error) {
    console.error('Error adding tenant:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data[0], { status: 201 });
}
