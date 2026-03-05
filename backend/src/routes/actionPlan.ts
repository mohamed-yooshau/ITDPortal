import { Router } from "express";
import pool from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { summarizeInitiativesForQuarter } from "../utils/actionPlanQuarter.js";

const router = Router();

const allowedDepartments = new Set(["ITOps", "Infra", "Dev", "ERP", "3rd Party", "Admin"]);

type SegmentInput = {
  start_month?: number;
  end_month?: number;
  department?: string;
  sort_order?: number | null;
};

function validateSegments(segments: SegmentInput[]): { ok: boolean; error?: string } {
  if (!Array.isArray(segments) || segments.length < 1) {
    return { ok: false, error: "At least one segment is required" };
  }
  for (const seg of segments) {
    if (typeof seg.start_month !== "number" || typeof seg.end_month !== "number") {
      return { ok: false, error: "Segment start/end month must be numbers" };
    }
    if (seg.start_month < 1 || seg.start_month > 12 || seg.end_month < 1 || seg.end_month > 12) {
      return { ok: false, error: "Segment month must be between 1 and 12" };
    }
    if (seg.end_month < seg.start_month) {
      return { ok: false, error: "Segment end month must be after start month" };
    }
    if (!seg.department || !allowedDepartments.has(seg.department)) {
      return { ok: false, error: "Invalid department" };
    }
  }
  return { ok: true };
}

async function fetchInitiatives() {
  const result = await pool.query(
    `SELECT i.id, i.name, i.created_at, i.updated_at,
            COALESCE(json_agg(json_build_object(
              'id', s.id,
              'start_month', s.start_month,
              'end_month', s.end_month,
              'department', s.department,
              'sort_order', s.sort_order
            ) ORDER BY s.sort_order NULLS LAST, s.start_month) FILTER (WHERE s.id IS NOT NULL), '[]') AS segments
     FROM it_action_plan_initiatives i
     LEFT JOIN it_action_plan_segments s ON s.initiative_id = i.id
     GROUP BY i.id
     ORDER BY i.id`
  );
  return result.rows.map((row) => ({
    ...row,
    segments: Array.isArray(row.segments) ? row.segments : []
  }));
}

router.get("/initiatives", requireAuth, async (_req, res) => {
  const initiatives = await fetchInitiatives();
  res.json({ initiatives });
});

router.get("/current-quarter-summary", requireAuth, async (_req, res) => {
  const initiatives = await fetchInitiatives();
  const summary = summarizeInitiativesForQuarter(initiatives, new Date(), 5);
  res.json(summary);
});

router.post("/initiatives", requireAuth, requireRole(["admin", "superadmin", "planner"]), async (req, res) => {
  const { name, segments } = req.body as { name?: string; segments?: SegmentInput[] };
  if (!name || !name.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const validation = validateSegments(segments || []);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const initResult = await client.query(
      "INSERT INTO it_action_plan_initiatives (name) VALUES ($1) RETURNING *",
      [name.trim()]
    );
    const initiative = initResult.rows[0];
    for (const [index, seg] of (segments || []).entries()) {
      await client.query(
        "INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES ($1,$2,$3,$4,$5)",
        [initiative.id, seg.start_month, seg.end_month, seg.department, seg.sort_order ?? index + 1]
      );
    }
    await client.query("COMMIT");
    const initiatives = await fetchInitiatives();
    const created = initiatives.find((item) => item.id === initiative.id);
    res.json({ initiative: created });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

router.put("/initiatives/:id", requireAuth, requireRole(["admin", "superadmin", "planner"]), async (req, res) => {
  const { id } = req.params;
  const { name, segments } = req.body as { name?: string; segments?: SegmentInput[] };
  if (!name || !name.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const validation = validateSegments(segments || []);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      "UPDATE it_action_plan_initiatives SET name=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [name.trim(), id]
    );
    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Not found" });
      return;
    }
    await client.query("DELETE FROM it_action_plan_segments WHERE initiative_id = $1", [id]);
    for (const [index, seg] of (segments || []).entries()) {
      await client.query(
        "INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES ($1,$2,$3,$4,$5)",
        [id, seg.start_month, seg.end_month, seg.department, seg.sort_order ?? index + 1]
      );
    }
    await client.query("COMMIT");
    const initiatives = await fetchInitiatives();
    const initiative = initiatives.find((item) => item.id === Number(id));
    res.json({ initiative });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

router.delete("/initiatives/:id", requireAuth, requireRole(["admin", "superadmin", "planner"]), async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM it_action_plan_initiatives WHERE id = $1", [id]);
  res.json({ ok: true });
});

export default router;
