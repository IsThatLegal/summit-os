-- Create billing_logs table for automated billing tracking
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
    );