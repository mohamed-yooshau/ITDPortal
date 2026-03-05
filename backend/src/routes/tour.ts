import { Router } from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'tour_steps'");
    if (!result.rowCount) {
      res.json({ steps: [] });
      return;
    }
    const raw = result.rows[0].value as string;
    let steps: unknown = [];
    try {
      steps = JSON.parse(raw);
    } catch {
      steps = [];
    }
    if (!Array.isArray(steps)) {
      res.json({ steps: [] });
      return;
    }
    const normalized = steps
      .filter((step) => step && typeof step === "object")
      .map((step: any) => ({
        id: String(step.id || ""),
        title: String(step.title || ""),
        body: String(step.body || ""),
        selector: String(step.selector || ""),
        route: step.route ? String(step.route) : undefined,
        placement: step.placement ? String(step.placement) : undefined,
        enabled: step.enabled !== false
      }))
      .filter((step) => step.enabled && step.title && step.body && step.selector);
    res.json({ steps: normalized });
  } catch {
    res.json({ steps: [] });
  }
});

export default router;
