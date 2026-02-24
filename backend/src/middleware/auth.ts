import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { encryptPayload } from "../utils/cryptoPayload.js";
import { buildOrigin, requireHandshake } from "../authHandshake.js";
import { normalizeRole, Role } from "../permissions.js";
import { logAuditEvent } from "../utils/audit.js";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

async function resolveDbRole(user: AuthUser): Promise<Role | null> {
  if (user.email.endsWith("@local")) {
    const result = await pool.query("SELECT role FROM local_admins WHERE username = $1", [
      user.email.replace("@local", "")
    ]);
    if (!result.rowCount) return null;
    return normalizeRole(result.rows[0].role);
  }
  const result = await pool.query("SELECT role FROM users WHERE email = $1", [user.email]);
  if (!result.rowCount) return null;
  return normalizeRole(result.rows[0].role);
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const bearer = header && header.startsWith("Bearer ") ? header.replace("Bearer ", "") : "";
  const cookieToken = (req as any).cookies?.itportal_token;
  const token = bearer || cookieToken;
  if (!token) {
    logAuditEvent({ action: "auth.missing_token", status: "denied" }, req);
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!process.env.JWT_SECRET) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET) as AuthUser;
    payload.role = normalizeRole(payload.role);
    req.user = payload;
    if (!(res as any).locals?.encryptWrapped) {
      const originalJson = res.json.bind(res);
      (res as any).locals = (res as any).locals || {};
      (res as any).locals.encryptWrapped = true;
      res.json = ((body: any) => {
        if ((res as any).locals?.skipEncrypt) {
          return originalJson(body);
        }
        if (body && (body.encUser || body.encSettings || body.enc)) {
          return originalJson(body);
        }
        const handshake = requireHandshake(req, res, true);
        if (!handshake) return res as any;
        const bundle = encryptPayload({ data: body }, handshake.key, handshake.kid, [
          handshake.handshakeId,
          buildOrigin(req)
        ]);
        return originalJson({ enc: bundle });
      }) as Response["json"];
    }
    if (payload.email.endsWith("@local")) {
      pool
        .query("SELECT disabled FROM local_admins WHERE username = $1", [payload.email.replace("@local", "")])
        .then((result) => {
      if (result.rowCount && result.rows[0].disabled) {
        logAuditEvent({ action: "auth.user_disabled", status: "denied" }, req, req.user);
        res.status(403).json({ error: "User disabled" });
        return;
      }
      next();
        })
        .catch(() => res.status(401).json({ error: "Unauthorized" }));
      return;
    }
    pool
      .query("SELECT disabled FROM users WHERE email = $1", [payload.email])
      .then((result) => {
        if (result.rowCount && result.rows[0].disabled) {
          logAuditEvent({ action: "auth.user_disabled", status: "denied" }, req, req.user);
          res.status(403).json({ error: "User disabled" });
          return;
        }
        next();
      })
      .catch(() => res.status(401).json({ error: "Unauthorized" }));
  } catch {
    logAuditEvent({ action: "auth.invalid_token", status: "denied" }, req);
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(roles: Array<AuthUser["role"]>) {
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      logAuditEvent({ action: "rbac.unauthorized", status: "denied", resource: req.path }, req);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const tokenRole = normalizeRole(req.user.role);
    const dbRole = await resolveDbRole(req.user);
    if (!dbRole) {
      console.warn("RBAC user missing", { email: req.user.email, path: req.path, method: req.method });
      logAuditEvent(
        { action: "rbac.missing_user", status: "denied", resource: req.path },
        req,
        req.user
      );
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (dbRole !== tokenRole) {
      console.warn("RBAC role mismatch", {
        email: req.user.email,
        tokenRole,
        dbRole,
        path: req.path,
        method: req.method
      });
    }
    const effectiveRole = dbRole;
    req.user.role = effectiveRole;
    if (!roles.includes(effectiveRole)) {
      console.warn("RBAC denied", {
        email: req.user.email,
        role: effectiveRole,
        path: req.path,
        method: req.method
      });
      logAuditEvent(
        { action: "rbac.denied", status: "denied", resource: req.path },
        req,
        req.user
      );
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
