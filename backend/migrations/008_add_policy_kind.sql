ALTER TABLE policies
ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'policy';

ALTER TABLE policies
DROP CONSTRAINT IF EXISTS policies_kind_check;

ALTER TABLE policies
ADD CONSTRAINT policies_kind_check CHECK (kind IN ('policy', 'procedure'));
