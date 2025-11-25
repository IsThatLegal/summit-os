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
