-- Fix gate_logs action constraint to match API values
-- The API uses 'entry_granted' and 'entry_denied' but the original constraint
-- only allowed 'entry', 'exit', 'denied_payment'

-- Drop the old constraint
ALTER TABLE gate_logs DROP CONSTRAINT IF EXISTS gate_logs_action_check;

-- Add the new constraint with correct values
ALTER TABLE gate_logs ADD CONSTRAINT gate_logs_action_check
  CHECK (action IN ('entry_granted', 'entry_denied', 'entry', 'exit', 'denied_payment'));

-- Update any existing records to use the new values (if needed)
UPDATE gate_logs SET action = 'entry_granted' WHERE action = 'entry';
UPDATE gate_logs SET action = 'entry_denied' WHERE action = 'denied_payment';
