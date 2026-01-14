-- Security & Compliance Migration for SummitOS
-- Includes: MFA, Expanded Audit Logging, GDPR/Data Retention, Authentication Events

-- ============================================
-- MULTI-FACTOR AUTHENTICATION (MFA)
-- ============================================

-- MFA methods table
CREATE TABLE IF NOT EXISTS mfa_methods (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    method_type TEXT NOT NULL CHECK (method_type IN ('sms', 'totp', 'backup_codes')),
    phone_number TEXT, -- For SMS
    secret TEXT, -- For TOTP (encrypted)
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    verified_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    UNIQUE(user_id, method_type)
);

-- MFA backup codes table (one-time use codes)
CREATE TABLE IF NOT EXISTS mfa_backup_codes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    code_hash TEXT NOT NULL, -- SHA-256 hash of the code
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '90 days')
);

-- MFA verification attempts (for rate limiting and security monitoring)
CREATE TABLE IF NOT EXISTS mfa_verification_attempts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    method_type TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address INET,
    user_agent TEXT,
    attempted_at TIMESTAMPTZ DEFAULT now()
);

-- MFA enforcement policy per role
CREATE TABLE IF NOT EXISTS mfa_enforcement_policy (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    role TEXT NOT NULL UNIQUE CHECK (role IN ('SUPER_ADMIN', 'PROPERTY_ADMIN', 'FINANCE_ADMIN', 'GATE_OPERATOR', 'TENANT', 'AUDITOR')),
    mfa_required BOOLEAN DEFAULT false,
    grace_period_days INTEGER DEFAULT 0, -- Days before enforcement
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on MFA tables
ALTER TABLE mfa_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_verification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_enforcement_policy ENABLE ROW LEVEL SECURITY;

-- RLS Policies for MFA tables
CREATE POLICY "Users can view own MFA methods" ON mfa_methods
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own MFA methods" ON mfa_methods
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own MFA methods" ON mfa_methods
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own MFA methods" ON mfa_methods
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own backup codes" ON mfa_backup_codes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view MFA enforcement policy" ON mfa_enforcement_policy
    FOR SELECT USING (
        auth.role() = 'authenticated' AND
        auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'PROPERTY_ADMIN')
    );

-- Insert default MFA enforcement (require MFA for admins)
INSERT INTO mfa_enforcement_policy (role, mfa_required, grace_period_days)
VALUES
    ('SUPER_ADMIN', true, 7),
    ('PROPERTY_ADMIN', true, 14),
    ('FINANCE_ADMIN', true, 14),
    ('AUDITOR', true, 30),
    ('GATE_OPERATOR', false, 0),
    ('TENANT', false, 0)
ON CONFLICT (role) DO NOTHING;

-- Create indexes for MFA tables
CREATE INDEX IF NOT EXISTS idx_mfa_methods_user_id ON mfa_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_user_id ON mfa_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_verification_attempts_user_id ON mfa_verification_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_verification_attempts_attempted_at ON mfa_verification_attempts(attempted_at);

-- ============================================
-- AUTHENTICATION EVENT LOGGING
-- ============================================

-- Authentication events table (logins, logouts, password resets, etc.)
CREATE TABLE IF NOT EXISTS auth_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT, -- Store email even if user is deleted
    event_type TEXT NOT NULL CHECK (event_type IN (
        'login_success',
        'login_failed',
        'logout',
        'password_reset_requested',
        'password_reset_completed',
        'password_changed',
        'mfa_enabled',
        'mfa_disabled',
        'mfa_verification_success',
        'mfa_verification_failed',
        'account_locked',
        'account_unlocked',
        'session_expired'
    )),
    ip_address INET,
    user_agent TEXT,
    country_code TEXT, -- For geo-blocking
    mfa_method_used TEXT, -- Which MFA method was used
    failure_reason TEXT, -- Why login failed
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;

-- Only admins and auditors can view auth events
CREATE POLICY "Auth events can be viewed by admins" ON auth_events
    FOR SELECT USING (
        auth.role() = 'authenticated' AND
        auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'AUDITOR')
    );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_auth_events_user_id ON auth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_email ON auth_events(email);
