import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import Stripe from 'stripe';

// Initialize Stripe with the secret key from environment variables
// The '!' asserts that the environment variable will be present.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  const { tenant_id, amount_in_cents, description } = await request.json();

  // Validate required fields
  if (!tenant_id || !amount_in_cents || !description) {
    return NextResponse.json({ error: 'Missing required fields: tenant_id, amount_in_cents, description' }, { status: 400 });
  }

  try {
    // Step 1: Create and confirm a Stripe PaymentIntent.
    // For testing, we use a hardcoded PaymentMethod that simulates a successful Visa payment.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount_in_cents,
      currency: 'usd',
      payment_method: 'pm_card_visa', // Test payment method for Visa
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      description: `Charge for tenant ${tenant_id}: ${description}`,
    });

    // Check if the payment was successful
    if (paymentIntent.status === 'succeeded') {
      // Step 2: CRITICAL - If Stripe charge succeeds, log it to our database.
      // We log payments as a negative amount to correctly decrease the tenant's balance.
      const transactionAmount = -Math.abs(amount_in_cents);

      const { data: transaction, error: supabaseError } = await supabase
        .from('transactions')
        .insert({
          tenant_id: tenant_id,
          type: 'payment',
          amount: transactionAmount,
          description: description,
          stripe_payment_id: paymentIntent.id,
        })
        .select()
        .single();

      if (supabaseError) {
        // If the database insert fails, this is a critical issue.
        console.error(`CRITICAL: Stripe payment ${paymentIntent.id} succeeded but failed to log to Supabase.`, supabaseError);
        // Optionally, you could try to refund the payment here.
        return NextResponse.json({ error: 'Payment succeeded but failed to record transaction.' }, { status: 500 });
      }

      // Step 3: Check new balance and auto-unlock if applicable.
      // The trigger updated the balance, so we re-fetch the tenant to get the new balance.
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
          // Log this as a non-critical error, as the payment still succeeded.
          console.error(`Error auto-unlocking tenant ${tenant_id}:`, unlockError);
        } else {
          unlocked = true;
        }
      }

      // Return a success response with the created transaction details.
      return NextResponse.json({
        message: 'Charge successful and transaction logged.',
        stripe_payment_id: paymentIntent.id,
        transaction: transaction,
        unlocked: unlocked
      }, { status: 201 });

    } else {
      // If the PaymentIntent has a different status (e.g., 'requires_action')
      return NextResponse.json({ error: 'Payment did not succeed.', status: paymentIntent.status }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Stripe API error:', error);
    // Return a generic error response
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
