import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';

// GET all units
export async function GET() {
  const supabase = getSupabase();
  
  try {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('unit_number');

    if (error) {
      console.error('Error fetching units:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform database data to match frontend interface
    const transformedData = data.map((unit: any, index: number) => ({
      id: unit.id,
      unitNumber: unit.unit_number,
      width: 10, // Default width since not stored in DB yet
      depth: 10, // Default depth since not stored in DB yet
      height: 8, // Default height since not stored in DB yet
      size: parseInt(unit.size) || 100,
      basePrice: unit.monthly_price,
      status: unit.status,
      doorType: unit.door_type === 'roll-up' ? 'roll_up' : 'swing',
      type: 'standard', // Default type since not stored in DB yet
      rotation: unit.rotation || 0, // Add rotation field
      x: (index % 6) * 20, // Grid spacing: 20px = 1 square foot
      y: Math.floor(index / 6) * 20, // Grid spacing: 20px = 1 square foot
    }));

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST new unit
export async function POST(request: Request) {
  const supabase = getSupabase();
  
  try {
    const body = await request.json();
    console.log('Received unit data:', body);
    
    const { 
      unitNumber, 
      width, 
      depth, 
      height, 
      size, 
      basePrice, 
      status, 
      doorType, 
      type, 
      x, 
      y,
      rotation
    } = body;

    // Map frontend field names to database field names
    // Only use fields that exist in current database schema
    const unitData = {
      unit_number: unitNumber,
      size: size ? size.toString() : (width && depth ? (width * depth).toString() : '100'),
      monthly_price: basePrice || 150,
      status: status || 'available',
      door_type: doorType === 'roll_up' ? 'roll-up' : 'swing',
      rotation: rotation || 0,
      width: width || 10,
      depth: depth || 10,
      height: height || 8,
      x: x || 0,
      y: y || 0
    };

    console.log('Processed unit data for database:', unitData);

    if (!unitData.unit_number || !unitData.size || !unitData.monthly_price || !unitData.status || !unitData.door_type) {
      return NextResponse.json({ 
        error: 'Missing required fields: unitNumber, size, basePrice, status, doorType',
        received: body,
        processed: unitData
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('units')
      .insert([unitData])
      .select()
      .single();

    if (error) {
      console.error('Error creating unit:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}