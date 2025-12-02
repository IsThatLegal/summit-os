import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { addSecurityHeaders } from '@/lib/auth';

// This function handles automated monthly billing
// It should be called by a cron job on the 1st of each month
export async function POST() {
  try {
    console.log('🚀 Starting automated monthly billing process...');
    
    const supabase = getSupabase();

    // Get all active tenants (those with units)
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select(`
        id,
        first_name,
        email,
        current_balance,
        units!inner(
          id,
          unit_number,
          monthly_price
        )
      `)
      .not('units.id', 'is', null)
      .eq('units.status', 'occupied');

    if (tenantsError) {
      console.error('Error fetching tenants for billing:', tenantsError);
      return addSecurityHeaders(NextResponse.json(
        { error: 'Failed to fetch tenants for billing' },
        { status: 500 }
      ));
    }

    if (!tenants || tenants.length === 0) {
      console.log('No active tenants found for billing');
      return addSecurityHeaders(NextResponse.json({
        message: 'No tenants to bill',
        processed: 0,
        total: 0
      }));
    }

    console.log(`Found ${tenants.length} tenants to process`);

    let processedCount = 0;
    let totalAmount = 0;
    const errors: string[] = [];

    // Process each tenant
    for (const tenant of tenants) {
      try {
        if (!tenant.units || tenant.units.length === 0) {
          console.log(`Skipping tenant ${tenant.id} - no assigned unit`);
          continue;
        }

        const unit = tenant.units[0];
        const monthlyCharge = unit.monthly_price;

        // Create billing transaction
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            tenant_id: tenant.id,
            type: 'charge',
            amount: monthlyCharge,
            description: `Monthly rent for ${unit.unit_number} - ${new Date().toLocaleDateString()}`,
            created_at: new Date().toISOString()
          });

        if (transactionError) {
          console.error(`Failed to create transaction for tenant ${tenant.id}:`, transactionError);
          errors.push(`Failed to bill ${tenant.first_name} (${tenant.email})`);
          continue;
        }

        // Update tenant balance (trigger will handle this automatically)
        // But we'll do it explicitly for clarity
        const { error: updateError } = await supabase
          .from('tenants')
          .update({
            current_balance: tenant.current_balance + monthlyCharge,
            // Lock out if new balance is positive
            is_locked_out: (tenant.current_balance + monthlyCharge) > 0
          })
          .eq('id', tenant.id);

        if (updateError) {
          console.error(`Failed to update tenant ${tenant.id}:`, updateError);
          errors.push(`Failed to update balance for ${tenant.first_name} (${tenant.email})`);
          continue;
        }

        processedCount++;
        totalAmount += monthlyCharge;
        
        console.log(`✅ Billed ${tenant.first_name} $${(monthlyCharge / 100).toFixed(2)} for unit ${unit.unit_number}`);

      } catch (error) {
        console.error(`Error processing tenant ${tenant.id}:`, error);
        errors.push(`Error processing ${tenant.first_name} (${tenant.email})`);
      }
    }

    // Log billing summary
    const summary = {
      processed_at: new Date().toISOString(),
      total_tenants: tenants.length,
      processed_count: processedCount,
      total_amount: totalAmount,
      errors: errors,
      success_rate: processedCount > 0 ? ((processedCount / tenants.length) * 100).toFixed(1) : '0'
    };

    console.log('📊 Billing Summary:', summary);

    // Store billing summary for audit purposes
    const { error: logError } = await supabase
      .from('billing_logs')
      .insert({
        processed_at: summary.processed_at,
        total_tenants: summary.total_tenants,
        processed_count: summary.processed_count,
        total_amount: summary.total_amount,
        errors: summary.errors,
        success_rate: summary.success_rate
      })
      .select();

    if (logError) {
      console.error('Failed to log billing summary:', logError);
    }

    return addSecurityHeaders(NextResponse.json({
      message: 'Monthly billing completed',
      summary
    }));

  } catch (error) {
    console.error('Automated billing error:', error);
    return addSecurityHeaders(NextResponse.json(
      { error: 'Automated billing failed' },
      { status: 500 }
    ));
  }
}

// GET endpoint to check billing status
export async function GET() {
  try {
    const supabase = getSupabase();

    // Get last billing run
    const { data: lastBilling, error } = await supabase
      .from('billing_logs')
      .select('*')
      .order('processed_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching billing status:', error);
      return addSecurityHeaders(NextResponse.json(
        { error: 'Failed to fetch billing status' },
        { status: 500 }
      ));
    }

    return addSecurityHeaders(NextResponse.json({
      last_billing: lastBilling,
      next_billing: lastBilling ? 
        new Date(new Date(lastBilling.processed_at).getTime() + 30 * 24 * 60 * 60 * 1000) : 
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) // Next month 1st
    }));

  } catch (error) {
    console.error('Billing status error:', error);
    return addSecurityHeaders(NextResponse.json(
      { error: 'Failed to get billing status' },
      { status: 500 }
    ));
  }
}