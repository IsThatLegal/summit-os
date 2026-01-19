import { NextResponse, NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth, addSecurityHeaders } from '@/lib/auth';
import { rateLimits } from '@/lib/rateLimit';
import { z } from 'zod';

// Input validation schema
const cashPaymentSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant_id format'),
  amount_in_cents: z.number().int().positive('Amount must be a positive integer'),
  verification_method: z.string().min(1, 'Verification method is required'),
  cash_drawer_id: z.string().optional(),
  receipt_number: z.string().optional(),
  notes: z.string().max(500, 'Notes too long').optional(),
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
    const validatedData = cashPaymentSchema.parse(body);
    const { 
      tenant_id, 
      amount_in_cents, 
      verification_method,
      cash_drawer_id,
      receipt_number,
      notes,
      description 
    } = validatedData;
    
    const supabase = getSupabase();

    // Verify tenant exists
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

    // Create transaction record first
    // Amount must be NEGATIVE for payments (trigger adds this to balance)
    const transactionAmount = -Math.abs(amount_in_cents);

    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        tenant_id,
        type: 'payment',
        amount: transactionAmount,
        description: description || `Cash payment received`,
        payment_status: 'completed', // Cash is immediate
        processed_by: auth.user?.email || 'unknown',
        notes: notes || `Cash payment via ${verification_method}`
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

    // Create cash payment log
    const { data: cashPayment, error: cashError } = await supabase
      .from('cash_payments')
      .insert({
        transaction_id: transaction.id,
        amount: amount_in_cents,
        received_by: auth.user?.email || 'unknown',
        verification_method,
        cash_drawer_id,
        receipt_number,
        notes,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (cashError) {
      console.error('Error creating cash payment record:', cashError);
      return addSecurityHeaders(NextResponse.json(
        { error: 'Failed to create cash payment record' },
        { status: 500 }
      ));
    }

    // Trigger already updated the balance, fetch updated tenant data
    const { data: updatedTenant } = await supabase
      .from('tenants')
      .select('current_balance')
      .eq('id', tenant_id)
      .single();

    const newBalance = updatedTenant?.current_balance ?? 0;

    // Auto-unlock if balance is now clear
    let unlocked = false;
    if (newBalance <= 0) {
      const { error: unlockError } = await supabase
        .from('tenants')
        .update({ is_locked_out: false })
        .eq('id', tenant_id);

      if (!unlockError) {
        unlocked = true;
      }
    }

    return addSecurityHeaders(NextResponse.json({
      message: 'Cash payment recorded successfully',
      transaction: transaction,
      cash_payment: cashPayment,
      new_balance: newBalance,
      unlocked: unlocked
    }));

  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return addSecurityHeaders(NextResponse.json({
        error: 'Validation failed',
        details: error.issues
      }, { status: 400 }));
    }

    console.error('Cash payment processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Cash payment processing failed';
    return addSecurityHeaders(NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    ));
  }
}

// GET endpoint to retrieve cash payments
export async function GET(request: NextRequest) {
  // Authenticate and authorize user
  const auth = await withAuth(request, ['PROPERTY_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN']);
  if (auth.response) {
    return addSecurityHeaders(auth.response);
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const cashDrawerId = searchParams.get('cash_drawer_id');
    
    const supabase = getSupabase();

    let query = supabase
      .from('cash_payments')
      .select(`
        *,
        transactions!inner(
          id,
          tenant_id,
          amount,
          description,
          created_at,
          tenants!inner(
            first_name,
            email
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cashDrawerId) {
      query = query.eq('cash_drawer_id', cashDrawerId);
    }

    const { data: cashPayments, error } = await query;

    if (error) {
      console.error('Error fetching cash payments:', error);
      return addSecurityHeaders(NextResponse.json(
        { error: 'Failed to fetch cash payments' },
        { status: 500 }
      ));
    }

    return addSecurityHeaders(NextResponse.json(cashPayments || []));

  } catch (error) {
    console.error('Cash payments fetch error:', error);
    return addSecurityHeaders(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}