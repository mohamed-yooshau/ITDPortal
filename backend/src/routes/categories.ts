import { Router } from "express";
import pool from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, requireRole(["admin", "superadmin"]), async (_req, res) => {
  const result = await pool.query("SELECT id, name FROM categories ORDER BY name");
  res.json({ categories: result.rows });
});

router.post("/", requireAuth, requireRole(["admin", "superadmin"]), async (req, res) => {
  const { name } = req.body;
  const result = await pool.query("INSERT INTO categories (name) VALUES ($1) RETURNING *", [name]);
  res.json({ category: result.rows[0] });
});

router.put("/:id", requireAuth, requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const result = await pool.query("UPDATE categories SET name = $1 WHERE id = $2 RETURNING *", [name, id]);
  res.json({ category: result.rows[0] });
});

router.delete("/:id", requireAuth, requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM categories WHERE id = $1", [id]);
  res.json({ ok: true });
});

export default router;
