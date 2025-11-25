-- units table
CREATE TABLE units (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_number TEXT NOT NULL UNIQUE,
    size TEXT NOT NULL,
    monthly_price INT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('available', 'occupied', 'maintenance')),
    door_type TEXT NOT NULL CHECK (door_type IN ('roll-up', 'swing'))
);

-- tenants table
CREATE TABLE tenants (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    current_balance INT DEFAULT 0,
    gate_access_code TEXT UNIQUE,
    is_locked_out BOOLEAN DEFAULT false
);

-- gate_logs table
CREATE TABLE gate_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES tenants(id),
    timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('entry', 'exit', 'denied_payment'))
);

-- Enable Row Level Security
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for development (allow all)
CREATE POLICY "Allow all" ON units FOR ALL USING (true);
CREATE POLICY "Allow all" ON tenants FOR ALL USING (true);
CREATE POLICY "Allow all" ON gate_logs FOR ALL USING (true);
