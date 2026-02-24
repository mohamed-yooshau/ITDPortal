import { Router } from "express";
import path from "path";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const result = await pool.query(
    "SELECT id, title, file_url, kind, created_at FROM policies ORDER BY created_at DESC"
  );
  res.json({ policies: result.rows });
});

router.get("/:id/download", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid policy id" });
    return;
  }
  const result = await pool.query("SELECT file_url FROM policies WHERE id = $1", [id]);
  if (!result.rowCount) {
    res.status(404).json({ error: "Policy not found" });
    return;
  }
  const fileUrl = result.rows[0].file_url as string;
  if (!fileUrl) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  const filename = path.basename(fileUrl);
  const filePath = path.join("/uploads/policies", filename);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).json({ error: "File not found" });
    }
  });
});

export default router;
