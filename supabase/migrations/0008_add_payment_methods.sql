-- Payment Methods Migration for SummitOS
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