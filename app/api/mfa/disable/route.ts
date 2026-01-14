import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth } from '@/lib/auth';
import { z } from 'zod';

// Validation schema
const disableSchema = z.object({
  method_id: z.string().uuid(),
  confirmation_code: z.string().min(6), // Require MFA code to disable
});

export async function POST(request: NextRequest) {
  // Authenticate user
  const authResult = await withAuth(request);
  if (authResult.response) {
    return authResult.response;
  }

  const user = authResult.user!;

  try {
    const body = await request.json();
    const validatedData = disableSchema.parse(body);
    const { method_id, confirmation_code } = validatedData;

    const supabase = getSupabase();

    // Get MFA method
    const { data: method, error: methodError } = await supabase
      .from('mfa_methods')
      .select('*')
      .eq('id', method_id)
      .eq('user_id', user.id)
      .single();

    if (methodError || !method) {
      return NextResponse.json(
        { error: 'MFA method not found' },
        { status: 404 }
      );
    }

    // Verify confirmation code before disabling
    // This prevents unauthorized MFA removal if someone gains access to the session
    const verifyResponse = await fetch(`${request.nextUrl.origin}/api/mfa/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || ''
      },
      body: JSON.stringify({
        method_id,
        code: confirmation_code
      })
    });

    if (!verifyResponse.ok) {
      return NextResponse.json(
        { error: 'Invalid confirmation code' },
        { status: 401 }
      );
    }

    // Check if MFA is required for user's role
    const { data: isMfaRequired } = await supabase
      .rpc('is_mfa_required', { check_user_id: user.id });

    if (isMfaRequired) {
      // Count other active MFA methods
      const { data: otherMethods } = await supabase
        .from('mfa_methods')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('is_verified', true)
        .neq('id', method_id);

      if (!otherMethods || otherMethods.length === 0) {
        return NextResponse.json(
          { error: 'Cannot disable last MFA method. MFA is required for your role.' },
          { status: 400 }
        );
      }
    }

    // Disable the method
    const { error: updateError } = await supabase
      .from('mfa_methods')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', method_id);

    if (updateError) throw updateError;

    // If disabling backup codes, mark all as inactive
    if (method.method_type === 'backup_codes') {
      await supabase
        .from('mfa_backup_codes')
        .delete()
        .eq('user_id', user.id);
    }

    // Get client IP for logging
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Log MFA disabled event
    await supabase.rpc('log_auth_event', {
      p_user_id: user.id,
      p_email: user.email,
      p_event_type: 'mfa_disabled',
      p_ip_address: ip,
      p_user_agent: userAgent,
      p_mfa_method: method.method_type
    });

    return NextResponse.json({
      success: true,
      message: 'MFA method disabled successfully'
    });

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.issues
      }, { status: 400 });
    }

    console.error('MFA disable error:', error);
    return NextResponse.json(
      { error: 'Failed to disable MFA' },
      { status: 500 }
    );
  }
}
