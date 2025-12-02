import { NextResponse } from 'next/server';
import { processTenant } from '@/lib/agents/enforcer/graph';

export async function POST(request: Request) {
  const { tenantId } = await request.json();

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  try {
    console.log(`API: Processing tenant for tenantId: ${tenantId}`);
    
    const result = await processTenant(tenantId);

    if (!result.draftMessage) {
      return NextResponse.json({ error: 'Agent failed to produce a message.' }, { status: 500 });
    }

    console.log(`API: Agent returned draft message: "${result.draftMessage}"`);

    return NextResponse.json({
      draftMessage: result.draftMessage,
    });

  } catch (error: any) {
    console.error('Error processing tenant:', error);
    return NextResponse.json({ error: 'Failed to run agent.', details: error.message }, { status: 500 });
  }
}
