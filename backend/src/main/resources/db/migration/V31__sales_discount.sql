-- Migration V31: Add discount support to sales
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK(discount >= 0);

