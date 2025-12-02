-- Secure Row Level Security Policies for SummitOS

-- Drop existing insecure policies
DROP POLICY IF EXISTS "Allow all" ON units;
DROP POLICY IF EXISTS "Allow all" ON tenants;
DROP POLICY IF EXISTS "Allow all" ON gate_logs;

-- Create user_profiles table for authentication and roles
CREATE TABLE IF NOT EXISTS user_profiles (
    id uuid REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'PROPERTY_ADMIN', 'FINANCE_ADMIN', 'GATE_OPERATOR', 'TENANT', 'AUDITOR')),
    property_id uuid REFERENCES properties(id), -- For multi-tenant support
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create properties table for multi-tenant support
CREATE TABLE IF NOT EXISTS properties (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add property_id to existing tables if not exists
ALTER TABLE units ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id);

-- Enable RLS on new tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Secure Policies for units table
CREATE POLICY "Units can be viewed by authenticated users based on property" ON units
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        (
            auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
            (auth.jwt() ->> 'role' IN ('PROPERTY_ADMIN', 'FINANCE_ADMIN', 'GATE_OPERATOR', 'AUDITOR') 
             AND property_id = (SELECT property_id FROM user_profiles WHERE id = auth.uid()))
        )
    );

CREATE POLICY "Units can be inserted by property admins" ON units
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        (
            auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
            (auth.jwt() ->> 'role' IN ('PROPERTY_ADMIN', 'FINANCE_ADMIN') 
             AND property_id = (SELECT property_id FROM user_profiles WHERE id = auth.uid()))
        )
    );

CREATE POLICY "Units can be updated by property admins" ON units
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND 
        (
            auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
            (auth.jwt() ->> 'role' IN ('PROPERTY_ADMIN', 'FINANCE_ADMIN') 
             AND property_id = (SELECT property_id FROM user_profiles WHERE id = auth.uid()))
        )
    );

-- Secure Policies for tenants table
CREATE POLICY "Tenants can be viewed by authorized users" ON tenants
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        (
            auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
            (auth.jwt() ->> 'role' IN ('PROPERTY_ADMIN', 'FINANCE_ADMIN', 'GATE_OPERATOR', 'AUDITOR') 
             AND property_id = (SELECT property_id FROM user_profiles WHERE id = auth.uid())) OR
            (auth.jwt() ->> 'role' = 'TENANT' AND id = auth.uid())
        )
    );

CREATE POLICY "Tenants can be inserted by property admins" ON tenants
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        (
            auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
            (auth.jwt() ->> 'role' IN ('PROPERTY_ADMIN', 'FINANCE_ADMIN') 
             AND property_id = (SELECT property_id FROM user_profiles WHERE id = auth.uid()))
        )
    );

CREATE POLICY "Tenants can be updated by authorized users" ON tenants
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND 
        (
            auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
            (auth.jwt() ->> 'role' IN ('PROPERTY_ADMIN', 'FINANCE_ADMIN') 
             AND property_id = (SELECT property_id FROM user_profiles WHERE id = auth.uid())) OR
            (auth.jwt() ->> 'role' = 'TENANT' AND id = auth.uid() AND 
             -- Tenants can only update their own contact info, not financial data
             (current_balance is NOT DISTINCT FROM OLD(current_balance) AND
              is_locked_out is NOT DISTINCT FROM OLD(is_locked_out) AND
              gate_access_code is NOT DISTINCT FROM OLD(gate_access_code)))
        )
    );

-- Secure Policies for gate_logs table
CREATE POLICY "Gate logs can be viewed by authorized users" ON gate_logs
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        (
            auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
            (auth.jwt() ->> 'role' IN ('PROPERTY_ADMIN', 'FINANCE_ADMIN', 'GATE_OPERATOR', 'AUDITOR') 
             AND tenant_id IN (
                 SELECT id FROM tenants WHERE 
                 property_id = (SELECT property_id FROM user_profiles WHERE id = auth.uid())
             )) OR
            (auth.jwt() ->> 'role' = 'TENANT' AND tenant_id = auth.uid())
        )
    );

CREATE POLICY "Gate logs can be inserted by system and gate operators" ON gate_logs
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        (
            auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
            auth.jwt() ->> 'role' IN ('PROPERTY_ADMIN', 'GATE_OPERATOR') OR
            -- System insert for automated logging
            auth.jwt() ->> 'role' = 'service_role'
        )
    );

-- Policies for user_profiles table
CREATE POLICY "User profiles can be viewed by authenticated users" ON user_profiles
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        (
            auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
            id = auth.uid() OR
            (auth.jwt() ->> 'role' IN ('PROPERTY_ADMIN', 'FINANCE_ADMIN', 'AUDITOR') 
             AND property_id = (SELECT property_id FROM user_profiles WHERE id = auth.uid()))
        )
    );

CREATE POLICY "User profiles can be updated by admins or self" ON user_profiles
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND 
        (
            auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
            (id = auth.uid() AND 
             -- Users can only update limited fields
             (email is NOT DISTINCT FROM OLD(email) AND
              role is NOT DISTINCT FROM OLD(role) AND
              property_id is NOT DISTINCT FROM OLD(property_id)))
        )
    );

-- Policies for properties table
CREATE POLICY "Properties can be viewed by authenticated users" ON properties
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        (
            auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
            id IN (SELECT property_id FROM user_profiles WHERE id = auth.uid())
        )
    );

-- Create audit log function
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        table_name, 
        operation, 
        user_id, 
        old_data, 
        new_data, 
        timestamp
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        auth.uid(),
        row_to_json(OLD),
        row_to_json(NEW),
        now()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    user_id uuid REFERENCES auth.users(id),
    old_data JSONB,
    new_data JSONB,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs policy (only admins can view)
CREATE POLICY "Audit logs can be viewed by admins only" ON audit_logs
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'AUDITOR')
    );

-- Add audit triggers to sensitive tables
CREATE TRIGGER tenants_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tenants
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER units_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON units
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Create function to check if user has specific role
CREATE OR REPLACE FUNCTION has_role(user_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.jwt() ->> 'role' = user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;