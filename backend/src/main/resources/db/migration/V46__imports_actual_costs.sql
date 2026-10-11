-- Migration V46: Estimated vs Actual Costs for Imports Lifecycle
ALTER TABLE international_shipments ADD COLUMN IF NOT EXISTS estimated_freight_cost NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE international_shipments ADD COLUMN IF NOT EXISTS actual_freight_cost NUMERIC(12,2);
ALTER TABLE international_shipments ADD COLUMN IF NOT EXISTS estimated_customs_cost NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE international_shipments ADD COLUMN IF NOT EXISTS actual_customs_cost NUMERIC(12,2);

UPDATE international_shipments
SET estimated_freight_cost = COALESCE(freight_cost, 0),
    estimated_customs_cost = COALESCE(customs_cost, 0)
WHERE estimated_freight_cost IS NULL OR estimated_freight_cost = 0;

