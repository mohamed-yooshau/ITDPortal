import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";
import { addAnnouncementClient, broadcastAnnouncementsUpdate } from "../services/announcementsHub.js";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const { rows } = await pool.query(
    `
    SELECT
      id,
      source,
      kind,
      title,
      message,
      severity,
      pinned,
      service_id,
      service_name,
      created_at,
      updated_at,
      CASE
        WHEN source = 'manual' AND now() < starts_at THEN 'scheduled'
        WHEN source = 'manual' AND (ends_at IS NULL OR now() <= ends_at) THEN 'active'
        WHEN source = 'manual' AND ends_at IS NOT NULL AND now() > ends_at THEN 'expired'
        ELSE status
      END AS status
    FROM announcements
    WHERE
      (source = 'manual' AND starts_at <= now() AND (ends_at IS NULL OR now() <= ends_at))
      OR (source = 'uptime_kuma' AND status = 'active')
    ORDER BY
      (source = 'uptime_kuma' AND severity = 'critical') DESC,
      pinned DESC,
      created_at DESC
    `
  );

  res.json({ announcements: rows });
});

router.get("/summary", requireAuth, async (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 3, 10));
  const { rows } = await pool.query(
    `
    SELECT
      id,
      source,
      kind,
      title,
      message,
      severity,
      pinned,
      service_id,
      service_name,
      created_at,
      updated_at,
      CASE
        WHEN source = 'manual' AND now() < starts_at THEN 'scheduled'
        WHEN source = 'manual' AND (ends_at IS NULL OR now() <= ends_at) THEN 'active'
        WHEN source = 'manual' AND ends_at IS NOT NULL AND now() > ends_at THEN 'expired'
        ELSE status
      END AS status
    FROM announcements
    WHERE
      (source = 'manual' AND starts_at <= now() AND (ends_at IS NULL OR now() <= ends_at))
      OR (source = 'uptime_kuma' AND status = 'active')
    ORDER BY
      (source = 'uptime_kuma' AND severity = 'critical') DESC,
      pinned DESC,
      created_at DESC
    LIMIT $1
    `,
    [limit]
  );
  res.json({ announcements: rows, limit });
});

router.get("/stream", requireAuth, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write("event: announcements:update\ndata: {\"type\":\"connected\"}\n\n");
  addAnnouncementClient(res);
  req.on("close", () => {
    res.end();
  });
});

export function triggerAnnouncementsUpdate() {
  broadcastAnnouncementsUpdate();
}

export default router;
