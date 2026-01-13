#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Checking user_profiles table...\n');

// Try to query the table
const { data, error } = await supabase
  .from('user_profiles')
  .select('*')
  .limit(5);

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log('✓ Table exists and is accessible');
  console.log(`Found ${data.length} rows`);
  if (data.length > 0) {
    console.log('\nSample data:', data[0]);
  }
}
