import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth } from '@/lib/auth';
import { z } from 'zod';

// Query parameters schema
const querySchema = z.object({
  table_name: z.string().optional(),
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE']).optional(),
  user_id: z.string().uuid().optional(),
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
      table_name: searchParams.get('table_name') || undefined,
      operation: searchParams.get('operation') || undefined,
      user_id: searchParams.get('user_id') || undefined,
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
      .from('audit_logs')
      .select(`
        id,
        table_name,
        operation,
        user_id,
        old_data,
        new_data,
        ip_address,
        user_agent,
        session_id,
        timestamp,
        user_profiles!inner(email, role)
      `, { count: 'exact' })
      .order('timestamp', { ascending: false });

    // Apply filters
    if (validatedParams.table_name) {
      query = query.eq('table_name', validatedParams.table_name);
    }

    if (validatedParams.operation) {
      query = query.eq('operation', validatedParams.operation);
    }

    if (validatedParams.user_id) {
      query = query.eq('user_id', validatedParams.user_id);
    }

    if (validatedParams.start_date) {
      query = query.gte('timestamp', validatedParams.start_date);
    }

    if (validatedParams.end_date) {
      query = query.lte('timestamp', validatedParams.end_date);
    }

    // Apply pagination
    query = query.range(
      validatedParams.offset,
      validatedParams.offset + validatedParams.limit - 1
    );

    const { data: logs, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      logs: logs || [],
      pagination: {
        total: count || 0,
        limit: validatedParams.limit,
        offset: validatedParams.offset,
        has_more: (count || 0) > validatedParams.offset + validatedParams.limit
      }
    });

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid query parameters',
        details: error.issues
      }, { status: 400 });
    }

    console.error('Audit logs query error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve audit logs' },
      { status: 500 }
    );
  }
}
