import { NextResponse } from 'next/server';
import enforcerAgent from '@/lib/agents/enforcer/graph';

export async function POST(request: Request) {
  const { tenantId } = await request.json();

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  try {
    console.log(`API: Invoking Enforcer agent for tenantId: ${tenantId}`);
    
    const finalState = await enforcerAgent.invoke({ tenantId });

    if (finalState.status === 'error' || !finalState.draftMessage) {
      return NextResponse.json({ error: 'Agent failed to produce a message.' }, { status: 500 });
    }

    console.log(`API: Agent returned draft message: "${finalState.draftMessage}"`);

    return NextResponse.json({
      draftMessage: finalState.draftMessage,
    });

  } catch (error: any) {
    console.error('Error invoking enforcer agent:', error);
    return NextResponse.json({ error: 'Failed to run agent.', details: error.message }, { status: 500 });
  }
}
