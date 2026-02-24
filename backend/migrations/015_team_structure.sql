CREATE TABLE IF NOT EXISTS team_departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  rcno INT NOT NULL UNIQUE,
  department_id INT REFERENCES team_departments(id) ON DELETE SET NULL,
  parent_rcno INT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  name_override TEXT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_department ON team_members(department_id);
CREATE INDEX IF NOT EXISTS idx_team_members_parent ON team_members(parent_rcno);
