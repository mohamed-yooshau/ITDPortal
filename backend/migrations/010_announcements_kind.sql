ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'announcement'
  CHECK (kind IN ('information','announcement','system_maintenance'));

UPDATE announcements
SET kind = 'system_maintenance'
WHERE source = 'uptime_kuma';
