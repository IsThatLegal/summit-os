import { NextResponse, NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth, addSecurityHeaders } from '@/lib/auth';
import { rateLimits } from '@/lib/rateLimit';
import { z } from 'zod';

// Input validation schema
const tenantSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  email: z.string().email('Invalid email format'),
  phone: z.string().min(1, 'Phone number is required').max(20, 'Phone number too long'),
  current_balance: z.number().int().optional().default(0),
  gate_access_code: z.string().min(1, 'Gate access code is required').max(50, 'Access code too long'),
  is_locked_out: z.boolean().optional().default(false),
  unit_id: z.string().uuid().optional()
});

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimits.standard(request);
  if (rateLimitResponse) {
    return addSecurityHeaders(rateLimitResponse);
  }

  // Authenticate and authorize user
  const auth = await withAuth(request, ['PROPERTY_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN']);
  if (auth.response) {
    return addSecurityHeaders(auth.response);
  }

  try {
    const body = await request.json();
    
    // Validate input using Zod schema
    const validatedData = tenantSchema.parse(body);
    const { first_name, email, phone, current_balance, gate_access_code, is_locked_out, unit_id } = validatedData;
    
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('tenants')
      .insert([{
        first_name,
        email,
        phone,
        unit_id: unit_id || null, // Handle optional unit_id
        current_balance: current_balance || 0,
        gate_access_code,
        // Auto-lock if created with a balance, otherwise respect to form input
        is_locked_out: (current_balance || 0) > 0 ? true : (is_locked_out || false)
      }])
      .select();

    if (error) {
      console.error('Error adding tenant:', error);
      return addSecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }));
    }

    return addSecurityHeaders(NextResponse.json(data[0], { status: 201 }));

  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return addSecurityHeaders(NextResponse.json({
        error: 'Validation failed',
        details: error.issues
      }, { status: 400 }));
    }

    console.error('Error creating tenant:', error);
    return addSecurityHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}
