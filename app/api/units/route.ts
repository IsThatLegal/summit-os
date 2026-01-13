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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // Support both camelCase (frontend) and snake_case (API/tests) field names
    const unitNumber = body.unitNumber || body.unit_number;
    const basePrice = body.basePrice || body.monthly_price;
    const doorType = body.doorType || body.door_type;
    const width = body.width;
    const depth = body.depth;
    const height = body.height;
    const size = body.size;
    const status = body.status;
    const x = body.x;
    const y = body.y;
    const rotation = body.rotation;

    // Validate door_type
    const validDoorTypes = ['roll-up', 'roll_up', 'swing'];
    if (doorType && !validDoorTypes.includes(doorType)) {
      return NextResponse.json({
        error: 'Invalid door_type. Must be one of: roll-up, swing',
        received: doorType
      }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['available', 'occupied', 'maintenance', 'reserved'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({
        error: 'Invalid status. Must be one of: available, occupied, maintenance, reserved',
        received: status
      }, { status: 400 });
    }

    // Map to database field names
    const unitData = {
      unit_number: unitNumber,
      size: size ? size.toString() : (width && depth ? (width * depth).toString() : '100'),
      monthly_price: basePrice,
      status: status || 'available',
      door_type: doorType === 'roll_up' || doorType === 'roll-up' ? 'roll-up' : 'swing',
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