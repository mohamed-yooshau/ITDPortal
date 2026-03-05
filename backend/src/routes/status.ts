import { Router } from "express";
import http from "node:http";
import https from "node:https";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";
import { broadcastAnnouncementsUpdate } from "../services/announcementsHub.js";
import { getSettingsMap } from "../settings.js";

const router = Router();

let cached: { data: unknown; expiresAt: number } | null = null;
const CACHE_MS = 10_000;

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

function mapStatus(code: number | undefined): "up" | "down" | "pending" | "unknown" {
  if (code === 1) return "up";
  if (code === 0) return "down";
  if (code === 2) return "pending";
  return "unknown";
}

type MonitorSummary = {
  id: number;
  name: string;
  status: "up" | "down" | "pending" | "unknown";
};

async function syncSystemAnnouncements(monitors: MonitorSummary[]) {
  if (!monitors.length) return;
  const downMonitors = monitors.filter((monitor) => monitor.status === "down");
  if (downMonitors.length) {
    const upsertValues = downMonitors.flatMap((monitor) => [
      `Service Down: ${monitor.name}`,
      `Status Alert: ${monitor.name} is currently down.`,
      String(monitor.id),
      String(monitor.name)
    ]);
    const upsertPlaceholders = downMonitors
      .map(
        (_, idx) =>
          `('uptime_kuma','system_maintenance',$${idx * 4 + 1},$${idx * 4 + 2},'critical','active',$${
            idx * 4 + 3
          },$${idx * 4 + 4},now(),now())`
      )
      .join(", ");
    await pool.query(
      `
      INSERT INTO announcements
        (source, kind, title, message, severity, status, service_id, service_name, created_at, updated_at)
      VALUES ${upsertPlaceholders}
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
      upsertValues
    );
  }

  const downIds = downMonitors.map((monitor) => String(monitor.id));
  if (downIds.length) {
    const params = downIds.map((_, idx) => `$${idx + 1}`).join(", ");
    await pool.query(
      `
      UPDATE announcements
      SET status = 'resolved', updated_at = now()
      WHERE source = 'uptime_kuma'
        AND status = 'active'
        AND service_id NOT IN (${params})
      `,
      downIds
    );
  } else {
    await pool.query(
      `
      UPDATE announcements
      SET status = 'resolved', updated_at = now()
      WHERE source = 'uptime_kuma' AND status = 'active'
      `
    );
  }
  broadcastAnnouncementsUpdate({ type: "changed" });
}

router.get("/summary", requireAuth, async (req, res) => {
  const force = req.query.force === "1";
  if (!force && cached && cached.expiresAt > Date.now()) {
    const cachedData = cached.data as { monitors?: MonitorSummary[] } | null;
    if (cachedData?.monitors && Array.isArray(cachedData.monitors)) {
      syncSystemAnnouncements(cachedData.monitors).catch(() => undefined);
    }
    res.json(cached.data);
    return;
  }

  const settings = await getSettingsMap();
  const baseUrl = settings.uptime_kuma_base_url;
  const apiKey = settings.uptime_kuma_api_key;
  const endpointOverride = settings.uptime_kuma_api_endpoint;
  const allowInsecure =
    settings.uptime_kuma_insecure === "true" ||
    isLikelySelfSigned(endpointOverride || baseUrl);

  if (!baseUrl || !apiKey) {
    res.status(503).json({ message: "Status configuration not set." });
    return;
  }

  const url = buildMonitorListUrl(baseUrl, endpointOverride);

  try {
    let payload: JsonValue;
    try {
      payload = await postJson(url, { apiKey }, allowInsecure);
    } catch {
      const altUrl = appendQuery(url, "apiKey", apiKey);
      payload = await getJson(altUrl, apiKey, allowInsecure);
    }
    let monitorsRaw: unknown[] = [];
    let heartbeatMap: Record<string, number | undefined> = {};
    if (Array.isArray(payload?.monitors)) {
      monitorsRaw = payload.monitors as unknown[];
    } else if (payload?.monitors && typeof payload.monitors === "object") {
      monitorsRaw = Object.values(payload.monitors as Record<string, unknown>);
    } else if (Array.isArray(payload?.publicGroupList)) {
      const groups = payload.publicGroupList as Array<{ monitorList?: unknown[] }>;
      monitorsRaw = groups.flatMap((group) =>
        Array.isArray(group.monitorList) ? group.monitorList : []
      );
      try {
        const heartbeatUrl = buildStatusPageHeartbeatUrl(url);
        const heartbeatPayload = await getJson(heartbeatUrl, apiKey, allowInsecure);
        const list = heartbeatPayload?.heartbeatList as Record<string, Array<{ status?: number }>> | undefined;
        if (list && typeof list === "object") {
          heartbeatMap = Object.keys(list).reduce<Record<string, number | undefined>>((acc, key) => {
            const entries = list[key];
            if (Array.isArray(entries) && entries.length > 0) {
              const latest = entries[entries.length - 1];
              acc[key] = typeof latest?.status === "number" ? latest.status : undefined;
            }
            return acc;
          }, {});
        }
      } catch {
        heartbeatMap = {};
      }
    }

    const filtered: MonitorSummary[] = monitorsRaw
      .map((monitor) => monitor as Record<string, unknown>)
      .filter((monitor) => {
        const id = Number(monitor.id);
        return Number.isFinite(id);
      })
      .map((monitor) => {
        const id = Number(monitor.id);
        let statusCode: number | undefined;
        if (typeof monitor.status === "number") {
          statusCode = monitor.status;
        } else if (typeof monitor.status === "string") {
          const normalized = monitor.status.toLowerCase();
          statusCode = normalized === "down" ? 0 : normalized === "up" ? 1 : heartbeatMap[String(monitor.id)];
        } else {
          statusCode = heartbeatMap[String(monitor.id)];
        }
        return {
          id,
          name: String(monitor.name || monitor.displayName || monitor.title || `Monitor ${id}`),
          status: mapStatus(statusCode),
          statusCode,
          url: monitor.url || monitor.hostname || null,
          type: monitor.type || null
        };
      });

    const data = {
      monitors: filtered,
      updatedAt: new Date().toISOString()
    };

    try {
      if (filtered.length) {
        const values = filtered.flatMap((monitor) => [String(monitor.id), String(monitor.name)]);
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
    } catch {
      // ignore monitor sync failures
    }

    try {
      await syncSystemAnnouncements(filtered);
    } catch {
      // ignore announcement sync failures
    }

    cached = { data, expiresAt: Date.now() + CACHE_MS };
    res.json(data);
  } catch {
    res.status(502).json({ message: "Unable to load status right now." });
  }
});

type JsonValue = Record<string, unknown>;

async function postJson(url: string, body: JsonValue, allowInsecure: boolean): Promise<JsonValue> {
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

  try {
    return JSON.parse(response.body) as JsonValue;
  } catch {
    throw new Error("Invalid JSON response");
  }
}

async function getJson(url: string, apiKey: string, allowInsecure: boolean): Promise<JsonValue> {
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

  try {
    return JSON.parse(response.body) as JsonValue;
  } catch {
    throw new Error("Invalid JSON response");
  }
}

function appendQuery(url: string, key: string, value: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set(key, value);
  return parsed.toString();
}

function buildStatusPageHeartbeatUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith("/heartbeat")) return parsed.toString();
  const parts = parsed.pathname.replace(/\/$/, "").split("/");
  const slug = parts[parts.length - 1] || "";
  if (parts.includes("status-page")) {
    return `${parsed.origin}/api/status-page/heartbeat/${slug}${parsed.search}`;
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}/heartbeat${parsed.search}`;
}

function isLikelySelfSigned(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname;
    if (host === "localhost") return true;
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  } catch {
    return false;
  }
}

export default router;
