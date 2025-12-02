import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';

// PATCH unit by ID
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('Updating unit with ID:', id);
  const supabase = getSupabase();
  
  try {
    const body = await request.json();
    console.log('Update request body:', body);
    
    // Map frontend field names to database field names
    const { 
      unitNumber, 
      size, 
      basePrice, 
      status, 
      doorType,
      width,
      depth,
      height,
      x,
      y,
      rotation
    } = body;

    const updateData: any = {};
    
    if (unitNumber !== undefined) updateData.unit_number = unitNumber;
    if (size !== undefined) updateData.size = size.toString();
    if (basePrice !== undefined) updateData.monthly_price = basePrice;
    if (status !== undefined) updateData.status = status;
    if (doorType !== undefined) updateData.door_type = doorType === 'roll_up' ? 'roll-up' : 'swing';
    if (width !== undefined) updateData.width = width;
    if (depth !== undefined) updateData.depth = depth;
    if (height !== undefined) updateData.height = height;
    if (x !== undefined) updateData.x = x;
    if (y !== undefined) updateData.y = y;
    if (rotation !== undefined) updateData.rotation = rotation;

    console.log('Update data for database:', updateData);

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