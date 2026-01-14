import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { withAuth } from '@/lib/auth';
import { z } from 'zod';

// Query parameters schema
const querySchema = z.object({
  alert_type: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['open', 'investigating', 'resolved', 'false_positive']).optional(),
  user_id: z.string().uuid().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
});

// Update alert schema
const updateAlertSchema = z.object({
  alert_id: z.string().uuid(),
  status: z.enum(['open', 'investigating', 'resolved', 'false_positive']),
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
      alert_type: searchParams.get('alert_type') || undefined,
      severity: searchParams.get('severity') || undefined,
      status: searchParams.get('status') || 'open', // Default to open alerts
      user_id: searchParams.get('user_id') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    // Validate parameters
    const validatedParams = querySchema.parse(params);

    const supabase = getSupabase();

    // Build query
    let query = supabase
      .from('security_alerts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (validatedParams.alert_type) {
      query = query.eq('alert_type', validatedParams.alert_type);
    }

    if (validatedParams.severity) {
      query = query.eq('severity', validatedParams.severity);
    }

    if (validatedParams.status) {
      query = query.eq('status', validatedParams.status);
    }

    if (validatedParams.user_id) {
      query = query.eq('user_id', validatedParams.user_id);
    }

    if (validatedParams.start_date) {
      query = query.gte('created_at', validatedParams.start_date);
    }

    if (validatedParams.end_date) {
      query = query.lte('created_at', validatedParams.end_date);
    }

    // Apply pagination
    const offset = validatedParams.offset || 0;
    const limit = validatedParams.limit || 50;
    query = query.range(
      offset,
      offset + limit - 1
    );

    const { data: alerts, error, count } = await query;

    if (error) throw error;

    // Get summary by severity and status
    const { data: summaryData } = await supabase
      .from('security_alerts')
      .select('severity, status')
      .eq('status', 'open');

    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total_open: summaryData?.length || 0
    };

    summaryData?.forEach((alert: { severity: string }) => {
      if (alert.severity in summary) {
        summary[alert.severity as keyof typeof summary]++;
      }
    });

    return NextResponse.json({
      alerts: alerts || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      },
      summary
    });

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid query parameters',
        details: error.issues
      }, { status: 400 });
    }

    console.error('Security alerts query error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve security alerts' },
      { status: 500 }
    );
  }
}

// Update alert status
export async function PATCH(request: NextRequest) {
  // Authenticate user (requires SUPER_ADMIN role)
  const authResult = await withAuth(request, ['SUPER_ADMIN']);
  if (authResult.response) {
    return authResult.response;
  }

  const user = authResult.user!;

  try {
    const body = await request.json();
    const validatedData = updateAlertSchema.parse(body);

    const supabase = getSupabase();

    const updateData: { status: string; resolved_by?: string; resolved_at?: string } = {
      status: validatedData.status
    };

    if (validatedData.status === 'resolved' || validatedData.status === 'false_positive') {
      updateData.resolved_by = user.id;
      updateData.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('security_alerts')
      .update(updateData)
      .eq('id', validatedData.alert_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      alert: data
    });

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.issues
      }, { status: 400 });
    }

    console.error('Update alert error:', error);
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}
