import { NextResponse, NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { addSecurityHeaders } from '@/lib/auth';
import { rateLimits } from '@/lib/rateLimit';
import { z } from 'zod';

// Input validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimits.auth(request);
  if (rateLimitResponse) {
    return addSecurityHeaders(rateLimitResponse);
  }

  // Get client info for logging
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const body = await request.json();

    // Validate input using Zod schema
    const validatedData = loginSchema.parse(body);
    const { email, password } = validatedData;

    const supabase = getSupabase();

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      // Log failed login attempt
      await supabase.rpc('log_auth_event', {
        p_user_id: null,
        p_email: email,
        p_event_type: 'login_failed',
        p_ip_address: ip,
        p_user_agent: userAgent,
        p_failure_reason: 'Invalid credentials'
      });

      return addSecurityHeaders(NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      ));
    }

    // Get user profile with role information
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, property_id')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      // Create default profile if it doesn't exist
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          email: authData.user.email!,
          role: 'TENANT' // Default role
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user profile:', createError);
        return addSecurityHeaders(NextResponse.json(
          { error: 'Authentication failed' },
          { status: 500 }
        ));
      }

      return addSecurityHeaders(NextResponse.json({
        token: authData.session.access_token,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role: newProfile.role,
          property_id: newProfile.property_id
        }
      }));
    }

    // For tenants, also fetch tenant-specific data
    let tenantData = null;
    if (profile.role === 'TENANT') {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('email', email)
        .single();

      if (tenant) {
        tenantData = {
          id: tenant.id,
          first_name: tenant.first_name,
          current_balance: tenant.current_balance,
          is_locked_out: tenant.is_locked_out,
          gate_access_code: tenant.gate_access_code
        };
      }
    }

    // Check MFA requirements
    const { data: mfaRequired } = await supabase
      .rpc('is_mfa_required', { check_user_id: authData.user.id });

    const { data: mfaEnabled } = await supabase
      .rpc('has_mfa_enabled', { check_user_id: authData.user.id });

    // If MFA is required but not enabled, include warning
    // If MFA is enabled, require verification before full access
    const mfaStatus = {
      required: mfaRequired || false,
      enabled: mfaEnabled || false,
      needs_setup: (mfaRequired && !mfaEnabled) || false,
      needs_verification: mfaEnabled || false
    };

    // Log successful login (initial step)
    await supabase.rpc('log_auth_event', {
      p_user_id: authData.user.id,
      p_email: authData.user.email,
      p_event_type: mfaEnabled ? 'login_success' : 'login_success', // Will log again after MFA
      p_ip_address: ip,
      p_user_agent: userAgent
    });

    return addSecurityHeaders(NextResponse.json({
      token: authData.session.access_token,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: profile.role,
        property_id: profile.property_id,
        tenant_data: tenantData
      },
      mfa: mfaStatus
    }));

  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return addSecurityHeaders(NextResponse.json({
        error: 'Validation failed',
        details: error.issues
      }, { status: 400 }));
    }

    console.error('Login error:', error);
    return addSecurityHeaders(NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    ));
  }
}