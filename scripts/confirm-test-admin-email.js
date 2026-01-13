#!/usr/bin/env node

/**
 * Confirm email for test admin user
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const TEST_ADMIN_EMAIL = 'test_admin@summitos.com';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Looking up test admin user...\n');

// Get user by email
const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

if (listError) {
  console.error('❌ Error listing users:', listError.message);
  process.exit(1);
}

const testUser = users.find(u => u.email === TEST_ADMIN_EMAIL);

if (!testUser) {
  console.error('❌ Test admin user not found');
  process.exit(1);
}

console.log('✓ Found user:', testUser.email);
console.log('  ID:', testUser.id);
console.log('  Email confirmed:', testUser.email_confirmed_at ? 'Yes' : 'No');

if (testUser.email_confirmed_at) {
  console.log('\n✅ Email already confirmed!\n');
  process.exit(0);
}

// Update user to confirm email
console.log('\nConfirming email...');

const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
  testUser.id,
  { email_confirm: true }
);

if (updateError) {
  console.error('❌ Error confirming email:', updateError.message);
  process.exit(1);
}

console.log('✓ Email confirmed!');
console.log('\n✅ Test admin is ready!\n');
