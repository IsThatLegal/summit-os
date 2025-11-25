-- Insert sample units
INSERT INTO units (unit_number, size, monthly_price, status, door_type) VALUES
('A101', '10x10', 100, 'occupied', 'roll-up'),
('A102', '10x10', 100, 'available', 'roll-up'),
('A103', '10x15', 150, 'occupied', 'swing'),
('A104', '5x5', 50, 'available', 'roll-up'),
('A105', '10x20', 200, 'maintenance', 'roll-up');

-- Insert sample tenants
INSERT INTO tenants (first_name, email, phone, current_balance, gate_access_code, is_locked_out) VALUES
('Alice', 'alice@example.com', '555-1111', 0, '1234', FALSE),
('Bob', 'bob@example.com', '555-2222', 100, '5678', FALSE),
('Charlie', 'charlie@example.com', '555-3333', 0, '9012', FALSE);

-- Insert sample gate logs (linking to tenants)
INSERT INTO gate_logs (tenant_id, action) VALUES
((SELECT id FROM tenants WHERE first_name = 'Alice'), 'entry'),
((SELECT id FROM tenants WHERE first_name = 'Bob'), 'exit'),
((SELECT id FROM tenants WHERE first_name = 'Alice'), 'denied_payment');
