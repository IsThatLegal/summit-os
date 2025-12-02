import { NextResponse, NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { addSecurityHeaders } from '@/lib/auth';
import { rateLimits } from '@/lib/rateLimit';
import { z } from 'zod';

// Input validation schema
const gateAccessSchema = z.object({
  gate_access_code: z.string().min(1, 'Gate access code is required').max(50, 'Access code too long')
});

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimits.gateAccess(request);
  if (rateLimitResponse) {
    return addSecurityHeaders(rateLimitResponse);
  }

  // Note: Gate access endpoint is intentionally unauthenticated for hardware integration
  // Security is provided through rate limiting and input validation
  
  try {
    const body = await request.json();
    
    // Validate input using Zod schema
    const validatedData = gateAccessSchema.parse(body);
    const { gate_access_code } = validatedData;
    
    const supabase = getSupabase();

  // Find the tenant with the given access code
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('gate_access_code', gate_access_code)
    .single();

  if (tenantError || !tenant) {
    // Log the failed attempt. Since we don't have a tenant_id, we can't log it against a specific tenant.
    // In a real-world scenario, you might log this to a separate table for unknown access attempts.
    return addSecurityHeaders(NextResponse.json({ access: 'denied', reason: 'Invalid access code.' }, { status: 403 }));
  }

  // Check if tenant's balance is clear and they are not locked out
  const isBalanceClear = tenant.current_balance <= 0;
  const isLockedOut = tenant.is_locked_out;

  if (isBalanceClear && !isLockedOut) {
    // Log the successful entry
    await supabase.from('gate_logs').insert({ tenant_id: tenant.id, action: 'entry_granted' });
    return addSecurityHeaders(NextResponse.json({ access: 'granted' }));
  } else {
    // Log the denied entry
    await supabase.from('gate_logs').insert({ tenant_id: tenant.id, action: 'entry_denied' });
    
    let reason = 'Access denied.';
    if (isLockedOut) {
      reason = 'Account locked. Please contact management.';
    } else if (!isBalanceClear) {
      reason = `Access denied due to outstanding balance of $${tenant.current_balance}.`;
    }
    
    return addSecurityHeaders(NextResponse.json({ access: 'denied', reason: reason }, { status: 403 }));
  }
  
  } catch (error: any) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return addSecurityHeaders(NextResponse.json({ 
        error: 'Validation failed', 
        details: error.issues 
      }, { status: 400 }));
    }
    
    console.error('Gate access error:', error);
    return addSecurityHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}
