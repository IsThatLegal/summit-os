import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth } from '@/lib/auth';
import { z } from 'zod';
import { createHash } from 'crypto';
import { authenticator } from 'otplib';

// Validation schema
const verifySchema = z.object({
  method_id: z.string().uuid(),
  code: z.string().min(6),
});

// Hash a backup code for comparison
function hashBackupCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export async function POST(request: NextRequest) {
  // Authenticate user
  const authResult = await withAuth(request);
  if (authResult.response) {
    return authResult.response;
  }

  const user = authResult.user!;

  try {
    const body = await request.json();
    const validatedData = verifySchema.parse(body);
    const { method_id, code } = validatedData;

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

    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    let isValid = false;
    let mfaMethodUsed = method.method_type;

    switch (method.method_type) {
      case 'sms': {
        // In production, verify SMS code sent via Twilio
        // For now, accept any 6-digit code for testing
        isValid = /^\d{6}$/.test(code);

        // TODO: Implement actual SMS verification
        // const twilioVerified = await twilioClient.verify.services(VERIFY_SID)
        //   .verificationChecks.create({ to: method.phone_number, code });
        // isValid = twilioVerified.status === 'approved';

        break;
      }

      case 'totp': {
        // Verify TOTP code
        if (!method.secret) {
          throw new Error('TOTP secret not found');
        }

        // Configure TOTP with 30-second window
        authenticator.options = {
          window: 1 // Allow 1 time step before/after for clock drift
        };

        isValid = authenticator.verify({
          token: code,
          secret: method.secret
        });
        break;
      }

      case 'backup_codes': {
        // Check if backup code matches any unused code
        const codeHash = hashBackupCode(code.replace(/-/g, ''));

        const { data: backupCode } = await supabase
          .from('mfa_backup_codes')
          .select('*')
          .eq('user_id', user.id)
          .eq('code_hash', codeHash)
          .eq('is_used', false)
          .single();

        if (backupCode) {
          // Mark code as used
          await supabase
            .from('mfa_backup_codes')
            .update({
              is_used: true,
              used_at: new Date().toISOString()
            })
            .eq('id', backupCode.id);

          isValid = true;
          mfaMethodUsed = 'backup_code';
        }
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid MFA method type' },
          { status: 400 }
        );
    }

    // Log verification attempt
    await supabase
      .from('mfa_verification_attempts')
      .insert({
        user_id: user.id,
        method_type: method.method_type,
        success: isValid,
        ip_address: ip,
        user_agent: userAgent
      });

    if (!isValid) {
      // Check for multiple failed attempts (potential brute force)
      const { data: recentAttempts } = await supabase
        .from('mfa_verification_attempts')
        .select('*')
        .eq('user_id', user.id)
        .eq('success', false)
        .gte('attempted_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()); // Last 15 minutes

      if (recentAttempts && recentAttempts.length >= 5) {
        // Create security alert
        await supabase.rpc('create_security_alert', {
          p_alert_type: 'multiple_failed_logins',
          p_severity: 'high',
          p_description: `User ${user.email} had ${recentAttempts.length} failed MFA attempts in 15 minutes`,
          p_user_id: user.id,
          p_ip_address: ip,
          p_metadata: { method_type: method.method_type }
        });
      }

      // Log failed verification
      await supabase.rpc('log_auth_event', {
        p_user_id: user.id,
        p_email: user.email,
        p_event_type: 'mfa_verification_failed',
        p_ip_address: ip,
        p_user_agent: userAgent,
        p_mfa_method: method.method_type,
        p_failure_reason: 'Invalid code'
      });

      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 401 }
      );
    }

    // Valid code - mark method as verified if not already
    if (!method.is_verified) {
      await supabase
        .from('mfa_methods')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString()
        })
        .eq('id', method_id);

      // Log MFA enabled event
      await supabase.rpc('log_auth_event', {
        p_user_id: user.id,
        p_email: user.email,
        p_event_type: 'mfa_enabled',
        p_ip_address: ip,
        p_user_agent: userAgent,
        p_mfa_method: method.method_type
      });
    } else {
      // Log successful verification
      await supabase.rpc('log_auth_event', {
        p_user_id: user.id,
        p_email: user.email,
        p_event_type: 'mfa_verification_success',
        p_ip_address: ip,
        p_user_agent: userAgent,
        p_mfa_method: mfaMethodUsed
      });
    }

    // Update last used timestamp
    await supabase
      .from('mfa_methods')
      .update({
        last_used_at: new Date().toISOString()
      })
      .eq('id', method_id);

    // Count remaining backup codes if applicable
    let remainingBackupCodes = null;
    if (method.method_type === 'backup_codes') {
      const { count } = await supabase
        .from('mfa_backup_codes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_used', false);

      remainingBackupCodes = count || 0;
    }

    return NextResponse.json({
      success: true,
      message: 'MFA verification successful',
      method_verified: !method.is_verified, // True if this was first verification
      remaining_backup_codes: remainingBackupCodes
    });

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.issues
      }, { status: 400 });
    }

    console.error('MFA verification error:', error);
    return NextResponse.json(
      { error: 'MFA verification failed' },
      { status: 500 }
    );
  }
}
