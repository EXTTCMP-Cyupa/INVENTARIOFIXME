-- V37: 15-Day Free Trial Stores and Plan Conversion
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at DATE DEFAULT (CURRENT_DATE + interval '15 days');
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS intended_plan TEXT DEFAULT 'PRO';

-- Create index for fast trial queries
CREATE INDEX IF NOT EXISTS idx_tenants_is_trial ON tenants (is_trial, trial_ends_at);

-- Update existing trial stores if any
UPDATE tenants
SET is_trial = false
WHERE is_trial IS NULL;

