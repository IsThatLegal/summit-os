-- units table
CREATE TABLE units (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_number TEXT NOT NULL UNIQUE,
    size TEXT NOT NULL,
    monthly_price INT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('available', 'occupied', 'maintenance')),
    door_type TEXT NOT NULL CHECK (door_type IN ('roll-up', 'swing'))
);

-- tenants table
CREATE TABLE tenants (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    current_balance INT DEFAULT 0,
    gate_access_code TEXT UNIQUE,
    is_locked_out BOOLEAN DEFAULT false
);

-- gate_logs table
CREATE TABLE gate_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES tenants(id),
    timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('entry', 'exit', 'denied_payment'))
);

-- Enable Row Level Security
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for development (allow all)
CREATE POLICY "Allow all" ON units FOR ALL USING (true);
CREATE POLICY "Allow all" ON tenants FOR ALL USING (true);
CREATE POLICY "Allow all" ON gate_logs FOR ALL USING (true);
-- 1. Create the transactions table
CREATE TABLE transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    type TEXT NOT NULL CHECK (type IN ('charge', 'payment', 'waiver', 'refund')),
    amount INT NOT NULL,
    description TEXT,
    stripe_payment_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS for the new table
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on transactions" ON transactions FOR ALL USING (true);


-- 2. Create the trigger function
CREATE OR REPLACE FUNCTION update_tenant_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the tenant's current_balance by adding the new transaction's amount.
    -- Charges should have a positive amount.
    -- Payments, waivers, and refunds should have a negative amount.
    UPDATE tenants
    SET current_balance = current_balance + NEW.amount
    WHERE id = NEW.tenant_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 3. Create the trigger
CREATE TRIGGER on_transaction_insert
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_tenant_balance();
-- Add the license_plate column to the tenants table
ALTER TABLE tenants
ADD COLUMN license_plate TEXT;

-- Add a unique constraint to the license_plate column to prevent duplicates
ALTER TABLE tenants
ADD CONSTRAINT unique_license_plate UNIQUE (license_plate);

-- Update an existing tenant with a test license plate for verification
-- We'll use "Alice" from our original seed data.
UPDATE tenants
SET license_plate = 'SKIBIDI'
WHERE email = 'alice@example.com';
-- Add a `unit_id` column to the `tenants` table, linking it to a unit.
ALTER TABLE tenants
ADD COLUMN unit_id UUID REFERENCES units(id);

-- Add a unique constraint to ensure only one tenant can be assigned to a unit.
ALTER TABLE tenants
ADD CONSTRAINT unique_tenant_unit_assignment UNIQUE (unit_id);

-- Create a function to automatically update the unit's status.
CREATE OR REPLACE FUNCTION update_unit_status_on_tenant_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If a tenant is being assigned to a unit (on INSERT or UPDATE)
    IF NEW.unit_id IS NOT NULL THEN
        UPDATE units
        SET status = 'occupied'
        WHERE id = NEW.unit_id;
    END IF;

    -- If a tenant is being unassigned from a unit (on UPDATE or DELETE)
    -- The trigger runs BEFORE the row is deleted, so OLD is available.
    IF TG_OP = 'UPDATE' AND OLD.unit_id IS NOT NULL AND NEW.unit_id IS DISTINCT FROM OLD.unit_id THEN
        UPDATE units
        SET status = 'available'
        WHERE id = OLD.unit_id;
    ELSIF TG_OP = 'DELETE' AND OLD.unit_id IS NOT NULL THEN
        UPDATE units
        SET status = 'available'
        WHERE id = OLD.unit_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger that fires after a tenant is assigned, moved, or deleted.
CREATE TRIGGER on_tenant_change
AFTER INSERT OR UPDATE OR DELETE ON tenants
FOR EACH ROW
EXECUTE FUNCTION update_unit_status_on_tenant_change();
-- Add rotation and dimensions to units table
ALTER TABLE units 
ADD COLUMN rotation INTEGER DEFAULT 0,
ADD COLUMN width INTEGER DEFAULT 10,
ADD COLUMN depth INTEGER DEFAULT 10,
ADD COLUMN height INTEGER DEFAULT 8,
ADD COLUMN x INTEGER DEFAULT 0,
ADD COLUMN y INTEGER DEFAULT 0;

-- Add check constraint for rotation (0, 90, 180, 270 degrees)
ALTER TABLE units 
ADD CONSTRAINT check_rotation CHECK (rotation IN (0, 90, 180, 270));-- Secure Row Level Security Policies for SummitOS

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
$$ LANGUAGE plpgsql SECURITY DEFINER;-- Create billing_logs table for automated billing tracking
CREATE TABLE IF NOT EXISTS billing_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL,
    total_tenants INTEGER NOT NULL,
    processed_count INTEGER NOT NULL,
    total_amount INTEGER NOT NULL, -- in cents
    errors TEXT[], -- Array of error messages
    success_rate TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE billing_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view billing logs
CREATE POLICY "Billing logs can be viewed by admins only" ON billing_logs
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'PROPERTY_ADMIN', 'FINANCE_ADMIN', 'AUDITOR')
    );

