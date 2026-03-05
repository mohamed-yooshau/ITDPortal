import { Router } from "express";
import pool from "../db.js";
import { broadcastAnnouncementsUpdate } from "../services/announcementsHub.js";
import { getSettingsMap } from "../settings.js";
import http from "node:http";
import https from "node:https";

const router = Router();

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function buildMonitorListUrl(baseUrl: string, endpointOverride?: string): string {
  if (endpointOverride) {
    return endpointOverride.trim();
  }
  const trimmed = normalizeBaseUrl(baseUrl);
  if (trimmed.includes("/api/status-page/")) {
    return trimmed;
  }
  if (trimmed.endsWith("/api")) {
    return `${trimmed}/monitor/list`;
  }
  if (trimmed.includes("/api/")) {
    return `${trimmed}/monitor/list`;
  }
  return `${trimmed}/api/monitor/list`;
}

function appendQuery(url: string, key: string, value: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set(key, value);
  return parsed.toString();
}

function isLikelySelfSigned(value?: string): boolean {
  if (!value) return false;
  return /https:\/\/(localhost|127\.0\.0\.1|\d{1,3}(\.\d{1,3}){3})/i.test(value);
}

async function postJson(url: string, body: Record<string, unknown>, allowInsecure: boolean) {
  const parsed = new URL(url);
  const payload = JSON.stringify(body);
  const isHttps = parsed.protocol === "https:";
  const requestImpl = isHttps ? https : http;
  const options: http.RequestOptions = {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : isHttps ? 443 : 80,
    path: `${parsed.pathname}${parsed.search}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Content-Length": Buffer.byteLength(payload)
    }
  };
  if (isHttps && allowInsecure) {
    (options as https.RequestOptions).rejectUnauthorized = false;
  }

  const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
    const req = requestImpl.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        resolve({ statusCode: res.statusCode || 500, body: Buffer.concat(chunks).toString("utf8") });
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error("Non-200 response");
  }

  return JSON.parse(response.body) as Record<string, unknown>;
}

async function getJson(url: string, apiKey: string, allowInsecure: boolean) {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === "https:";
  const requestImpl = isHttps ? https : http;
  const options: http.RequestOptions = {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : isHttps ? 443 : 80,
    path: `${parsed.pathname}${parsed.search}`,
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`
    }
  };
  if (isHttps && allowInsecure) {
    (options as https.RequestOptions).rejectUnauthorized = false;
  }

  const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
    const req = requestImpl.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        resolve({ statusCode: res.statusCode || 500, body: Buffer.concat(chunks).toString("utf8") });
      });
    });
    req.on("error", reject);
    req.end();
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error("Non-200 response");
  }

  return JSON.parse(response.body) as Record<string, unknown>;
}

