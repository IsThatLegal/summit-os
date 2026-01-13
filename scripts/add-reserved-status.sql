-- Add 'reserved' to the units status check constraint

-- Drop the old constraint
ALTER TABLE units DROP CONSTRAINT IF EXISTS units_status_check;

-- Add new constraint with 'reserved' included
ALTER TABLE units ADD CONSTRAINT units_status_check
  CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved'));
