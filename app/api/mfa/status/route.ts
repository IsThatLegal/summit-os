import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  // Authenticate user
  const authResult = await withAuth(request);
  if (authResult.response) {
    return authResult.response;
  }

  const user = authResult.user!;

  try {
    const supabase = getSupabase();

    // Get user's MFA methods (exclude sensitive data like secrets)
    const { data: methods, error: methodsError } = await supabase
      .from('mfa_methods')
      .select('id, method_type, phone_number, is_verified, is_active, created_at, verified_at, last_used_at')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (methodsError) throw methodsError;

    // Get backup codes count (unused ones)
    const { count: backupCodesCount } = await supabase
      .from('mfa_backup_codes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString());

    // Check if MFA is required for user's role
    const { data: hasMfaRequired } = await supabase
      .rpc('is_mfa_required', { check_user_id: user.id });

    const { data: hasMfaEnabled } = await supabase
      .rpc('has_mfa_enabled', { check_user_id: user.id });

    // Get MFA enforcement policy for user's role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, created_at')
      .eq('id', user.id)
      .single();

    let enforcementPolicy = null;
    if (profile) {
      const { data: policy } = await supabase
        .from('mfa_enforcement_policy')
        .select('*')
        .eq('role', profile.role)
        .single();

      if (policy) {
        const gracePeriodEnd = new Date(profile.created_at);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + policy.grace_period_days);

        enforcementPolicy = {
          required: policy.mfa_required,
          grace_period_days: policy.grace_period_days,
          grace_period_end: gracePeriodEnd.toISOString(),
          is_in_grace_period: new Date() < gracePeriodEnd
        };
      }
    }

    return NextResponse.json({
      mfa_enabled: hasMfaEnabled || false,
      mfa_required: hasMfaRequired || false,
      methods: methods || [],
      backup_codes_remaining: backupCodesCount || 0,
      enforcement_policy: enforcementPolicy,
      user_role: profile?.role
    });

  } catch (error: unknown) {
    console.error('MFA status error:', error);
    return NextResponse.json(
      { error: 'Failed to get MFA status' },
      { status: 500 }
    );
  }
}
