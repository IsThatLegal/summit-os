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
