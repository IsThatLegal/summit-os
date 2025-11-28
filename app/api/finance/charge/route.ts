import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import Stripe from 'stripe';

// Initialize Stripe with better error handling
let stripe: Stripe;
try {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_123', {
    apiVersion: '2025-11-17.clover'
  });
} catch (error) {
  console.error('Failed to initialize Stripe:', error);
  throw new Error('Stripe initialization failed');
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  const { tenant_id, amount_in_cents, description } = await request.json();

  // Validate required fields
  if (!tenant_id || !amount_in_cents || !description) {
    return NextResponse.json({ error: 'Missing required fields: tenant_id, amount_in_cents, description' }, { status: 400 });
  }

  try {
    // Validate tenant_id format first
    if (!tenant_id || typeof tenant_id !== 'string') {
      return NextResponse.json({ error: 'Invalid tenant_id format' }, { status: 400 });
    }

    // For testing, use a simpler approach that works with test mode
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount_in_cents,
      currency: 'usd',
      confirm: true,
      payment_method: 'pm_card_visa',
      description: `Test payment for tenant ${tenant_id}: ${description}`,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      }
    });

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
        return NextResponse.json({ error: 'Payment succeeded but failed to record transaction.' }, { status: 500 });
      }

      // Step 3: Check new balance and auto-unlock if applicable.
      // The trigger updated balance, so we re-fetch tenant to get the new balance.
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
          // Log this as a non-critical error, as payment still succeeded.
          console.error(`Error auto-unlocking tenant ${tenant_id}:`, unlockError);
        } else {
          unlocked = true;
        }
      }

      // Return a success response with created transaction details.
      return NextResponse.json({
        message: 'Charge successful and transaction logged.',
        stripe_payment_id: paymentIntent.id,
        transaction: transaction,
        unlocked: unlocked
      }, { status: 201 });

    } else {
      // If PaymentIntent has a different status (e.g., 'requires_action')
      return NextResponse.json({ error: 'Payment did not succeed.', status: paymentIntent.status }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Stripe API error:', error);
    console.error('Stripe error type:', error.type);
    console.error('Stripe error code:', error.code);
    // Return a generic error response
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}