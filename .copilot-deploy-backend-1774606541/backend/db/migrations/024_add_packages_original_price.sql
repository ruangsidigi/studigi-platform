ALTER TABLE packages
ADD COLUMN IF NOT EXISTS original_price NUMERIC(10, 2);

UPDATE packages
SET original_price = NULL
WHERE original_price IS NOT NULL AND original_price <= price;