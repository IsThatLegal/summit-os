import { NextResponse, NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth, addSecurityHeaders } from '@/lib/auth';
import { rateLimits } from '@/lib/rateLimit';
import { z } from 'zod';

// Input validation schema
const moneyOrderSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant_id format'),
  amount_in_cents: z.number().int().positive('Amount must be a positive integer'),
  money_order_number: z.string().min(1, 'Money order number is required'),
  issuing_organization: z.string().min(1, 'Issuing organization is required'),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  verification_notes: z.string().optional()
});

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimits.payments(request);
  if (rateLimitResponse) {
    return addSecurityHeaders(rateLimitResponse);
  }

  // Authenticate and authorize user
  const auth = await withAuth(request, ['PROPERTY_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN', 'GATE_OPERATOR']);
  if (auth.response) {
    return addSecurityHeaders(auth.response);
  }

  try {
    const body = await request.json();
    
    // Validate input using Zod schema
    const validatedData = moneyOrderSchema.parse(body);
    const { 
      tenant_id, 
      amount_in_cents, 
      money_order_number, 
      issuing_organization, 
      description,
      verification_notes
    } = validatedData;
    
    const supabase = getSupabase();

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, first_name, email')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      return addSecurityHeaders(NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      ));
    }

    // Create transaction record first (so we have the ID for linking)
    // Note: Using 0 amount for pending money orders - balance updated when verified
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        tenant_id,
        type: 'payment',
        amount: 0, // Don't affect balance until money order is verified
        description: description || `Money order #${money_order_number}`,
        payment_method_id: null,
        payment_status: 'pending',
        reference_number: money_order_number,
        processed_by: auth.user?.email || 'unknown',
        notes: `Money order from ${issuing_organization} - Amount: $${(amount_in_cents / 100).toFixed(2)} (pending)`
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      return addSecurityHeaders(NextResponse.json(
        { error: 'Failed to create transaction record' },
        { status: 500 }
      ));
    }

    // Create money order payment record linked to transaction
    const { data: moneyOrderPayment, error: moneyOrderError } = await supabase
      .from('money_order_payments')
      .insert({
        transaction_id: transaction.id,
        money_order_number,
        issuing_organization,
        amount: amount_in_cents,
        status: 'pending',
        verification_notes,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (moneyOrderError) {
      console.error('Error creating money order payment record:', moneyOrderError);
      return addSecurityHeaders(NextResponse.json(
        { error: 'Failed to create money order payment record' },
        { status: 500 }
      ));
    }

    return addSecurityHeaders(NextResponse.json({
      message: 'Money order submitted for verification',
      transaction: transaction,
      money_order_payment: moneyOrderPayment,
      pending_amount: amount_in_cents,
      next_steps: [
        'Money order will be verified within 1-3 business days',
        'You will receive notification when verification is complete',
        'Tenant account will be updated when money order clears'
      ]
    }));

  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return addSecurityHeaders(NextResponse.json({
        error: 'Validation failed',
        details: error.issues
      }, { status: 400 }));
    }

    console.error('Money order processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Money order processing failed';
    return addSecurityHeaders(NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    ));
  }
}

// GET endpoint to retrieve money order payments
export async function GET(request: NextRequest) {
  // Authenticate and authorize user
  const auth = await withAuth(request, ['PROPERTY_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN']);
  if (auth.response) {
    return addSecurityHeaders(auth.response);
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const supabase = getSupabase();

    let query = supabase
      .from('money_order_payments')
      .select(`
        *,
        transactions!inner(
          id,
          tenant_id,
          amount,
          description,
          payment_status,
          created_at
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: moneyOrderPayments, error } = await query;

    if (error) {
      console.error('Error fetching money order payments:', error);
      return addSecurityHeaders(NextResponse.json(
        { error: 'Failed to fetch money order payments' },
        { status: 500 }
      ));
    }

    return addSecurityHeaders(NextResponse.json(moneyOrderPayments || []));

  } catch (error) {
    console.error('Money order fetch error:', error);
    return addSecurityHeaders(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}