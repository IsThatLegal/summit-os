import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Use a singleton pattern to ensure we only have one instance of the client.
let supabaseInstance: SupabaseClient | null = null;

export function getSupabase() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and Anon Key are required!');
  }

  // Create and memoize the client
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);

  return supabaseInstance;
}

// Note: Use getSupabase() instead of direct import to avoid build-time errors
// when environment variables are not available during static analysis
