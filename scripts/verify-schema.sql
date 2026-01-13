-- Run this in Supabase SQL Editor to verify all tables exist
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'tenants',
    'units',
    'transactions',
    'gate_logs',
    'user_profiles',
    'billing_logs',
    'payment_methods',
    'tenant_units'
  )
ORDER BY table_name;

-- Expected result: 8 tables
-- If you see all 8 tables, your schema is ready!