CREATE INDEX IF NOT EXISTS idx_auth_events_type ON auth_events(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_events_created_at ON auth_events(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_events_ip_address ON auth_events(ip_address);

-- ============================================
-- EXPANDED AUDIT LOGGING
-- ============================================

-- Add audit triggers to financial tables (transactions, payment methods, etc.)
CREATE TRIGGER transactions_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER payment_methods_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER user_profiles_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Add IP address and user agent tracking to audit logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Create indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs(operation);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- ============================================
-- GDPR & DATA RETENTION
-- ============================================

-- Data retention policies table
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL UNIQUE,
    retention_period_days INTEGER NOT NULL,
    deletion_strategy TEXT NOT NULL CHECK (deletion_strategy IN ('hard_delete', 'soft_delete', 'archive')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default retention policies
INSERT INTO data_retention_policies (table_name, retention_period_days, deletion_strategy, description)
VALUES
    ('audit_logs', 2555, 'archive', 'Financial records: 7 years retention (SOX compliance)'),
    ('transactions', 2555, 'archive', 'Financial records: 7 years retention'),
    ('auth_events', 365, 'archive', 'Security events: 1 year retention'),
    ('gate_logs', 730, 'archive', 'Access logs: 2 years retention'),
    ('mfa_verification_attempts', 90, 'hard_delete', 'MFA attempts: 90 days retention'),
    ('billing_logs', 2555, 'archive', 'Billing records: 7 years retention'),
    ('payment_methods', 2555, 'soft_delete', 'Payment methods: soft delete when tenant leaves'),
    ('tenants', 2555, 'soft_delete', 'Tenant records: 7 years after lease end')
ON CONFLICT (table_name) DO NOTHING;

-- Add soft delete columns to relevant tables
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- GDPR data subject requests table
CREATE TABLE IF NOT EXISTS gdpr_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_type TEXT NOT NULL CHECK (request_type IN ('access', 'erasure', 'rectification', 'portability', 'restriction')),
    user_id uuid REFERENCES auth.users(id),
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
    requested_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    completed_by uuid REFERENCES auth.users(id),
    rejection_reason TEXT,
    data_export_url TEXT, -- For data portability requests
    notes TEXT
);

-- Enable RLS
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view retention policies" ON data_retention_policies
    FOR SELECT USING (
        auth.role() = 'authenticated' AND
        auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'AUDITOR')
    );

CREATE POLICY "Admins can manage GDPR requests" ON gdpr_requests
    FOR ALL USING (
        auth.role() = 'authenticated' AND
        auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'PROPERTY_ADMIN')
    );

-- Users can view their own GDPR requests
CREATE POLICY "Users can view own GDPR requests" ON gdpr_requests
    FOR SELECT USING (
        auth.uid() = user_id OR
        (auth.role() = 'authenticated' AND
         auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'PROPERTY_ADMIN'))
    );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user_id ON gdpr_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_email ON gdpr_requests(email);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON gdpr_requests(status);
CREATE INDEX IF NOT EXISTS idx_tenants_deleted_at ON tenants(deleted_at);

-- ============================================
-- SECURITY MONITORING & ALERTS
-- ============================================

-- Suspicious activity tracking
CREATE TABLE IF NOT EXISTS security_alerts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'multiple_failed_logins',
        'unusual_location',
        'suspicious_payment',
        'data_breach_attempt',
        'privilege_escalation',
        'unauthorized_access',
        'mass_data_export'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    user_id uuid REFERENCES auth.users(id),
    ip_address INET,
    description TEXT NOT NULL,
    metadata JSONB, -- Additional context
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
    resolved_by uuid REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

-- Only admins can view security alerts
CREATE POLICY "Security alerts admin access" ON security_alerts
    FOR ALL USING (
        auth.role() = 'authenticated' AND
        auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'AUDITOR')
    );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON security_alerts(created_at);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if user has MFA enabled
CREATE OR REPLACE FUNCTION has_mfa_enabled(check_user_id uuid)
RETURNS BOOLEAN AS $$
DECLARE
    mfa_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO mfa_count
    FROM mfa_methods
    WHERE user_id = check_user_id
      AND is_verified = true
      AND is_active = true;

    RETURN mfa_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if MFA is required for user
