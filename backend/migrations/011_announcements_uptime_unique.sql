DROP INDEX IF EXISTS announcements_uptime_unique;
CREATE UNIQUE INDEX announcements_uptime_unique
  ON announcements (source, service_id);
