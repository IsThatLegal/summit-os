import { getSupabase } from '@/lib/supabaseClient';
import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, START, END } from '@langchain/langgraph';

/**
 * Defines the state for "The Enforcer" agent's graph.
 * This state is passed between nodes in the graph.
 */
interface EnforcerState {
  tenantId: string;
  tenantData?: {
    name: string;
    balance: number;
    unit?: string; // We don't have this relation yet, but good to have
    phone: string;
  };
  daysLate: number;
  draftMessage: string | null;
  status: 'done' | 'drafted' | 'error';
}

const initialState: EnforcerState = {
  tenantId: '',
  daysLate: 0,
  draftMessage: null,
  status: 'drafted', // Start with a non-done status
};

/**
 * NODE 1: Fetches the tenant's data from Supabase.
 */
async function fetchData(state: EnforcerState) {
  console.log("--- NODE: fetchData ---");
  const supabase = getSupabase();
  const { tenantId } = state;

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
  return {
    ...state,
    tenantData: {
      name: data.first_name,
      balance: data.current_balance,
      phone: data.phone,
    },
    // Mocking days late for now as we don't have a due_date column yet
    daysLate: 5, 
  };
}

/**
 * NODE 2: Drafts the SMS message using an AI model.
 */
async function draftMessage(state: EnforcerState) {
  console.log("--- NODE: draftMessage ---");
  if (!state.tenantData || state.tenantData.balance <= 0) {
    console.log("Tenant balance is zero or less. Nothing to do.");
    return { ...state, status: 'done', draftMessage: null };
  }

  // MOCK IMPLEMENTATION: Replace the real AI call with a hardcoded message.
  console.log("Drafting mock message...");
  const balanceInDollars = (state.tenantData.balance / 100).toFixed(2);
  const mockMessage = `Hi ${state.tenantData.name}, this is SummitOS. Your balance of $${balanceInDollars} is past due. Please contact us to resolve.`;
  
  console.log(`Mock Drafted Message: "${mockMessage}"`);
  return {
    ...state,
    draftMessage: mockMessage,
    status: 'drafted',
  };

  /*
  // REAL IMPLEMENTATION (Commented out)
  const { name, balance } = state.tenantData;
  const { daysLate } = state;

  const llm = new ChatOpenAI({
    model: "gpt-4o",
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.2,
  });

  const prompt = `You are a polite but firm collections manager for a self-storage facility named SummitOS.
  
  Tenant Name: ${name}
  Amount Due: $${(balance / 100).toFixed(2)}
  Days Late: ${daysLate}
  
  Based on this, write a short, professional SMS message (under 160 characters) to the tenant.
  - If it's only a few days late, be gentle.
  - If it's more than 10 days late, be more firm and mention a potential lockout.
  - Always include the amount due and offer a way to help.`;

  console.log("Drafting message with AI...");
  const response = await llm.invoke(prompt);
  const message = response.content.toString();

  console.log(`AI Drafted Message: "${message}"`);
  return {
    ...state,
    draftMessage: message,
    status: 'drafted',
  };
  */
}

// Define the graph
const workflow = new StateGraph<EnforcerState>({
  channels: {
    tenantId: null,
    tenantData: null,
    daysLate: null,
    draftMessage: null,
    status: null,
  },
});

// Add the nodes
workflow.addNode("fetchData", fetchData);
workflow.addNode("draftMessageNode", draftMessage);

// Define the edges - temporarily simplified for compatibility
// TODO: Fix LangGraph integration with updated API
// workflow.addEdge("__start__", "fetchData");
// workflow.addEdge("fetchData", "draftMessageNode");
// workflow.addEdge("draftMessageNode", "__end__");

// Compile the graph into a runnable object
const runnable = workflow.compile();

export default runnable;