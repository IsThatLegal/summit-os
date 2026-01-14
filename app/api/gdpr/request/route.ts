import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth } from '@/lib/auth';
import { z } from 'zod';

// GDPR request schema
const gdprRequestSchema = z.object({
  request_type: z.enum(['access', 'erasure', 'rectification', 'portability', 'restriction']),
  notes: z.string().optional(),
});

// List requests schema
const listSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'rejected']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

// Submit a GDPR data subject request
export async function POST(request: NextRequest) {
  // Authenticate user
  const authResult = await withAuth(request);
  if (authResult.response) {
    return authResult.response;
  }

  const user = authResult.user!;

  try {
    const body = await request.json();
    const validatedData = gdprRequestSchema.parse(body);

    const supabase = getSupabase();

    // Check if there's already a pending request of this type
    const { data: existingRequest } = await supabase
      .from('gdpr_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('request_type', validatedData.request_type)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      return NextResponse.json({
        error: `You already have a pending ${validatedData.request_type} request`,
        existing_request: existingRequest
      }, { status: 400 });
    }

    // Create the request
    const { data: gdprRequest, error } = await supabase
      .from('gdpr_requests')
      .insert({
        user_id: user.id,
        email: user.email || '',
        request_type: validatedData.request_type,
        notes: validatedData.notes,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Log the GDPR request
    await supabase.rpc('log_auth_event', {
      p_user_id: user.id,
      p_email: user.email,
      p_event_type: 'account_locked', // Repurposing for GDPR event
      p_failure_reason: `GDPR ${validatedData.request_type} request submitted`
    });

    // Get expected completion time based on request type
    const expectedDays = validatedData.request_type === 'access' ? 30 : 60; // GDPR timelines
    const expectedCompletionDate = new Date();
    expectedCompletionDate.setDate(expectedCompletionDate.getDate() + expectedDays);

    return NextResponse.json({
      success: true,
      request: gdprRequest,
      message: `Your ${validatedData.request_type} request has been submitted`,
      expected_completion: expectedCompletionDate.toISOString(),
      note: `We will process your request within ${expectedDays} days as required by GDPR`
    });

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.issues
      }, { status: 400 });
    }

    console.error('GDPR request error:', error);
    return NextResponse.json(
      { error: 'Failed to submit GDPR request' },
      { status: 500 }
    );
  }
}

// List GDPR requests (user can see their own, admins can see all)
export async function GET(request: NextRequest) {
  // Authenticate user
  const authResult = await withAuth(request);
  if (authResult.response) {
    return authResult.response;
  }

  const user = authResult.user!;

  try {
    const { searchParams } = new URL(request.url);

    const params = {
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    const validatedParams = listSchema.parse(params);

    const supabase = getSupabase();

    // Build query based on user role
    let query = supabase
      .from('gdpr_requests')
      .select('*', { count: 'exact' })
      .order('requested_at', { ascending: false });

    // Non-admins can only see their own requests
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'PROPERTY_ADMIN') {
      query = query.eq('user_id', user.id);
    }

    // Apply filters
    if (validatedParams.status) {
      query = query.eq('status', validatedParams.status);
    }

    // Apply pagination
    const offset = validatedParams.offset || 0;
    const limit = validatedParams.limit || 50;
    query = query.range(
      offset,
      offset + limit - 1
    );

    const { data: requests, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      requests: requests || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      }
    });

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid query parameters',
        details: error.issues
      }, { status: 400 });
    }

    console.error('GDPR request list error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve GDPR requests' },
      { status: 500 }
    );
  }
}
