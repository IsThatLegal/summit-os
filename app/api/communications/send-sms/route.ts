import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { tenantId, phoneNumber, message } = await request.json();

  if (!tenantId || !phoneNumber || !message) {
    return NextResponse.json({ error: 'Missing required fields: tenantId, phoneNumber, message' }, { status: 400 });
  }

  // --- MOCK SMS SENDING LOGIC ---
  console.log(`[MOCK SMS SENT to ${phoneNumber} for Tenant ID: ${tenantId}]: ${message}`);
  // In a real scenario, you would integrate with Twilio or another SMS provider here.
  // Example: await twilioClient.messages.create({ body: message, to: phoneNumber, from: TWILIO_PHONE_NUMBER });
  // --- END MOCK ---

  return NextResponse.json({ success: true, message: 'Mock SMS sent successfully!' });
}
