import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth } from '@/lib/auth';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';

// Validation schema
const enrollSchema = z.object({
  method_type: z.enum(['sms', 'totp', 'backup_codes']),
  phone_number: z.string().optional(), // Required for SMS
});

// Generate TOTP secret (32 character base32 string)
function generateTOTPSecret(): string {
  const buffer = randomBytes(20);
  return buffer.toString('base32').substring(0, 32);
}

// Generate backup codes (8 codes, 12 characters each)
function generateBackupCodes(): string[] {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    const code = randomBytes(6).toString('hex').toUpperCase();
    codes.push(`${code.substring(0, 4)}-${code.substring(4, 8)}-${code.substring(8, 12)}`);
  }
  return codes;
}

// Hash a backup code for storage
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
    const validatedData = enrollSchema.parse(body);
    const { method_type, phone_number } = validatedData;

    // Validate phone number for SMS
    if (method_type === 'sms' && !phone_number) {
      return NextResponse.json(
        { error: 'Phone number is required for SMS MFA' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Check if method already exists
    const { data: existingMethod } = await supabase
      .from('mfa_methods')
      .select('*')
      .eq('user_id', user.id)
      .eq('method_type', method_type)
      .single();

    if (existingMethod && existingMethod.is_verified) {
      return NextResponse.json(
        { error: 'MFA method already enrolled and verified' },
        { status: 400 }
      );
    }

    let responseData: Record<string, unknown> = {};

    switch (method_type) {
      case 'sms': {
        // In production, integrate with Twilio to send SMS verification code
        // For now, we'll create the record and return a test code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Store or update method
        const { data: method, error } = await supabase
          .from('mfa_methods')
          .upsert({
            user_id: user.id,
            method_type: 'sms',
            phone_number,
            is_verified: false,
            is_active: true
          }, { onConflict: 'user_id,method_type' })
          .select()
          .single();

        if (error) throw error;

        // TODO: Send SMS via Twilio
        // await sendSMS(phone_number, `Your Summit OS verification code is: ${verificationCode}`);

        responseData = {
          message: 'SMS verification code sent',
          method_id: method.id,
          // In production, remove this test code
          test_code: verificationCode,
          note: 'In production, code will be sent via SMS'
        };
        break;
      }

      case 'totp': {
        const secret = generateTOTPSecret();
        const appName = 'SummitOS';
        const otpauthUrl = `otpauth://totp/${appName}:${user.email}?secret=${secret}&issuer=${appName}`;

        // Store method with secret
        const { data: method, error } = await supabase
          .from('mfa_methods')
          .upsert({
            user_id: user.id,
            method_type: 'totp',
            secret, // In production, encrypt this
            is_verified: false,
            is_active: true
          }, { onConflict: 'user_id,method_type' })
          .select()
          .single();

        if (error) throw error;

        responseData = {
          message: 'TOTP secret generated',
          method_id: method.id,
          secret,
          qr_code_url: otpauthUrl,
          manual_entry_key: secret,
          note: 'Scan QR code with authenticator app (Google Authenticator, Authy, etc.)'
        };
        break;
      }

      case 'backup_codes': {
        // Generate backup codes
        const codes = generateBackupCodes();

        // Hash and store codes
        const codeInserts = codes.map(code => ({
          user_id: user.id,
          code_hash: hashBackupCode(code),
          is_used: false
        }));

        const { error: codesError } = await supabase
          .from('mfa_backup_codes')
          .insert(codeInserts);

        if (codesError) throw codesError;

        // Create method record
        const { data: method, error: methodError } = await supabase
          .from('mfa_methods')
          .upsert({
            user_id: user.id,
            method_type: 'backup_codes',
            is_verified: true, // Backup codes are auto-verified
            is_active: true,
            verified_at: new Date().toISOString()
          }, { onConflict: 'user_id,method_type' })
          .select()
          .single();

        if (methodError) throw methodError;

        // Log MFA enabled event
        await supabase.rpc('log_auth_event', {
          p_user_id: user.id,
          p_email: user.email,
          p_event_type: 'mfa_enabled',
          p_mfa_method: 'backup_codes'
        });

        responseData = {
          message: 'Backup codes generated',
          method_id: method.id,
          backup_codes: codes,
          note: 'Save these codes in a secure location. Each can only be used once.'
        };
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid MFA method type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      ...responseData
    });

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.issues
      }, { status: 400 });
    }

    console.error('MFA enrollment error:', error);
    return NextResponse.json(
      { error: 'MFA enrollment failed' },
      { status: 500 }
    );
  }
}