-- Only system/service can insert billing logs
CREATE POLICY "Billing logs can be inserted by system only" ON billing_logs
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        auth.jwt() ->> 'role' = 'service_role'
    );-- Payment Methods Migration for SummitOS
-- Supports credit cards, checks, money orders, and cash payments

-- Payment methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
    method_type TEXT NOT NULL CHECK (method_type IN ('credit_card', 'check', 'money_order', 'cash')),
    provider TEXT, -- e.g., 'stripe', 'manual', 'bank'
    last_four TEXT, -- Last 4 digits for cards/checks
    expiry_date DATE, -- For cards
    bank_name TEXT, -- For checks and money orders
    account_number TEXT, -- Encrypted or masked
    routing_number TEXT, -- For checks
    check_number TEXT, -- For checks
    money_order_number TEXT, -- For money orders
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Payment method details for credit cards (tokenized)
CREATE TABLE IF NOT EXISTS payment_method_details (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_method_id uuid REFERENCES payment_methods(id) ON DELETE CASCADE,
    stripe_payment_method_id TEXT, -- Stripe payment method token
    card_brand TEXT, -- visa, mastercard, etc.
    card_last_four TEXT,
    card_expiry_month INTEGER,
    card_expiry_year INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Update transactions table to support payment methods
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method_id uuid REFERENCES payment_methods(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded'));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS check_image_url TEXT; -- For check images
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_number TEXT; -- For check/money order numbers
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS processed_by TEXT; -- Who processed the payment
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes TEXT; -- Additional notes

-- Cash payment log for physical cash handling
CREATE TABLE IF NOT EXISTS cash_payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- in cents
    received_by TEXT NOT NULL, -- Staff member name
    verification_method TEXT CHECK (verification_method IN ('counterfeit_detector', 'manual_count', 'safe_drop_box')),
    cash_drawer_id TEXT, -- Which cash drawer
    receipt_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Check processing log
CREATE TABLE IF NOT EXISTS check_payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE,
    check_number TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    routing_number TEXT NOT NULL,
    account_number TEXT NOT NULL,
    check_image_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'deposited', 'bounced', 'cancelled')),
    nsf_fee INTEGER DEFAULT 0, -- Non-sufficient funds fee in cents
    created_at TIMESTAMPTZ DEFAULT now(),
    deposited_at TIMESTAMPTZ
);

-- Money order processing
CREATE TABLE IF NOT EXISTS money_order_payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE,
    money_order_number TEXT NOT NULL,
    issuing_organization TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'deposited', 'cancelled', 'fraud_suspect')),
    verification_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    verified_at TIMESTAMPTZ,
    verified_by TEXT
);

-- Enable Row Level Security
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_method_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_order_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment methods
CREATE POLICY "Tenants can view own payment methods" ON payment_methods
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        (
            auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'PROPERTY_ADMIN', 'FINANCE_ADMIN') OR
            (auth.jwt() ->> 'role' = 'TENANT' AND tenant_id = auth.uid())
        )
    );

CREATE POLICY "Tenants can insert own payment methods" ON payment_methods
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        auth.jwt() ->> 'role' = 'TENANT' AND tenant_id = auth.uid()
    );

CREATE POLICY "Tenants can update own payment methods" ON payment_methods
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND 
        (
            auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'PROPERTY_ADMIN', 'FINANCE_ADMIN') OR
            (auth.jwt() ->> 'role' = 'TENANT' AND tenant_id = auth.uid())
        )
    );

CREATE POLICY "Admins can manage all payment methods" ON payment_methods
    FOR DELETE USING (
        auth.role() = 'authenticated' AND 
        auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'PROPERTY_ADMIN', 'FINANCE_ADMIN')
    );

-- Similar policies for payment method details
CREATE POLICY "Payment method details access" ON payment_method_details
    FOR ALL USING (
        auth.role() = 'authenticated' AND 
        auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'PROPERTY_ADMIN', 'FINANCE_ADMIN')
    );

-- Cash payment policies
CREATE POLICY "Cash payment access" ON cash_payments
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'PROPERTY_ADMIN', 'FINANCE_ADMIN')
    );

CREATE POLICY "Cash payment insert" ON cash_payments
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'PROPERTY_ADMIN', 'FINANCE_ADMIN', 'GATE_OPERATOR')
    );

-- Check payment policies
CREATE POLICY "Check payment access" ON check_payments
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'PROPERTY_ADMIN', 'FINANCE_ADMIN')
    );

CREATE POLICY "Check payment insert" ON check_payments
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'PROPERTY_ADMIN', 'FINANCE_ADMIN', 'GATE_OPERATOR')
    );

-- Money order policies
CREATE POLICY "Money order access" ON money_order_payments
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'PROPERTY_ADMIN', 'FINANCE_ADMIN')
    );

CREATE POLICY "Money order insert" ON money_order_payments
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'PROPERTY_ADMIN', 'FINANCE_ADMIN', 'GATE_OPERATOR')
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant_id ON payment_methods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payment_methods(method_type);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_cash_payments_transaction ON cash_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_check_payments_transaction ON check_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_money_order_payments_transaction ON money_order_payments(transaction_id);