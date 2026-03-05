import { Router } from "express";
import pool from "../db.js";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const result = await pool.query(
    "SELECT id, title, category, body, tags, author, created_at, updated_at FROM knowledge_base ORDER BY created_at DESC"
  );
  res.json({ articles: result.rows });
});

router.get("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    "SELECT id, title, category, body, tags, author, created_at, updated_at FROM knowledge_base WHERE id = $1",
    [id]
  );
  if (!result.rowCount) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ article: result.rows[0] });
});

router.post("/", requireAuth, requireRole(["admin", "superadmin"]), async (req: AuthedRequest, res) => {
  const { title, category, body, tags } = req.body;
  const author = req.user?.name || req.user?.email || "Unknown";
  const result = await pool.query(
    "INSERT INTO knowledge_base (title, category, body, tags, author) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [title, category, body, tags, author]
  );
  res.json({ article: result.rows[0] });
});

router.put("/:id", requireAuth, requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { title, category, body, tags } = req.body;
  const result = await pool.query(
    "UPDATE knowledge_base SET title=$1, category=$2, body=$3, tags=$4, updated_at=NOW() WHERE id=$5 RETURNING *",
    [title, category, body, tags, id]
  );
  res.json({ article: result.rows[0] });
});

router.delete("/:id", requireAuth, requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM knowledge_base WHERE id = $1", [id]);
  res.json({ ok: true });
});

export default router;
