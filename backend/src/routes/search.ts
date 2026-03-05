import { Router, Response } from "express";
import { AuthedRequest, requireAuth } from "../middleware/auth.js";
import pool from "../db.js";
import { listPublishedGuides } from "../stores/guidesStore.js";
import { getSettingsMap } from "../settings.js";

const router = Router();
const APS_ENDPOINT = "https://api-aps.mtcc.com.mv/hierarchy";
const APS_TOKEN = process.env.APS_TOKEN || "";

async function resolveApsToken(): Promise<string> {
  const settings = await getSettingsMap();
  return settings.aps_api_token || APS_TOKEN || "";
}

router.get("/", requireAuth, async (req: AuthedRequest, res: Response) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.json({ results: [] });
    return;
  }
  const query = `%${q.toLowerCase()}%`;

  const services = await pool.query(
    `SELECT id, title, description FROM services
     WHERE LOWER(title) LIKE $1 OR LOWER(description) LIKE $1
     ORDER BY title ASC LIMIT 20`,
    [query]
  );

  const policies = await pool.query(
    `SELECT id, title FROM policies WHERE LOWER(title) LIKE $1 ORDER BY created_at DESC LIMIT 20`,
    [query]
  );

  const forms = await pool.query(
    `SELECT id, title, description FROM forms WHERE LOWER(title) LIKE $1 OR LOWER(description) LIKE $1
     ORDER BY title ASC LIMIT 20`,
    [query]
  );

  const guides = listPublishedGuides()
    .filter((guide) => guide.title.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 20)
    .map((guide) => ({
      id: guide.id,
      title: guide.title,
      description: guide.description || "",
      type: "guide"
    }));

  const results = [
    ...services.rows.map((row) => ({
      type: "service",
      id: row.id,
      title: row.title,
      description: row.description || "",
      url: "/services"
    })),
    ...forms.rows.map((row) => ({
      type: "form",
      id: row.id,
      title: row.title,
      description: row.description || "",
      url: "/services"
    })),
    ...policies.rows.map((row) => ({
      type: "policy",
      id: row.id,
      title: row.title,
      description: "",
      url: "/policies"
    })),
    ...guides.map((row) => ({
      type: "guide",
      id: row.id,
      title: row.title,
      description: row.description || "",
      url: `/guides/${row.id}`
    }))
  ];

  res.json({ results });
});

router.get("/people", requireAuth, async (req: AuthedRequest, res: Response) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.json({ person: null });
    return;
  }
  const token = await resolveApsToken();
  if (!token) {
    res.status(500).json({ error: "APS token not configured" });
    return;
  }
  const isRcno = /^\d+$/.test(q);
  const isEmail = q.includes("@");
  if (!isRcno && !isEmail) {
    res.status(400).json({ error: "Search by RC number or email." });
    return;
  }
  const url = isRcno
    ? `${APS_ENDPOINT}?rcno=${encodeURIComponent(q)}`
    : `${APS_ENDPOINT}?email=${encodeURIComponent(q)}`;
  try {
    const response = await fetch(url, { headers: { Authorization: token } });
    if (!response.ok) {
      res.status(404).json({ error: "Person not found" });
      return;
    }
    const payload = (await response.json()) as any;
    if (!payload?.employee) {
      res.status(404).json({ error: "Person not found" });
      return;
    }
    const employee = payload.employee;
    res.json({
      person: {
        employee: {
          rcno: employee.rcno,
          full_name: employee.full_name || "",
          post: employee.post || "",
          division: employee.division || "",
          email: employee.email || "",
          doj: employee.doj || "",
          photoUrl: employee.rcno ? `/api/aps/photo/${employee.rcno}` : ""
        },
        reportsTo: payload.reportsTo
          ? {
              rcno: payload.reportsTo.rcno || null,
              full_name: payload.reportsTo.full_name || "",
              post: payload.reportsTo.post || "",
              division: payload.reportsTo.division || "",
              email: payload.reportsTo.email || ""
            }
          : null,
        hod: payload.hod
          ? {
              rcno: payload.hod.rcno || null,
              full_name: payload.hod.full_name || "",
              post: payload.hod.post || "",
              division: payload.hod.division || "",
              email: payload.hod.email || ""
            }
          : null
      }
    });
  } catch {
    res.status(502).json({ error: "APS request failed" });
  }
});

export default router;
