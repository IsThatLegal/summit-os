import { NextResponse, NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth, addSecurityHeaders } from '@/lib/auth';
import { rateLimits } from '@/lib/rateLimit';
import Stripe from 'stripe';
import { z } from 'zod';

// Input validation schema
const chargeSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant_id format'),
  amount_in_cents: z.number().int().positive('Amount must be a positive integer'),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long')
});

// Initialize Stripe with secure environment variable handling
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set');
}

// Validate Stripe key format
if (!stripeSecretKey.startsWith('sk_test_') && !stripeSecretKey.startsWith('sk_live_')) {
  throw new Error('Invalid STRIPE_SECRET_KEY format');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-12-15.clover'
});

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimits.payments(request);
  if (rateLimitResponse) {
    return addSecurityHeaders(rateLimitResponse);
  }

  // Authenticate and authorize user
  const auth = await withAuth(request, ['PROPERTY_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN']);
  if (auth.response) {
    return addSecurityHeaders(auth.response);
  }

  try {
    const body = await request.json();
    
    // Validate input using Zod schema
    const validatedData = chargeSchema.parse(body);
    const { tenant_id, amount_in_cents, description } = validatedData;

    const supabase = getSupabase();

    // Check if tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      return addSecurityHeaders(NextResponse.json({ error: 'Tenant not found' }, { status: 404 }));
    }

    // Check if we're in test mode (stripeSecretKey validated at module init)
    const isTestMode = stripeSecretKey!.startsWith('sk_test_');

    let paymentIntent;
    if (isTestMode) {
      // In test mode, auto-confirm with test card for easier development
      paymentIntent = await stripe.paymentIntents.create({
        amount: amount_in_cents,
        currency: 'usd',
        confirm: true,
        payment_method: 'pm_card_visa',
        description: `Payment for tenant ${tenant_id}: ${description}`,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never'
        }
      });
    } else {
      // In production, create unconfirmed PaymentIntent
      // Frontend must confirm with real payment method via Stripe.js
      paymentIntent = await stripe.paymentIntents.create({
        amount: amount_in_cents,
        currency: 'usd',
        description: `Payment for tenant ${tenant_id}: ${description}`,
        metadata: { tenant_id },
        automatic_payment_methods: {
          enabled: true
        }
      });

      // Return client_secret for frontend to complete payment
      if (paymentIntent.status === 'requires_payment_method') {
        return addSecurityHeaders(NextResponse.json({
          requires_action: true,
          client_secret: paymentIntent.client_secret,
          payment_intent_id: paymentIntent.id
        }));
      }
    }

    // Check if payment was successful
    if (paymentIntent.status === 'succeeded') {
      // Step 2: CRITICAL - If Stripe charge succeeds, log it to our database.
      // We log payments as a negative amount to correctly decrease tenant's balance.
      const transactionAmount = -Math.abs(amount_in_cents);

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
        // If database insert fails, this is a critical issue.
        console.error(`CRITICAL: Stripe payment ${paymentIntent.id} succeeded but failed to log to Supabase.`, supabaseError);
        // Optionally, you could try to refund the payment here.
        return addSecurityHeaders(NextResponse.json({ error: 'Payment succeeded but failed to record transaction.' }, { status: 500 }));
      }

      // Step 3: Check new balance and auto-unlock if applicable.
      // The trigger updated balance, so we re-fetch tenant to get the new balance.
      const { data: updatedTenant } = await supabase
        .from('tenants')
        .select('current_balance')
        .eq('id', tenant_id)
        .single();
      
      console.log('Updated tenant for auto-unlock check:', updatedTenant);
      
      let unlocked = false;
      if (updatedTenant && updatedTenant.current_balance <= 0) {
        const { error: unlockError } = await supabase
          .from('tenants')
          .update({ is_locked_out: false })
          .eq('id', tenant_id);
        
        if (unlockError) {
          // Log this as a non-critical error, as payment still succeeded.
          console.error(`Error auto-unlocking tenant ${tenant_id}:`, unlockError);
        } else {
          unlocked = true;
        }
      }

      // Return a success response with created transaction details.
      return addSecurityHeaders(NextResponse.json({
        message: 'Charge successful and transaction logged.',
        stripe_payment_id: paymentIntent.id,
        transaction: transaction,
        unlocked: unlocked
      }, { status: 201 }));

    } else {
      // If PaymentIntent has a different status (e.g., 'requires_action')
      return addSecurityHeaders(NextResponse.json({ error: 'Payment did not succeed.', status: paymentIntent.status }, { status: 400 }));
    }

  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return addSecurityHeaders(NextResponse.json({
        error: 'Validation failed',
        details: error.issues
      }, { status: 400 }));
    }

    console.error('Stripe API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Return a generic error response
    return addSecurityHeaders(NextResponse.json({ error: errorMessage }, { status: 500 }));
  }
}