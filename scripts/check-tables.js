#!/usr/bin/env node

/**
 * Check what tables exist in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const expectedTables = [
  'tenants',
  'units',
  'transactions',
  'gate_logs',
  'user_profiles',
  'billing_logs',
  'payment_methods',
  'tenant_units'
];

console.log('🔍 Checking database tables...\n');

for (const table of expectedTables) {
  try {
    const { error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (!error) {
      console.log(`✓ ${table} exists`);
    } else {
      console.log(`✗ ${table} - ${error.message}`);
    }
  } catch (err) {
    console.log(`✗ ${table} - ERROR`);
  }
}
