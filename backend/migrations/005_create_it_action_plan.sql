CREATE TABLE IF NOT EXISTS it_action_plan_initiatives (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS it_action_plan_segments (
  id SERIAL PRIMARY KEY,
  initiative_id INTEGER NOT NULL REFERENCES it_action_plan_initiatives(id) ON DELETE CASCADE,
  start_month INTEGER NOT NULL CHECK (start_month BETWEEN 1 AND 12),
  end_month INTEGER NOT NULL CHECK (end_month BETWEEN 1 AND 12),
  department TEXT NOT NULL CHECK (department IN ('ITOps', 'Infra', 'Dev', 'ERP', '3rd Party', 'Admin')),
  sort_order INTEGER
);

CREATE INDEX IF NOT EXISTS it_action_plan_segments_initiative_id_idx
  ON it_action_plan_segments (initiative_id);
