CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('manual','uptime_kuma')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  status TEXT NOT NULL CHECK (status IN ('scheduled','active','expired','resolved')),
  pinned BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NULL,
  service_id TEXT NULL,
  service_name TEXT NULL,
  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_source_status_idx ON announcements (source, status);
CREATE INDEX IF NOT EXISTS announcements_starts_idx ON announcements (starts_at);
CREATE INDEX IF NOT EXISTS announcements_ends_idx ON announcements (ends_at);
CREATE INDEX IF NOT EXISTS announcements_service_idx ON announcements (service_id);

CREATE UNIQUE INDEX IF NOT EXISTS announcements_uptime_unique
  ON announcements (source, service_id)
  WHERE source = 'uptime_kuma';

CREATE TABLE IF NOT EXISTS monitored_services (
  service_id TEXT PRIMARY KEY,
  service_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
