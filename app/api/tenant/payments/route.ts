import { NextResponse, NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth, addSecurityHeaders } from '@/lib/auth';
import { rateLimits } from '@/lib/rateLimit';
import { z } from 'zod';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover'
});

// Input validation schema
const paymentSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant_id format'),
  amount_in_cents: z.number().int().positive('Amount must be a positive integer'),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long')
});

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimits.payments(request);
  if (rateLimitResponse) {
    return addSecurityHeaders(rateLimitResponse);
  }

  // Authenticate and authorize user
  const auth = await withAuth(request, ['TENANT', 'PROPERTY_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN']);
  if (auth.response) {
    return addSecurityHeaders(auth.response);
  }

  try {
    const body = await request.json();
    
    // Validate input using Zod schema
    const validatedData = paymentSchema.parse(body);
    const { tenant_id, amount_in_cents, description } = validatedData;
    
    const supabase = getSupabase();

    // Tenants can only make payments for themselves
    if (auth.user?.role === 'TENANT') {
      // Verify this tenant belongs to the authenticated user
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, email')
        .eq('id', tenant_id)
        .eq('email', auth.user.email)
        .single();

      if (tenantError || !tenant) {
        return addSecurityHeaders(NextResponse.json(
          { error: 'Tenant not found or access denied' },
          { status: 404 }
        ));
      }
    }

    // Create a Stripe Payment Intent for actual payment processing
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount_in_cents,
      currency: 'usd',
      description: description,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      // In production, you'd handle client-side confirmation
      // For now, we'll simulate successful payment
      confirm: true,
      payment_method: 'pm_card_visa', // Test card
    });

    if (paymentIntent.status !== 'succeeded') {
      return addSecurityHeaders(NextResponse.json(
        { error: 'Payment failed', status: paymentIntent.status },
        { status: 400 }
      ));
    }

    // Log the payment to our database
    const transactionAmount = -Math.abs(amount_in_cents); // Negative for payments

    const { data: transaction, error: supabaseError } = await supabase
      .from('transactions')
      .insert({
        tenant_id,
        type: 'payment',
        amount: transactionAmount,
        description: description,
        stripe_payment_id: paymentIntent.id,
      })
      .select()
      .single();

    if (supabaseError) {
      console.error(`CRITICAL: Stripe payment ${paymentIntent.id} succeeded but failed to log to Supabase.`, supabaseError);
      return addSecurityHeaders(NextResponse.json(
        { error: 'Payment succeeded but failed to record transaction.' },
        { status: 500 }
      ));
    }

    // Check if tenant should be unlocked
    const { data: updatedTenant } = await supabase
      .from('tenants')
      .select('current_balance')
      .eq('id', tenant_id)
      .single();
    
    let unlocked = false;
    if (updatedTenant && updatedTenant.current_balance <= 0) {
      const { error: unlockError } = await supabase
        .from('tenants')
        .update({ is_locked_out: false })
        .eq('id', tenant_id);
      
      if (unlockError) {
        console.error(`Error auto-unlocking tenant ${tenant_id}:`, unlockError);
      } else {
        unlocked = true;
      }
    }

    return addSecurityHeaders(NextResponse.json({
      message: 'Payment successful',
      stripe_payment_id: paymentIntent.id,
      transaction: transaction,
      unlocked: unlocked,
      new_balance: updatedTenant?.current_balance || 0
    }));

  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return addSecurityHeaders(NextResponse.json({
        error: 'Validation failed',
        details: error.issues
      }, { status: 400 }));
    }

    console.error('Payment processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Payment processing failed';
    return addSecurityHeaders(NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    ));
  }
}