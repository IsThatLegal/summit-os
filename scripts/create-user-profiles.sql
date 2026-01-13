-- Create properties table for multi-tenant support
CREATE TABLE IF NOT EXISTS properties (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_profiles table for authentication and roles
CREATE TABLE IF NOT EXISTS user_profiles (
    id uuid REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'PROPERTY_ADMIN', 'FINANCE_ADMIN', 'GATE_OPERATOR', 'TENANT', 'AUDITOR')),
    property_id uuid REFERENCES properties(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add property_id to existing tables if not exists
ALTER TABLE units ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "User profiles can be viewed by authenticated users" ON user_profiles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all on properties for development" ON properties
    FOR ALL USING (true);
