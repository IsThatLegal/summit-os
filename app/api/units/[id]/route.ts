import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';

// Shared update logic for PATCH and PUT
async function updateUnit(
  request: Request,
  params: Promise<{ id: string }>
) {
  const { id } = await params;
  console.log('Updating unit with ID:', id);
  const supabase = getSupabase();

  try {
    const body = await request.json();
    console.log('Update request body:', body);

    // Support both camelCase (frontend) and snake_case (API/tests) field names
    const unitNumber = body.unitNumber || body.unit_number;
    const size = body.size;
    const basePrice = body.basePrice || body.monthly_price;
    const status = body.status;
    const doorType = body.doorType || body.door_type;
    const width = body.width;
    const depth = body.depth;
    const height = body.height;
    const x = body.x;
    const y = body.y;
    const rotation = body.rotation;

    const updateData: Record<string, string | number> = {};

    if (unitNumber !== undefined) updateData.unit_number = unitNumber;
    if (size !== undefined) updateData.size = size.toString();
    if (basePrice !== undefined) updateData.monthly_price = basePrice;
    if (status !== undefined) updateData.status = status;
    if (doorType !== undefined) updateData.door_type = doorType === 'roll_up' || doorType === 'roll-up' ? 'roll-up' : 'swing';
    if (width !== undefined) updateData.width = width;
    if (depth !== undefined) updateData.depth = depth;
    if (height !== undefined) updateData.height = height;
    if (x !== undefined) updateData.x = x;
    if (y !== undefined) updateData.y = y;
    if (rotation !== undefined) updateData.rotation = rotation;

    console.log('Update data for database:', updateData);

    // Check if unit exists first
    const { data: existingUnit, error: fetchError } = await supabase
      .from('units')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existingUnit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('units')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating unit:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH unit by ID (partial update)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return updateUnit(request, params);
}

// PUT unit by ID (full update)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return updateUnit(request, params);
}

// DELETE unit by ID
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabase();
  
  try {
    // First check if unit has a tenant
    const { data: unit } = await supabase
      .from('units')
      .select('tenant_id')
      .eq('id', id)
      .single();

    if (unit?.tenant_id) {
      return NextResponse.json({ 
        error: 'Cannot delete unit with active tenant' 
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('units')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting unit:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Unit deleted successfully' });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}