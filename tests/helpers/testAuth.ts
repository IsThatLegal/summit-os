/**
 * Test authentication utilities
 *
 * This module provides authentication helpers for integration tests.
 * It creates a test admin user and manages JWT tokens for authenticated requests.
 */

import { getSupabase } from '@/lib/supabaseClient';

const TEST_ADMIN_EMAIL = 'test_admin@summitos.com';
const TEST_ADMIN_PASSWORD = 'TestAdmin123!@#';

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

/**
 * Create test admin user if it doesn't exist
 * This should be called once during test setup
 */
export async function ensureTestAdminUser(): Promise<void> {
  const supabase = getSupabase();

  try {
    // First check if profile already exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', TEST_ADMIN_EMAIL)
      .single();

    if (existingProfile) {
      // Profile exists, ensure it has SUPER_ADMIN role
      if (existingProfile.role === 'SUPER_ADMIN') {
        console.log('Test admin user already exists with SUPER_ADMIN role');
        return;
      }

      // Update to SUPER_ADMIN if needed
      await supabase
        .from('user_profiles')
        .update({ role: 'SUPER_ADMIN' })
        .eq('id', existingProfile.id);
      console.log('Updated existing user to SUPER_ADMIN');
      return;
    }

    // Profile doesn't exist, try to sign in to check if auth user exists
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
    });

    if (!signInError && signInData.user) {
      // Auth user exists but no profile, create profile
      await supabase
        .from('user_profiles')
        .insert({
          id: signInData.user.id,
          email: TEST_ADMIN_EMAIL,
          role: 'SUPER_ADMIN',
        });
      console.log('Created SUPER_ADMIN profile for existing auth user');
      return;
    }

    // Neither profile nor auth user exists, create both
    // Use admin.createUser to auto-confirm email for test user
    const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
      email_confirm: true, // Auto-confirm email for test user
    });

    if (signUpError) {
      console.error('Error creating test admin user:', signUpError);
      throw new Error(`Failed to create test admin: ${signUpError.message}`);
    }

    if (!signUpData.user) {
      throw new Error('Failed to create test admin: No user data returned');
    }

    // Create admin profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: signUpData.user.id,
        email: TEST_ADMIN_EMAIL,
        role: 'SUPER_ADMIN',
      });

    if (profileError) {
      console.error('Error creating admin profile:', profileError);
      throw new Error(`Failed to create admin profile: ${profileError.message}`);
    }

    console.log('Test admin user created successfully');
  } catch (error) {
    console.error('Error in ensureTestAdminUser:', error);
    throw error;
  }
}

/**
 * Get a valid JWT token for test admin user
 * Caches the token and refreshes if expired
 */
export async function getTestAdminToken(): Promise<string> {
  // Return cached token if still valid (with 5 minute buffer)
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry - 300000) {
    return cachedToken;
  }

  // Login directly with Supabase to get token
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_ADMIN_EMAIL,
    password: TEST_ADMIN_PASSWORD,
  });

  if (error || !data.session) {
    throw new Error(`Failed to login test admin with Supabase: ${error?.message || 'No session returned'}`);
  }

  cachedToken = data.session.access_token;
  // JWT tokens typically expire in 1 hour (3600 seconds)
  tokenExpiry = Date.now() + 3600000;

  return cachedToken;
}

/**
 * Make an authenticated request as test admin
 */
export async function makeAuthenticatedTestRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getTestAdminToken();

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Delete the test admin user (cleanup)
 */
export async function deleteTestAdminUser(): Promise<void> {
  const supabase = getSupabase();

  try {
    // Sign in to get user ID
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
    });

    if (!authData.user) {
      console.log('Test admin user does not exist');
      return;
    }

    const userId = authData.user.id;

    // Delete user profile
    await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    // Delete auth user (requires service role)
    // Note: This might fail if using anon key instead of service role key
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      console.warn('Could not delete auth user (may require service role key):', error.message);
    } else {
      console.log('Test admin user deleted successfully');
    }

    // Clear cached token
    cachedToken = null;
    tokenExpiry = null;
  } catch (error) {
    console.error('Error deleting test admin user:', error);
    // Don't throw - cleanup errors shouldn't fail tests
  }
}

/**
 * Clear cached authentication token
 */
export function clearTestAuthCache(): void {
  cachedToken = null;
  tokenExpiry = null;
}