CREATE OR REPLACE FUNCTION is_mfa_required(check_user_id uuid)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    policy_required BOOLEAN;
    user_created_at TIMESTAMPTZ;
    grace_days INTEGER;
BEGIN
    -- Get user role
    SELECT role INTO user_role
    FROM user_profiles
    WHERE id = check_user_id;

    -- Get MFA policy for role
    SELECT mfa_required, grace_period_days INTO policy_required, grace_days
    FROM mfa_enforcement_policy
    WHERE role = user_role;

    -- If not required, return false
    IF NOT policy_required THEN
        RETURN false;
    END IF;

    -- Check grace period
    SELECT created_at INTO user_created_at
    FROM user_profiles
    WHERE id = check_user_id;

    -- If still in grace period, not required yet
    IF user_created_at + (grace_days || ' days')::INTERVAL > now() THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log authentication events
CREATE OR REPLACE FUNCTION log_auth_event(
    p_user_id uuid,
    p_email TEXT,
    p_event_type TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_mfa_method TEXT DEFAULT NULL,
    p_failure_reason TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO auth_events (
        user_id,
        email,
        event_type,
        ip_address,
        user_agent,
        mfa_method_used,
        failure_reason
    ) VALUES (
        p_user_id,
        p_email,
        p_event_type,
        p_ip_address,
        p_user_agent,
        p_mfa_method,
        p_failure_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create security alert
CREATE OR REPLACE FUNCTION create_security_alert(
    p_alert_type TEXT,
    p_severity TEXT,
    p_description TEXT,
    p_user_id uuid DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    alert_id uuid;
BEGIN
    INSERT INTO security_alerts (
        alert_type,
        severity,
        user_id,
        ip_address,
        description,
        metadata
    ) VALUES (
        p_alert_type,
        p_severity,
        p_user_id,
        p_ip_address,
        p_description,
        p_metadata
    ) RETURNING id INTO alert_id;

    RETURN alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old data based on retention policies
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE(table_name TEXT, deleted_count BIGINT) AS $$
DECLARE
    policy RECORD;
    deleted_rows BIGINT;
BEGIN
    FOR policy IN SELECT * FROM data_retention_policies LOOP
        -- Handle different deletion strategies
        IF policy.deletion_strategy = 'hard_delete' THEN
            CASE policy.table_name
                WHEN 'mfa_verification_attempts' THEN
                    DELETE FROM mfa_verification_attempts
                    WHERE attempted_at < now() - (policy.retention_period_days || ' days')::INTERVAL;
                    GET DIAGNOSTICS deleted_rows = ROW_COUNT;
                WHEN 'auth_events' THEN
                    -- Archive first, then delete
                    DELETE FROM auth_events
                    WHERE created_at < now() - (policy.retention_period_days || ' days')::INTERVAL;
                    GET DIAGNOSTICS deleted_rows = ROW_COUNT;
                ELSE
                    deleted_rows := 0;
            END CASE;

            RETURN QUERY SELECT policy.table_name, deleted_rows;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SCHEDULED JOBS (Comment with instructions)
-- ============================================

-- NOTE: Set up Supabase Edge Functions or cron jobs to run these periodically:
--
-- 1. Daily cleanup job:
--    SELECT * FROM cleanup_old_data();
--
-- 2. Weekly MFA compliance check:
--    SELECT u.id, u.email, up.role
--    FROM auth.users u
--    JOIN user_profiles up ON u.id = up.id
--    WHERE is_mfa_required(u.id) = true
--      AND has_mfa_enabled(u.id) = false;
--
-- 3. Security monitoring (check for suspicious patterns):
--    - Multiple failed login attempts from same IP
--    - Unusual access patterns
--    - Large data exports

COMMENT ON TABLE mfa_methods IS 'Stores user MFA methods (SMS, TOTP, backup codes)';
COMMENT ON TABLE auth_events IS 'Logs all authentication events for security monitoring';
COMMENT ON TABLE security_alerts IS 'Tracks suspicious activities and security incidents';
COMMENT ON TABLE gdpr_requests IS 'Manages GDPR data subject requests';
COMMENT ON TABLE data_retention_policies IS 'Defines how long data is retained before deletion/archival';
