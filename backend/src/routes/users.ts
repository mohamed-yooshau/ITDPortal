import { Router } from "express";
import pool from "../db.js";
import { requireAuth, AuthedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/me/exists", requireAuth, async (req: AuthedRequest, res) => {
  const email = req.user?.email || "";
  if (!email) {
    res.json({ exists: true });
    return;
  }
  try {
    if (email.endsWith("@local")) {
      const username = email.replace("@local", "");
      const result = await pool.query("SELECT 1 FROM local_admins WHERE username = $1", [username]);
      res.json({ exists: (result.rowCount ?? 0) > 0 });
      return;
    }
    const result = await pool.query("SELECT is_new FROM users WHERE email = $1", [email]);
    if (!result.rowCount) {
      res.json({ exists: false });
      return;
    }
    const isNew = result.rows[0]?.is_new === true;
    if (isNew) {
      await pool.query("UPDATE users SET is_new = false WHERE email = $1", [email]);
      res.json({ exists: false });
      return;
    }
    res.json({ exists: true });
  } catch (err) {
    res.json({ exists: true });
  }
});

export default router;
