-- Direct SQL cleanup for test data
-- This will remove all test tenants and reset associated units

-- First, let's see what we're dealing with
SELECT id, first_name, last_name, email, phone, gate_access_code, unit_id, notes 
FROM tenants 
WHERE 
  email ILIKE '%e2e%' OR 
  email ILIKE '%test%' OR 
  email ILIKE '%example.com%' OR
  first_name ILIKE '%e2e%' OR 
  first_name ILIKE '%test%' OR
  gate_access_code ILIKE '%e2e%' OR
  phone ILIKE '%555-E2E%' OR
  phone ILIKE '%555-CLEAR%' OR
  phone ILIKE '%555-TEST%';

-- Update units back to available before deleting tenants
UPDATE units 
SET status = 'available' 
WHERE id IN (
  SELECT unit_id 
  FROM tenants 
  WHERE 
    email ILIKE '%e2e%' OR 
    email ILIKE '%test%' OR 
    email ILIKE '%example.com%' OR
    first_name ILIKE '%e2e%' OR 
    first_name ILIKE '%test%' OR
    gate_access_code ILIKE '%e2e%' OR
    phone ILIKE '%555-E2E%' OR
    phone ILIKE '%555-CLEAR%' OR
    phone ILIKE '%555-TEST%'
) AND unit_id IS NOT NULL;

-- Delete the test tenants
DELETE FROM tenants 
WHERE 
  email ILIKE '%e2e%' OR 
  email ILIKE '%test%' OR 
  email ILIKE '%example.com%' OR
  first_name ILIKE '%e2e%' OR 
  first_name ILIKE '%test%' OR
  gate_access_code ILIKE '%e2e%' OR
  phone ILIKE '%555-E2E%' OR
  phone ILIKE '%555-CLEAR%' OR
  phone ILIKE '%555-TEST%';

-- Also clean up any test units that might have been created
UPDATE units 
SET status = 'available' 
WHERE 
  unit_number ILIKE '%A101%' OR 
  unit_number ILIKE '%A102%' OR 
  unit_number ILIKE '%B101%';

-- Show remaining tenants to verify cleanup
SELECT COUNT(*) as remaining_tenants FROM tenants;
SELECT id, first_name, last_name, email FROM tenants WHERE email ILIKE '%e2e%' OR first_name ILIKE '%e2e%';