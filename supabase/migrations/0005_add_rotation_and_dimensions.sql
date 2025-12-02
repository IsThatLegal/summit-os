-- Add rotation and dimensions to units table
ALTER TABLE units 
ADD COLUMN rotation INTEGER DEFAULT 0,
ADD COLUMN width INTEGER DEFAULT 10,
ADD COLUMN depth INTEGER DEFAULT 10,
ADD COLUMN height INTEGER DEFAULT 8,
ADD COLUMN x INTEGER DEFAULT 0,
ADD COLUMN y INTEGER DEFAULT 0;

-- Add check constraint for rotation (0, 90, 180, 270 degrees)
ALTER TABLE units 
ADD CONSTRAINT check_rotation CHECK (rotation IN (0, 90, 180, 270));