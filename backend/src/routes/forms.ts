import { Router } from "express";
import pool from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const result = await pool.query("SELECT id, title, type, url, description FROM forms ORDER BY id");
  res.json({ forms: result.rows });
});

router.post("/", requireAuth, requireRole(["admin", "superadmin"]), async (req, res) => {
  const { title, type, url, description } = req.body;
  const result = await pool.query(
    "INSERT INTO forms (title, type, url, description) VALUES ($1,$2,$3,$4) RETURNING *",
    [title, type, url, description]
  );
  res.json({ form: result.rows[0] });
});

router.put("/:id", requireAuth, requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { title, type, url, description } = req.body;
  const result = await pool.query(
    "UPDATE forms SET title=$1, type=$2, url=$3, description=$4 WHERE id=$5 RETURNING *",
    [title, type, url, description, id]
  );
  res.json({ form: result.rows[0] });
});

router.delete("/:id", requireAuth, requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM forms WHERE id = $1", [id]);
  res.json({ ok: true });
});

export default router;
