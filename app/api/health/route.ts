import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';

// Health check endpoint for monitoring
export async function GET() {
  const startTime = Date.now();

  const checks: {
    status: string;
    timestamp: string;
    checks: {
      database: { status: string; latency: number };
      stripe: { status: string };
      supabase_auth: { status: string; error?: string };
    };
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    environment: string | undefined;
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'unknown', latency: 0 },
      stripe: { status: 'unknown' },
      supabase_auth: { status: 'unknown' },
    },
    uptime: process.uptime(),
    memory: {
      used: process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal,
      percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
    },
    environment: process.env.NODE_ENV,
  };

  // Check database connectivity
  try {
    const dbStartTime = Date.now();
    const supabase = getSupabase();

    const { error } = await supabase
      .from('units')
      .select('id')
      .limit(1)
      .single();

    checks.checks.database = {
      status: error ? 'degraded' : 'healthy',
      latency: Date.now() - dbStartTime
    };

    if (error) {
      checks.status = 'degraded';
    }
  } catch (error) {
    checks.checks.database = {
      status: 'unhealthy',
      latency: Date.now() - startTime
    };
    checks.status = 'unhealthy';
  }

  // Check Supabase Auth
  try {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    checks.checks.supabase_auth = {
      status: 'healthy'
    };
  } catch (error) {
    checks.checks.supabase_auth = {
      status: 'degraded',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  // Check Stripe (just verify env var is set)
  if (process.env.STRIPE_SECRET_KEY) {
    checks.checks.stripe = { status: 'configured' };
  } else {
    checks.checks.stripe = { status: 'not_configured' };
    if (process.env.NODE_ENV === 'production') {
      checks.status = 'degraded';
    }
  }

  const statusCode = checks.status === 'healthy' ? 200 :
                     checks.status === 'degraded' ? 503 : 500;

  return NextResponse.json(checks, { status: statusCode });
}
