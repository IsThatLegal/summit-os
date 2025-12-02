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

    // Create money order payment record
    const { data: moneyOrderPayment, error: moneyOrderError } = await supabase
      .from('money_order_payments')
      .insert({
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

    // Create transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        tenant_id,
        type: 'payment',
        amount: amount_in_cents,
        description: description || `Money order #${money_order_number}`,
        payment_method_id: null, // Will be linked when verified
        payment_status: 'pending',
        reference_number: money_order_number,
        processed_by: auth.user.email,
        notes: `Money order from ${issuing_organization}`
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

    return addSecurityHeaders(NextResponse.json({
      message: 'Money order submitted for verification',
      transaction: transaction,
      money_order_payment: moneyOrderPayment,
      next_steps: [
        'Money order will be verified within 1-3 business days',
        'You will receive notification when verification is complete',
        'Tenant account will be updated when money order clears'
      ]
    }));

  } catch (error: any) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return addSecurityHeaders(NextResponse.json({ 
        error: 'Validation failed', 
        details: error.issues 
      }, { status: 400 }));
    }
    
    console.error('Money order processing error:', error);
    return addSecurityHeaders(NextResponse.json(
      { error: error.message || 'Money order processing failed' },
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