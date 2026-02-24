CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS autodesk_license_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_type TEXT NOT NULL DEFAULT 'unknown',
  raw_file_name TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  written_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB
);

CREATE TABLE IF NOT EXISTS autodesk_user_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  product_name_raw TEXT NOT NULL,
  product_name_friendly TEXT NOT NULL,
  product_key TEXT NOT NULL,
  team_name TEXT,
  status TEXT,
  last_used_at TIMESTAMPTZ,
  import_id UUID REFERENCES autodesk_license_imports(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_email, product_key)
);

CREATE INDEX IF NOT EXISTS idx_autodesk_user_email ON autodesk_user_entitlements (user_email);
CREATE INDEX IF NOT EXISTS idx_autodesk_product_key ON autodesk_user_entitlements (product_key);
