import { Router } from "express";
import pool from "../db.js";
import { requireAuth, AuthedRequest } from "../middleware/auth.js";
import { isEntitledStatus } from "../utils/autodesk.js";

const router = Router();

router.get("/autodesk/licenses", requireAuth, async (req: AuthedRequest, res) => {
  const email = req.user?.email?.toLowerCase();
  if (!email) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const result = await pool.query(
    `SELECT product_name_friendly, team_name, status, last_used_at
     FROM autodesk_user_entitlements
     WHERE user_email = $1
     ORDER BY product_name_friendly ASC`,
    [email]
  );
  const entitlements = result.rows
    .filter((row) => isEntitledStatus(row.status))
    .map((row) => ({
      productName: row.product_name_friendly,
      teamName: row.team_name,
      status: row.status || "Assigned",
      lastUsedAt: row.last_used_at
    }));
  res.json({ entitlements });
});

export default router;
