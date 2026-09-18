ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id);
