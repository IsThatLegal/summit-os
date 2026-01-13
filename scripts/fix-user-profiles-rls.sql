-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "User profiles can be viewed by authenticated users" ON user_profiles;

-- For development/testing: Allow all operations
-- This lets the service role key create test admin users
CREATE POLICY "Allow all operations on user_profiles" ON user_profiles
    FOR ALL
    USING (true)
    WITH CHECK (true);
