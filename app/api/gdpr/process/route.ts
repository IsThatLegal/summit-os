import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth } from '@/lib/auth';
import { z } from 'zod';

// Process GDPR request schema
const processSchema = z.object({
  request_id: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'complete']),
  rejection_reason: z.string().optional(),
  data_export_url: z.string().url().optional(), // For data portability/access requests
});

// Admin endpoint to process GDPR requests
export async function POST(request: NextRequest) {
  // Authenticate user (requires SUPER_ADMIN or PROPERTY_ADMIN role)
  const authResult = await withAuth(request, ['SUPER_ADMIN', 'PROPERTY_ADMIN']);
  if (authResult.response) {
    return authResult.response;
  }

  const user = authResult.user!;

  try {
    const body = await request.json();
    const validatedData = processSchema.parse(body);

    const supabase = getSupabase();

    // Get the GDPR request
    const { data: gdprRequest, error: fetchError } = await supabase
      .from('gdpr_requests')
      .select('*')
      .eq('id', validatedData.request_id)
      .single();

    if (fetchError || !gdprRequest) {
      return NextResponse.json(
        { error: 'GDPR request not found' },
        { status: 404 }
      );
    }

    let updateData: {
      status: string;
      completed_by?: string;
      completed_at?: string;
      rejection_reason?: string;
      data_export_url?: string;
    } = {
      status: 'in_progress'
    };

    switch (validatedData.action) {
      case 'approve':
        updateData.status = 'in_progress';
        break;

      case 'reject':
        if (!validatedData.rejection_reason) {
          return NextResponse.json({
            error: 'Rejection reason is required'
          }, { status: 400 });
        }
        updateData = {
          status: 'rejected',
          completed_by: user.id,
          completed_at: new Date().toISOString(),
          rejection_reason: validatedData.rejection_reason
        };
        break;

      case 'complete':
        updateData = {
          status: 'completed',
          completed_by: user.id,
          completed_at: new Date().toISOString()
        };

        // For access and portability requests, require data export URL
        if (['access', 'portability'].includes(gdprRequest.request_type)) {
          if (!validatedData.data_export_url) {
            return NextResponse.json({
              error: 'Data export URL is required for access/portability requests'
            }, { status: 400 });
          }
          updateData.data_export_url = validatedData.data_export_url;
        }

        // For erasure requests, actually delete the data (with safeguards)
        if (gdprRequest.request_type === 'erasure') {
          await performDataErasure(supabase, gdprRequest.user_id, user.id);
        }
        break;
    }

    // Update the request
    const { data: updatedRequest, error: updateError } = await supabase
      .from('gdpr_requests')
      .update(updateData)
      .eq('id', validatedData.request_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log the action
    await supabase.rpc('log_auth_event', {
      p_user_id: user.id,
      p_email: user.email,
      p_event_type: 'account_unlocked', // Repurposing for admin action
      p_failure_reason: `GDPR request ${validatedData.action}: ${gdprRequest.request_type}`
    });

    return NextResponse.json({
      success: true,
      request: updatedRequest,
      message: `GDPR request ${validatedData.action}d successfully`
    });

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.issues
      }, { status: 400 });
    }

    console.error('GDPR process error:', error);
    return NextResponse.json(
      { error: 'Failed to process GDPR request' },
      { status: 500 }
    );
  }
}

// Helper function to perform data erasure (soft delete with anonymization)
async function performDataErasure(supabase: ReturnType<typeof getSupabase>, userId: string, deletedBy: string) {
  const now = new Date().toISOString();

  // Soft delete tenant records
  await supabase
    .from('tenants')
    .update({
      first_name: 'DELETED',
      email: `deleted_${userId}@anonymized.local`,
      phone: 'DELETED',
      deleted_at: now,
      deleted_by: deletedBy
    })
    .eq('id', userId);

  // Soft delete payment methods
  await supabase
    .from('payment_methods')
    .update({
      deleted_at: now,
      is_active: false
    })
    .eq('tenant_id', userId);

  // Anonymize user profile
  await supabase
    .from('user_profiles')
    .update({
      email: `deleted_${userId}@anonymized.local`
    })
    .eq('id', userId);

  // Note: Keep financial transaction records for legal compliance (7 years)
  // but anonymize personal identifiers
  // Keep audit logs for compliance

  // Disable MFA methods
  await supabase
    .from('mfa_methods')
    .update({
      is_active: false,
      phone_number: 'DELETED'
    })
    .eq('user_id', userId);

  // Delete Supabase auth user (will cascade to related data)
  // This requires service role key, so we'll need to handle this separately
  // or use a Supabase Edge Function
}
