import { getSupabase } from '@/lib/supabaseClient';

/**
 * Simple enforcer function that fetches tenant data and drafts a message
 * This is a temporary simplified version while we fix LangGraph integration
 */
export async function processTenant(tenantId: string) {
  console.log("--- Processing tenant ---");
  const supabase = getSupabase();

  // Fetch tenant data
  const { data, error } = await supabase
    .from('tenants')
    .select('first_name, current_balance, phone')
    .eq('id', tenantId)
    .single();

  if (error || !data) {
    console.error("Error fetching tenant data:", error);
    throw new Error(`Tenant with ID ${tenantId} not found.`);
  }

  console.log(`Fetched data for ${data.first_name}`);

  // Draft message
  if (data.current_balance <= 0) {
    console.log("Tenant balance is zero or less. Nothing to do.");
    return {
      tenantData: {
        name: data.first_name,
        balance: data.current_balance,
        phone: data.phone,
      },
      daysLate: 0,
      draftMessage: null,
      status: 'done' as const,
    };
  }

  // Mock implementation
  console.log("Drafting mock message...");
  const balanceInDollars = (data.current_balance / 100).toFixed(2);
  const mockMessage = `Hi ${data.first_name}, this is SummitOS. Your balance of $${balanceInDollars} is past due. Please contact us to resolve.`;
  
  console.log(`Mock Drafted Message: "${mockMessage}"`);
  
  return {
    tenantData: {
      name: data.first_name,
      balance: data.current_balance,
      phone: data.phone,
    },
    daysLate: 5, // Mocked for now
    draftMessage: mockMessage,
    status: 'drafted' as const,
  };
}

// Default export for compatibility
export default processTenant;