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
