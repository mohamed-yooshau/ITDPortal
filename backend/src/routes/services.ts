import { Router } from "express";
import pool from "../db.js";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, requireRole(["admin", "superadmin"]), async (_req, res) => {
  const result = await pool.query(
    "SELECT s.id, s.code, s.title, s.description, s.icon, s.status, s.form_link, s.created_at, s.updated_at, c.name as category FROM services s LEFT JOIN categories c ON s.category_id = c.id ORDER BY s.id"
  );
  res.json({ services: result.rows });
});

router.get("/:id", requireAuth, requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    "SELECT s.id, s.code, s.title, s.description, s.icon, s.status, s.form_link, s.created_at, s.updated_at, c.name as category FROM services s LEFT JOIN categories c ON s.category_id = c.id WHERE s.id = $1",
    [id]
  );
  if (!result.rowCount) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ service: result.rows[0] });
});

router.post("/", requireAuth, requireRole(["admin", "superadmin"]), async (req: AuthedRequest, res) => {
  const { code, title, description, category_id, icon, status, form_link } = req.body;
  const result = await pool.query(
    "INSERT INTO services (code, title, description, category_id, icon, status, form_link) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
    [code, title, description, category_id || null, icon, status, form_link]
  );
  res.json({ service: result.rows[0] });
});

router.put("/:id", requireAuth, requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { code, title, description, category_id, icon, status, form_link } = req.body;
  const result = await pool.query(
    "UPDATE services SET code=$1, title=$2, description=$3, category_id=$4, icon=$5, status=$6, form_link=$7, updated_at=NOW() WHERE id=$8 RETURNING *",
    [code, title, description, category_id || null, icon, status, form_link, id]
  );
  res.json({ service: result.rows[0] });
});

router.delete("/:id", requireAuth, requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM services WHERE id = $1", [id]);
  res.json({ ok: true });
});

export default router;
