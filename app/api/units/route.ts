import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function POST(request: Request) {
  const { unit_number, size, monthly_price, status, door_type } = await request.json();

  if (!unit_number || !size || !monthly_price || !status || !door_type) {
    return NextResponse.json({ error: 'Missing required fields: unit_number, size, monthly_price, status, door_type' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('units')
    .insert([{
      unit_number,
      size,
      monthly_price: parseInt(monthly_price), // Ensure monthly_price is an integer
      status,
      door_type
    }])
    .select();

  if (error) {
    console.error('Error adding unit:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data[0], { status: 201 });
}
