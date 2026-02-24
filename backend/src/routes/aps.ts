import { Router, Response } from "express";
import { AuthedRequest, requireAuth } from "../middleware/auth.js";
import { getSettingsMap } from "../settings.js";

const router = Router();

const APS_ENDPOINT = "https://api-aps.mtcc.com.mv/hierarchy";
const APS_PHOTO_ENDPOINT = "https://api-aps.mtcc.com.mv/employee/ext/photo";
const APS_TOKEN = process.env.APS_TOKEN || "";
async function resolveApsToken(): Promise<string> {
  const settings = await getSettingsMap();
  return settings.aps_api_token || APS_TOKEN || "";
}

router.get("/me", requireAuth, async (req: AuthedRequest, res: Response) => {
  const email = req.user?.email;
  if (!email) {
    res.status(400).json({ error: "Missing user email" });
    return;
  }
  const token = await resolveApsToken();
  if (!token) {
    res.status(500).json({ error: "APS token not configured" });
    return;
  }
  try {
    const url = `${APS_ENDPOINT}?email=${encodeURIComponent(email)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: token
      }
    });
    if (!response.ok) {
      const text = await response.text();
      res.status(502).json({ error: "APS request failed", detail: text });
      return;
    }
    const payload = (await response.json()) as { employee?: Record<string, unknown> };
    if (!payload.employee) {
      res.status(502).json({ error: "APS response missing employee" });
      return;
    }
    const employee = payload.employee as {
      full_name?: string;
      rcno?: number | string;
      division?: string;
      email?: string;
      designation?: string;
      jobTitle?: string;
      post?: string;
    };
    const designation =
      employee.designation ||
      employee.jobTitle ||
      employee.post ||
      "";
    res.json({
      name: employee.full_name || "",
      rcno: employee.rcno ?? null,
      division: employee.division || "",
      email: employee.email || "",
      designation
    });
  } catch (err) {
    console.error("APS lookup failed", err);
    res.status(502).json({ error: "APS request failed" });
  }
});

router.get("/photo/:rcno", requireAuth, async (req: AuthedRequest, res: Response) => {
  const rcno = req.params.rcno;
  if (!rcno) {
    res.status(400).json({ error: "Missing RC number" });
    return;
  }
  const token = await resolveApsToken();
  if (!token) {
    res.status(500).json({ error: "APS token not configured" });
    return;
  }
  try {
    const url = `${APS_PHOTO_ENDPOINT}/${encodeURIComponent(rcno)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: token
      }
    });
    if (!response.ok) {
      const text = await response.text();
      res.status(502).json({ error: "APS photo request failed", detail: text });
      return;
    }
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.end(buffer);
  } catch (err) {
    console.error("APS photo lookup failed", err);
    res.status(502).json({ error: "APS photo request failed" });
  }
});

export default router;
