#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('email', 'test_admin@summitos.com')
  .single();

if (error) {
  console.log('Test admin does NOT exist');
} else {
  console.log('✓ Test admin exists');
  console.log('  Email:', data.email);
  console.log('  Role:', data.role);
}
