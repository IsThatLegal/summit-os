#!/usr/bin/env node

/**
 * Create test admin user once
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const TEST_ADMIN_EMAIL = 'test_admin@summitos.com';
const TEST_ADMIN_PASSWORD = 'TestAdmin123!@#';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Creating test admin user...\n');

// Try to sign in first
const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
  email: TEST_ADMIN_EMAIL,
  password: TEST_ADMIN_PASSWORD,
});

if (!signInError && signInData.user) {
  console.log('✓ User already exists');

  // Check profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', signInData.user.id)
    .single();

  if (profile) {
    console.log('✓ Profile exists');
    console.log('  Role:', profile.role);

    if (profile.role !== 'SUPER_ADMIN') {
      console.log('\n  Updating role to SUPER_ADMIN...');
      await supabase
        .from('user_profiles')
        .update({ role: 'SUPER_ADMIN' })
        .eq('id', signInData.user.id);
      console.log('  ✓ Role updated');
    }
  } else {
    console.log('\n  Creating profile...');
    await supabase
      .from('user_profiles')
      .insert({
        id: signInData.user.id,
        email: TEST_ADMIN_EMAIL,
        role: 'SUPER_ADMIN',
      });
    console.log('  ✓ Profile created');
  }

  console.log('\n✅ Test admin is ready!\n');
  process.exit(0);
}

// User doesn't exist, create it
console.log("User doesn't exist, creating...\\n");

const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
  email: TEST_ADMIN_EMAIL,
  password: TEST_ADMIN_PASSWORD,
  email_confirm: true, // Auto-confirm email for test user
});

if (signUpError) {
  console.error('❌ Error creating user:', signUpError.message);
  process.exit(1);
}

if (!signUpData.user) {
  console.error('❌ No user data returned');
  process.exit(1);
}

console.log('✓ User created');

// Create profile
const { error: profileError } = await supabase
  .from('user_profiles')
  .insert({
    id: signUpData.user.id,
    email: TEST_ADMIN_EMAIL,
    role: 'SUPER_ADMIN',
  });

if (profileError) {
  console.error('❌ Error creating profile:', profileError.message);
  process.exit(1);
}

console.log('✓ Profile created');
console.log('\n✅ Test admin user created successfully!\n');
