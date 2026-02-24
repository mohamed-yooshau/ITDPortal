import { Request } from "express";
import pool from "../db.js";
import type { AuthUser } from "../middleware/auth.js";

type AuditStatus = "success" | "failure" | "denied";

interface AuditEvent {
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  resource?: string | null;
  status?: AuditStatus;
  metadata?: Record<string, any> | null;
}

function resolveIp(req?: Request): string | null {
  if (!req) return null;
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || null;
}

export async function logAuditEvent(event: AuditEvent, req?: Request, user?: AuthUser): Promise<void> {
  try {
    const actorEmail = event.actorEmail ?? user?.email ?? null;
    const actorRole = event.actorRole ?? user?.role ?? null;
    const ipAddress = resolveIp(req);
    const userAgent = req?.headers["user-agent"] || null;
    const status = event.status || "success";
    await pool.query(
      `INSERT INTO audit_logs (actor_email, actor_role, action, resource, status, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        actorEmail,
        actorRole,
        event.action,
        event.resource || null,
        status,
        ipAddress,
        userAgent,
        event.metadata ? JSON.stringify(event.metadata) : null
      ]
    );
  } catch {
    // Avoid throwing on audit failures to prevent breaking user flows
  }
}