async function refreshMonitoredServices(): Promise<void> {
  const settings = await getSettingsMap();
  const baseUrl = settings.uptime_kuma_base_url;
  const apiKey = settings.uptime_kuma_api_key;
  const endpointOverride = settings.uptime_kuma_api_endpoint;
  const allowInsecure =
    settings.uptime_kuma_insecure === "true" ||
    isLikelySelfSigned(endpointOverride || baseUrl);

  if (!baseUrl || !apiKey) return;
  const url = buildMonitorListUrl(baseUrl, endpointOverride);
  let payload: Record<string, unknown>;
  try {
    payload = await postJson(url, { apiKey }, allowInsecure);
  } catch {
    const altUrl = appendQuery(url, "apiKey", apiKey);
    payload = await getJson(altUrl, apiKey, allowInsecure);
  }

  let monitorsRaw: unknown[] = [];
  if (Array.isArray(payload?.monitors)) {
    monitorsRaw = payload.monitors as unknown[];
  } else if (payload?.monitors && typeof payload.monitors === "object") {
    monitorsRaw = Object.values(payload.monitors as Record<string, unknown>);
  } else if (Array.isArray(payload?.publicGroupList)) {
    const groups = payload.publicGroupList as Array<{ monitorList?: unknown[] }>;
    monitorsRaw = groups.flatMap((group) =>
      Array.isArray(group.monitorList) ? group.monitorList : []
    );
  }

  const filtered = monitorsRaw
    .map((monitor) => monitor as Record<string, unknown>)
    .filter((monitor) => Number.isFinite(Number(monitor.id)))
    .map((monitor) => ({
      id: String(monitor.id),
      name: String(monitor.name || monitor.displayName || monitor.title || `Monitor ${monitor.id}`)
    }));

  if (!filtered.length) return;
  const values = filtered.flatMap((monitor) => [monitor.id, monitor.name]);
  const placeholders = filtered
    .map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2}, true, now())`)
    .join(", ");
  await pool.query(
    `
      INSERT INTO monitored_services (service_id, service_name, is_enabled, updated_at)
      VALUES ${placeholders}
      ON CONFLICT (service_id)
      DO UPDATE SET service_name = EXCLUDED.service_name, updated_at = now()
    `,
    values
  );
}

router.post("/uptime-kuma", async (req, res) => {
  const token = req.header("x-webhook-token");
  const expected = process.env.UPTIME_KUMA_WEBHOOK_TOKEN;
  if (!expected || token !== expected) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const payload = req.body as Record<string, any>;
  const serviceIdRaw =
    payload?.monitorID ??
    payload?.monitorId ??
    payload?.monitor?.id ??
    payload?.id ??
    payload?.service_id;
  const serviceId = serviceIdRaw !== undefined ? String(serviceIdRaw) : "";
  if (!serviceId) {
    return res.status(200).json({ ignored: true });
  }

  let { rows } = await pool.query(
    "SELECT is_enabled, service_name FROM monitored_services WHERE service_id = $1",
    [serviceId]
  );
  if (!rows[0]?.is_enabled) {
    try {
      await refreshMonitoredServices();
      const refreshed = await pool.query(
        "SELECT is_enabled, service_name FROM monitored_services WHERE service_id = $1",
        [serviceId]
      );
      rows = refreshed.rows;
    } catch {
      rows = [];
    }
  }
  if (!rows[0]?.is_enabled) {
    return res.status(200).json({ ignored: true });
  }

  const serviceName =
    payload?.monitorName ??
    payload?.monitor?.name ??
    payload?.name ??
    rows[0]?.service_name ??
    `Monitor ${serviceId}`;

  const statusCode = payload?.heartbeat?.status;
  const event = String(payload?.event || payload?.status || payload?.msg || "").toLowerCase();
  const isDown =
    statusCode === 0 || event.includes("down") || event.includes("fail") || event.includes("offline");
  const isUp =
    statusCode === 1 || event.includes("up") || event.includes("online") || event.includes("ok");

  if (isDown) {
    await pool.query(
      `
      INSERT INTO announcements
        (source, kind, title, message, severity, status, service_id, service_name, created_at, updated_at)
      VALUES
        ('uptime_kuma', 'system_maintenance', $1, $2, 'critical', 'active', $3, $4, now(), now())
      ON CONFLICT (source, service_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        message = EXCLUDED.message,
        kind = 'system_maintenance',
        severity = 'critical',
        status = 'active',
        service_name = EXCLUDED.service_name,
        updated_at = now()
      `,
      [
        `Service Down: ${serviceName}`,
        `Status Alert: ${serviceName} is currently down.`,
        serviceId,
        serviceName
      ]
    );
    broadcastAnnouncementsUpdate({ type: "changed" });
    return res.status(200).json({ status: "down" });
  }

  if (isUp) {
    await pool.query(
      `
      UPDATE announcements
      SET status = 'resolved', updated_at = now()
      WHERE source = 'uptime_kuma' AND service_id = $1
      `,
      [serviceId]
    );
    broadcastAnnouncementsUpdate({ type: "changed" });
    return res.status(200).json({ status: "up" });
  }

  return res.status(200).json({ ignored: true });
});

export default router;
