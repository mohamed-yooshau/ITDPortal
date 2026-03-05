import { Router } from "express";
import { getSettingsMap } from "../settings.js";
import { AuthedRequest, requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = Router();

const APS_ENDPOINT = "https://api-aps.mtcc.com.mv/hierarchy";
const APS_TOKEN = process.env.APS_TOKEN || "";
const HELPDESK_PORTAL_URL = "https://helpdesk.mtcc.com.mv/ticket";
const HELPDESK_STATUS_API_URL =
  process.env.HELPDESK_STATUS_API_URL ||
  "https://api-helpdesk.mtcc.com.mv/ticket/status-count";
const HELPDESK_STATUS_API_KEY = process.env.HELPDESK_STATUS_API_KEY || "";

type HelpdeskSite = {
  code: string;
  label: string;
  enabled?: boolean;
  sortOrder?: number;
};

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeSites(raw: unknown): HelpdeskSite[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const code = typeof entry?.code === "string" ? entry.code.trim() : "";
      const label = typeof entry?.label === "string" ? entry.label.trim() : "";
      const enabled = typeof entry?.enabled === "boolean" ? entry.enabled : true;
      const sortOrder =
        typeof entry?.sortOrder === "number" && Number.isFinite(entry.sortOrder)
          ? entry.sortOrder
          : 0;
      return { code, label, enabled, sortOrder };
    })
    .filter((entry) => entry.code && entry.label);
}

async function fetchEmployeeRcno(email: string): Promise<number | null> {
  const settings = await getSettingsMap();
  const token = settings.aps_api_token || APS_TOKEN || "";
  if (!token) {
    throw new Error("APS token not configured");
  }
  const url = `${APS_ENDPOINT}?email=${encodeURIComponent(email)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: token
    }
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as {
    employee?: { rcno?: number | string };
  };
  const rcno = payload.employee?.rcno;
  if (rcno === undefined || rcno === null || rcno === "") {
    return null;
  }
  const numeric = typeof rcno === "number" ? rcno : Number(String(rcno).trim());
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric;
}

router.get("/config", async (_req, res) => {
  const settings = await getSettingsMap();
  const sites = normalizeSites(parseJson<HelpdeskSite[]>(settings.helpdesk_sites, []))
    .filter((site) => site.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((site) => ({ code: site.code, label: site.label }));
  const urgencyOptions = parseJson<string[]>(settings.helpdesk_urgency_options, []);
  const enableAssets = settings.helpdesk_enable_assets === "true";
  res.json({
    sites,
    urgencyOptions: urgencyOptions.length ? urgencyOptions : ["Low", "Medium", "High"],
    enableAssets,
    defaultSiteCode: settings.helpdesk_default_site_code || ""
  });
});

router.post("/ticket/create", requireAuth, async (req: AuthedRequest, res) => {
  const { siteCode, title, body, urgency, assets } = req.body as {
    siteCode?: string;
    title?: string;
    body?: string;
    urgency?: string;
    assets?: string[] | null;
  };
  if (!title || !body) {
    res.status(400).json({ error: "Title and description are required." });
    return;
  }
  const settings = await getSettingsMap();
  const fallbackSiteCode = settings.helpdesk_default_site_code || "";
  const resolvedSiteCode = siteCode || fallbackSiteCode;
  const sites = normalizeSites(parseJson<HelpdeskSite[]>(settings.helpdesk_sites, []))
    .filter((site) => site.enabled !== false);
  if (!resolvedSiteCode || !sites.find((site) => site.code === resolvedSiteCode)) {
    res.status(400).json({ error: "Invalid site selection." });
    return;
  }
  const baseUrlRaw = settings.helpdesk_api_base_url || "";
  const baseUrl = baseUrlRaw.replace(/\/ticket\/create\/?$/i, "").replace(/\/$/, "");
  const apiKeyHeaderName = settings.helpdesk_api_key_header || "";
  const apiKeyValue = settings.helpdesk_api_key_value || "";
  if (!baseUrl || !apiKeyHeaderName || !apiKeyValue) {
    res.status(500).json({ error: "Helpdesk API is not configured." });
    return;
  }
  const userEmail = req.user?.email || "";
  let rcno: number | null = null;
  try {
    rcno = userEmail ? await fetchEmployeeRcno(userEmail) : null;
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "APS token not configured." });
    return;
  }
  if (!rcno) {
    res.status(502).json({ error: "Unable to resolve employee RC number." });
    return;
  }
  const payload = {
    siteCode: resolvedSiteCode,
    title,
    body,
    urgency,
    assets: Array.isArray(assets) ? assets : undefined,
    source: settings.helpdesk_source || "Portal",
    rcno
  };
  try {
    const response = await fetch(`${baseUrl}/ticket/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [apiKeyHeaderName]: apiKeyValue
      },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    if (!response.ok) {
      res.status(response.status).json({ error: "Helpdesk request failed", detail: text });
      return;
    }
    try {
      const data = JSON.parse(text) as { id?: number };
      const ticketId = typeof data.id === "number" ? data.id : null;
      if (ticketId && req.user?.email) {
        await pool.query(
          "INSERT INTO helpdesk_tickets (user_email, ticket_id, title) VALUES ($1, $2, $3)",
          [req.user.email, ticketId, title.trim()]
        );
      }
      res.json({
        ...data,
        ticketNumber: ticketId,
        url: ticketId ? `${HELPDESK_PORTAL_URL}/${ticketId}` : undefined
      });
    } catch {
      res.json({ ok: true, raw: text });
    }
  } catch (err) {
    console.error("Helpdesk ticket create failed", err);
    res.status(502).json({ error: "Helpdesk request failed" });
  }
});

router.get("/tickets", requireAuth, async (req: AuthedRequest, res) => {
  if (!req.user?.email) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const result = await pool.query(
    "SELECT ticket_id, title, created_at FROM helpdesk_tickets WHERE user_email = $1 ORDER BY created_at DESC",
    [req.user.email]
  );
  const tickets = result.rows.map((row) => ({
    ticketNumber: row.ticket_id,
    title: row.title,
    createdAt: row.created_at,
    url: `${HELPDESK_PORTAL_URL}/${row.ticket_id}`
  }));
  res.json({ tickets });
});

router.get("/status-count", requireAuth, async (req, res) => {
  const site =
    typeof req.query.site === "string" && req.query.site.trim()
      ? req.query.site.trim()
      : "ICT";
  if (!HELPDESK_STATUS_API_KEY) {
    res.status(500).json({ message: "Helpdesk status API is not configured." });
    return;
  }
  let url: URL;
  try {
    url = new URL(HELPDESK_STATUS_API_URL);
  } catch {
    res.status(500).json({ message: "Helpdesk status API is misconfigured." });
    return;
  }
  url.searchParams.set("site", site);
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: HELPDESK_STATUS_API_KEY
      }
    });
    const text = await response.text();
    if (!response.ok) {
      console.error("Helpdesk status-count failed", response.status, text);
      res.status(502).json({ message: "Unable to load ticket status counts." });
      return;
    }
    try {
      const payload = JSON.parse(text) as unknown;
      res.json({ data: payload });
    } catch (err) {
      console.error("Helpdesk status-count parse failed", err);
      res.status(502).json({ message: "Unable to load ticket status counts." });
    }
  } catch (err) {
    console.error("Helpdesk status-count request failed", err);
    res.status(502).json({ message: "Unable to load ticket status counts." });
  }
});

export default router;
