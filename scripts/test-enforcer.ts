// Load environment variables from the root .env file
import 'dotenv/config';

// We will dynamically import the agent and client AFTER dotenv has run.

async function main() {
  // Dynamically import the modules after env vars are loaded
  const { supabase } = await import('../lib/supabaseClient');
  const { default: enforcerAgent } = await import('../lib/agents/enforcer/graph');

  console.log("--- Starting Enforcer Agent Test ---");
  
  let testTenantId: string | null = null;

  try {
    // 1. Setup: Insert a fake tenant into Supabase
    console.log("Creating test tenant 'Jared Dunn'...");
    const { data: tenant, error: insertError } = await supabase
      .from('tenants')
      .insert({
        first_name: 'Jared Dunn',
        email: 'jared@piedpiper.com',
        phone: '555-0199',
        current_balance: 5000, // $50.00 in cents
        gate_access_code: `TEST_${Date.now()}`, // Ensure unique code
        is_locked_out: true,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    
    testTenantId = tenant.id;
    console.log(`Test tenant created with ID: ${testTenantId}`);

    // 2. Execution: Run the enforcerAgent with the new tenantId
    console.log("\nInvoking The Enforcer agent...");
    const finalState = await enforcerAgent(testTenantId!);

    // 3. Output: Log the final state, specifically the draftMessage
    console.log("\n--- Agent Run Complete ---");
    console.log("Final State:", finalState);
    if (finalState.draftMessage) {
      console.log("\n✅ AI Drafted Message:");
      console.log(finalState.draftMessage);
    } else {
      console.error("❌ Agent did not produce a draft message.");
    }

  } catch (error) {
    console.error("\n--- An error occurred during the agent test ---");
    console.error(error);
  } finally {
    // 4. Cleanup: Delete the fake tenant from Supabase
    if (testTenantId) {
      console.log(`\nCleaning up test tenant (ID: ${testTenantId})...`);
      await supabase.from('tenants').delete().eq('id', testTenantId);
      console.log("Cleanup complete.");
    }
    console.log("\n--- Test Finished ---");
  }
}

main();