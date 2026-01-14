import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth } from '@/lib/auth';
import { z } from 'zod';

// Query parameters schema
const querySchema = z.object({
  event_type: z.string().optional(),
  user_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  ip_address: z.string().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  // Authenticate user (requires SUPER_ADMIN or AUDITOR role)
  const authResult = await withAuth(request, ['SUPER_ADMIN', 'AUDITOR']);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const params = {
      event_type: searchParams.get('event_type') || undefined,
      user_id: searchParams.get('user_id') || undefined,
      email: searchParams.get('email') || undefined,
      ip_address: searchParams.get('ip_address') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    // Validate parameters
    const validatedParams = querySchema.parse(params);

    const supabase = getSupabase();

    // Build query
    let query = supabase
      .from('auth_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (validatedParams.event_type) {
      query = query.eq('event_type', validatedParams.event_type);
    }

    if (validatedParams.user_id) {
      query = query.eq('user_id', validatedParams.user_id);
    }

    if (validatedParams.email) {
      query = query.eq('email', validatedParams.email);
    }

    if (validatedParams.ip_address) {
      query = query.eq('ip_address', validatedParams.ip_address);
    }

    if (validatedParams.start_date) {
      query = query.gte('created_at', validatedParams.start_date);
    }

    if (validatedParams.end_date) {
      query = query.lte('created_at', validatedParams.end_date);
    }

    // Apply pagination
    query = query.range(
      validatedParams.offset,
      validatedParams.offset + validatedParams.limit - 1
    );

    const { data: events, error, count } = await query;

    if (error) throw error;

    // Get summary statistics
    const { data: stats } = await supabase
      .from('auth_events')
      .select('event_type')
      .gte('created_at', validatedParams.start_date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const eventCounts: Record<string, number> = {};
    stats?.forEach((event: { event_type: string }) => {
      eventCounts[event.event_type] = (eventCounts[event.event_type] || 0) + 1;
    });

    return NextResponse.json({
      events: events || [],
      pagination: {
        total: count || 0,
        limit: validatedParams.limit,
        offset: validatedParams.offset,
        has_more: (count || 0) > validatedParams.offset + validatedParams.limit
      },
      statistics: eventCounts
    });

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid query parameters',
        details: error.issues
      }, { status: 400 });
    }

    console.error('Auth events query error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve auth events' },
      { status: 500 }
    );
  }
}
