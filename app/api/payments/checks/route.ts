import { NextResponse, NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth, addSecurityHeaders } from '@/lib/auth';
import { rateLimits } from '@/lib/rateLimit';
import { z } from 'zod';

// Input validation schema
const checkPaymentSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant_id format'),
  amount_in_cents: z.number().int().positive('Amount must be a positive integer'),
  check_number: z.string().min(1, 'Check number is required'),
  bank_name: z.string().min(1, 'Bank name is required'),
  routing_number: z.string().min(9, 'Routing number must be at least 9 digits'),
  account_number: z.string().min(4, 'Account number is required'),
  check_image_url: z.string().url('Invalid check image URL').optional(),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long')
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
    const validatedData = checkPaymentSchema.parse(body);
    const { 
      tenant_id, 
      amount_in_cents, 
      check_number, 
      bank_name, 
      routing_number, 
      account_number, 
      check_image_url,
      description 
    } = validatedData;
    
    const supabase = getSupabase();

    // Verify tenant exists and belongs to property
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, first_name, email, current_balance')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      return addSecurityHeaders(NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      ));
    }

    // Create check payment record
    const { data: checkPayment, error: checkError } = await supabase
      .from('check_payments')
      .insert({
        check_number,
        bank_name,
        routing_number,
        account_number,
        check_image_url,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (checkError) {
      console.error('Error creating check payment record:', checkError);
      return addSecurityHeaders(NextResponse.json(
        { error: 'Failed to create check payment record' },
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
        description: description || `Check payment #${check_number}`,
        payment_method_id: null, // Will be linked when check clears
        payment_status: 'pending',
        reference_number: check_number,
        processed_by: auth.user.email,
        notes: `Check payment via ${bank_name}`
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
      message: 'Check payment submitted for processing',
      transaction: transaction,
      check_payment: checkPayment,
      next_steps: [
        'Check will be verified within 1-2 business days',
        'Tenant account will be updated when check clears',
        'You will receive notification when payment is processed'
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
    
    console.error('Check payment processing error:', error);
    return addSecurityHeaders(NextResponse.json(
      { error: error.message || 'Check payment processing failed' },
      { status: 500 }
    ));
  }
}

// GET endpoint to retrieve check payments
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
      .from('check_payments')
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

    const { data: checkPayments, error } = await query;

    if (error) {
      console.error('Error fetching check payments:', error);
      return addSecurityHeaders(NextResponse.json(
        { error: 'Failed to fetch check payments' },
        { status: 500 }
      ));
    }

    return addSecurityHeaders(NextResponse.json(checkPayments || []));

  } catch (error) {
    console.error('Check payments fetch error:', error);
    return addSecurityHeaders(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}