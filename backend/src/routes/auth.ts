import { Router, Request, Response } from "express";
import crypto, { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { ConfidentialClientApplication, Configuration } from "@azure/msal-node";
import pool from "../db.js";
import { AuthUser, requireAuth, requireRole } from "../middleware/auth.js";
import { blockUnexpectedBodyKeys } from "../middleware/validate.js";
import { normalizeRole } from "../permissions.js";
import { getSettingsMap } from "../settings.js";
import { setGraphToken } from "../graphTokens.js";
import { encryptPayload } from "../utils/cryptoPayload.js";
import { HANDSHAKE_TTL_MS, buildOrigin, requireHandshake, storeHandshake } from "../authHandshake.js";
import { logAuditEvent } from "../utils/audit.js";

const router = Router();

const AUTH_ENCRYPTION_ENABLED = process.env.AUTH_ENCRYPTION_ENABLED === "true";
const parseBooleanEnv = (value?: string): boolean => /^(1|true|yes|on)$/i.test((value || "").trim());
const isBootstrapLocalOnlyMode = (): boolean => parseBooleanEnv(process.env.BOOTSTRAP_LOCAL_ONLY);

const respondUser = (
  req: Request,
  res: Response,
  userPayload: Record<string, unknown>,
  endpoint: string
) => {
  res.setHeader("Cache-Control", "no-store");
  const safePayload =
    endpoint === "auth/me"
      ? Object.fromEntries(Object.entries(userPayload).filter(([key]) => key === "email" || key === "name"))
      : userPayload;
  const forceEncrypt = endpoint.startsWith("auth/");
  if (!AUTH_ENCRYPTION_ENABLED && !forceEncrypt) {
    res.json({ user: safePayload });
    return;
  }
  const handshake = requireHandshake(req, res, forceEncrypt);
  if (!handshake) return;
  const bundle = encryptPayload(safePayload, handshake.key, handshake.kid, [
    handshake.handshakeId,
    buildOrigin(req),
    endpoint
  ]);
  res.json({ encUser: bundle });
};

const respondUserStrict = (
  req: Request,
  res: Response,
  userPayload: Record<string, unknown>,
  endpoint: string
) => {
  res.setHeader("Cache-Control", "no-store");
  const handshake = requireHandshake(req, res, true);
  if (!handshake) return;
  const bundle = encryptPayload(userPayload, handshake.key, handshake.kid, [
    handshake.handshakeId,
    buildOrigin(req),
    endpoint
  ]);
  res.json({ encUser: bundle });
};

const getCookieOptions = (req: Request) => {
  const proto = (req.headers["x-forwarded-proto"] || "").toString();
  const secure = proto === "https" || req.secure;
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: 8 * 60 * 60 * 1000
  };
};

const setAuthCookie = (req: Request, res: Response, token: string) => {
  res.cookie("itportal_token", token, getCookieOptions(req));
};

const clearAuthCookie = (req: Request, res: Response) => {
  res.clearCookie("itportal_token", { ...getCookieOptions(req), maxAge: 0 });
};

async function getAzureConfig(): Promise<Configuration | null> {
  const settings = await getSettingsMap();
  const clientId = settings.azure_client_id || process.env.AZURE_CLIENT_ID || "";
  const tenantId = settings.azure_tenant_id || process.env.AZURE_TENANT_ID || "";
  const clientSecret = settings.azure_client_secret || process.env.AZURE_CLIENT_SECRET || "";
  if (!clientId || !tenantId || !clientSecret) return null;
  return {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientSecret
    }
  };
}
const stateCache = new Map<string, { app: "user" | "admin"; createdAt: number }>();

function getRequestBase(req: Request): string | null {
  const host = req.get("x-forwarded-host") || req.get("host");
  if (!host) return null;
  const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  return `${proto}://${host}`;
}

function resolveRedirectUri(
  req: Request,
  app: "user" | "admin",
  settings: Record<string, string>
): string | undefined {
  const configured =
    app === "admin"
      ? settings.admin_redirect_uri || process.env.ADMIN_REDIRECT_URI
      : settings.user_redirect_uri || process.env.USER_REDIRECT_URI;
  const requestBase = getRequestBase(req);
  if (!configured || !requestBase) return configured || undefined;
  try {
    const configuredHost = new URL(configured).host;
    const requestHost = new URL(requestBase).host;
    if (configuredHost !== requestHost) {
      return `${requestBase}/api/auth/callback`;
    }
  } catch {
    return configured;
  }
  return configured;
}

function resolveRedirectBase(
  req: Request,
  app: "user" | "admin",
  settings: Record<string, string>
): string | undefined {
  const normalizeBase = (value?: string) => {
    if (!value) return value;
    return value.replace(/\/+$/, "");
  };
  const configured =
    app === "admin"
      ? settings.admin_url || process.env.ADMIN_URL
      : settings.frontend_url || process.env.FRONTEND_URL;
  const adminPath = (process.env.ADMIN_PATH || "secure-admin").replace(/^\/|\/$/g, "");
  const requestBase = getRequestBase(req);
  if (!configured || !requestBase) return normalizeBase(configured) || undefined;
  try {
    const configuredHost = new URL(normalizeBase(configured) || configured).host;
    const requestHost = new URL(requestBase).host;
    if (configuredHost !== requestHost) {
      return app === "admin" ? `${requestBase}/${adminPath}` : `${requestBase}`;
    }
  } catch {
    return normalizeBase(configured);
  }
  return normalizeBase(configured);
}

function issueJwt(user: AuthUser): string {
  const payload = { ...user, role: normalizeRole(user.role) };
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return jwt.sign(payload, secret, { expiresIn: "8h" });
}

async function upsertUser(email: string, name: string): Promise<AuthUser> {
  const existing = await pool.query("SELECT id, email, name, role, disabled FROM users WHERE email = $1", [email]);
  if (existing.rowCount && existing.rows[0]) {
    const row = existing.rows[0];
    if (row.disabled) {
      throw new Error("User disabled");
    }
    await pool.query("UPDATE users SET last_login = NOW(), is_new = false WHERE id = $1", [row.id]);
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: normalizeRole(row.role)
    };
  }
  const insert = await pool.query(
    "INSERT INTO users (email, name, role, last_login, is_new) VALUES ($1, $2, 'user', NOW(), true) RETURNING id, email, name, role, disabled",
    [email, name]
  );
  const row = insert.rows[0];
  if (row.disabled) {
    throw new Error("User disabled");
  }
  return { id: row.id, email: row.email, name: row.name, role: normalizeRole(row.role) };
}

function sanitizeUser(user: AuthUser) {
  return {
    email: user.email,
    name: user.name
  };
}

router.get("/login", async (req: Request, res: Response) => {
  if (isBootstrapLocalOnlyMode()) {
    res.status(503).json({ error: "SSO login is disabled during local bootstrap mode" });
    return;
  }
  const config = await getAzureConfig();
  if (!config) {
    res.status(500).json({ error: "Azure AD not configured" });
    return;
  }
  const cca = new ConfidentialClientApplication(config);
  const app = req.query.app === "admin" ? "admin" : "user";
  const state = randomUUID();
  stateCache.set(state, { app, createdAt: Date.now() });
  const settings = await getSettingsMap();
  const redirectUri = resolveRedirectUri(req, app, settings);
  if (!redirectUri) {
    res.status(500).json({ error: "Redirect URI not configured" });
    return;
  }
  const authUrl = await cca.getAuthCodeUrl({
    scopes: [
      "openid",
      "profile",
      "email",
      "https://graph.microsoft.com/User.Read",
      "https://graph.microsoft.com/Directory.Read.All"
    ],
    redirectUri,
    state
  });
  if (req.query.redirect === "1") {
    res.redirect(authUrl);
    return;
  }
  res.json({ url: authUrl });
});

router.get("/callback", async (req: Request, res: Response) => {
  const config = await getAzureConfig();
  if (!config) {
    res.status(500).send("Azure AD not configured");
    return;
  }
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  if (!code || !state) {
    res.status(400).send("Missing auth code");
    return;
  }
  const cached = stateCache.get(state);
  stateCache.delete(state);
  if (!cached) {
    res.status(400).send("Invalid state");
    return;
  }
  const settings = await getSettingsMap();
  const redirectUri = resolveRedirectUri(req, cached.app, settings);
  if (!redirectUri) {
    res.status(500).send("Redirect URI not configured");
    return;
  }
  try {
    const cca = new ConfidentialClientApplication(config);
    const tokenResponse = await cca.acquireTokenByCode({
      code,
      scopes: [
        "openid",
        "profile",
        "email",
        "https://graph.microsoft.com/User.Read",
        "https://graph.microsoft.com/Directory.Read.All"
      ],
      redirectUri
    });
    const claims = tokenResponse.idTokenClaims as Record<string, unknown>;
    const email = (claims.preferred_username || claims.email || "") as string;
    const name = (claims.name || "") as string;
    if (!email.endsWith("@mtcc.com.mv")) {
      logAuditEvent(
        {
          action: "auth.login_denied_domain",
          status: "denied",
          metadata: { email }
        },
        req
      );
      res.status(403).send("Unauthorized domain");
      return;
    }
    const user = await upsertUser(email, name || email);
    if (tokenResponse.accessToken) {
      setGraphToken(user.email, tokenResponse.accessToken, tokenResponse.expiresOn ?? null);
    }
    const token = issueJwt(user);
    setAuthCookie(req, res, token);
    const normalizedRole = normalizeRole(user.role);
    const targetApp =
      cached.app === "admin" && normalizedRole === "superadmin" ? "admin" : "user";
    const redirectBase = resolveRedirectBase(req, targetApp, settings);
    const redirectTarget = `${redirectBase}/auth/callback`;
    logAuditEvent(
      {
        action: "auth.login_success",
        status: "success",
        metadata: { app: cached.app }
      },
      req,
      { id: user.id, email: user.email, name: user.name, role: normalizeRole(user.role) }
    );
    res.redirect(redirectTarget);
  } catch (err) {
    if (err instanceof Error && err.message === "User disabled") {
      logAuditEvent({ action: "auth.login_disabled", status: "denied" }, req);
      res.status(403).send("User disabled");
      return;
    }
    console.error("Auth callback error", err);
    logAuditEvent({ action: "auth.login_failed", status: "failure" }, req);
    res.status(500).send("Auth failed");
  }
});

router.get("/me", async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  const bearer = header && header.startsWith("Bearer ") ? header.replace("Bearer ", "") : "";
  const cookieToken = (req as any).cookies?.itportal_token;
  const token = bearer || cookieToken;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ error: "Server misconfigured" });
      return;
    }
    const payload = jwt.verify(token, secret) as AuthUser;
    payload.role = normalizeRole(payload.role);
    if (!payload.email.endsWith("@local")) {
      const result = await pool.query("SELECT id, email, name, role, disabled FROM users WHERE email = $1", [payload.email]);
      if (result.rowCount) {
        if (result.rows[0].disabled) {
          res.status(403).json({ error: "User disabled" });
          return;
        }
        const row = result.rows[0];
        const role = normalizeRole(row.role);
        respondUser(
          req,
          res,
          {
            ...sanitizeUser({ id: row.id, email: row.email, name: row.name, role }),
            isSuperadmin: role === "superadmin",
            isPrivileged: role !== "user"
          },
          "auth/me"
        );
        return;
      }
    } else {
      const local = await pool.query("SELECT username, role, disabled FROM local_admins WHERE username = $1", [
        payload.email.replace("@local", "")
      ]);
      if (local.rowCount) {
        if (local.rows[0].disabled) {
          res.status(403).json({ error: "User disabled" });
          return;
        }
        const role = normalizeRole(local.rows[0].role);
        respondUser(
          req,
          res,
          {
            ...sanitizeUser({
              id: payload.id,
              email: payload.email,
              name: local.rows[0].username,
              role
            }),
            isSuperadmin: role === "superadmin",
            isPrivileged: role !== "user"
          },
          "auth/me"
        );
        return;
      }
    }
    res.status(401).json({ error: "Unauthorized" });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.post(
  "/local-login",
  blockUnexpectedBodyKeys(["username", "password"]),
  async (req: Request, res: Response) => {
  const settings = await getSettingsMap();
  const localBootstrapOnly = isBootstrapLocalOnlyMode();
  if (!localBootstrapOnly && settings.local_login_enabled === "false") {
    logAuditEvent({ action: "auth.local_login_disabled", status: "denied" }, req);
    res.status(403).json({ error: "Local login disabled" });
    return;
  }
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "Missing credentials" });
    return;
  }
  const result = await pool.query(
    "SELECT id, username, password_hash, role, disabled FROM local_admins WHERE username = $1",
    [username]
  );
  if (!result.rowCount) {
    logAuditEvent({ action: "auth.local_login_invalid", status: "failure", metadata: { username } }, req);
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const row = result.rows[0];
  if (row.disabled) {
    logAuditEvent({ action: "auth.local_login_disabled", status: "denied", metadata: { username } }, req);
    res.status(403).json({ error: "User disabled" });
    return;
  }
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    logAuditEvent({ action: "auth.local_login_invalid", status: "failure", metadata: { username } }, req);
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const user: AuthUser = {
    id: row.id,
    email: `${row.username}@local`,
    name: row.username,
    role: normalizeRole(row.role)
  };
  const token = issueJwt(user);
  setAuthCookie(req, res, token);
  const normalizedRole = normalizeRole(user.role);
  respondUser(
    req,
    res,
    {
      ...sanitizeUser(user),
      isSuperadmin: normalizedRole === "superadmin",
      isPrivileged: normalizedRole !== "user"
    },
    "auth/local-login"
  );
  logAuditEvent({ action: "auth.local_login_success", status: "success" }, req, user);
  }
);

router.get("/me-admin", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user as AuthUser | undefined;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.email.endsWith("@local")) {
    const local = await pool.query("SELECT role, disabled FROM local_admins WHERE username = $1", [
      user.email.replace("@local", "")
    ]);
    if (!local.rowCount || local.rows[0].disabled) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const role = normalizeRole(local.rows[0].role);
    if (role === "user") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    respondUserStrict(req, res, { email: user.email, name: user.name, role }, "auth/me-admin");
    return;
  }
  const result = await pool.query("SELECT role, disabled, name, email FROM users WHERE email = $1", [user.email]);
  if (!result.rowCount || result.rows[0].disabled) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const role = normalizeRole(result.rows[0].role);
  if (role === "user") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  respondUserStrict(
    req,
    res,
    { email: result.rows[0].email, name: result.rows[0].name, role },
    "auth/me-admin"
  );
});

router.get("/admin-access", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user as AuthUser | undefined;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.email.endsWith("@local")) {
    const local = await pool.query("SELECT role, disabled FROM local_admins WHERE username = $1", [
      user.email.replace("@local", "")
    ]);
    if (!local.rowCount || local.rows[0].disabled) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const role = normalizeRole(local.rows[0].role);
    if (role === "user") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    respondUser(req, res, { email: user.email, name: user.name, role }, "auth/admin-access");
    return;
  }
  const result = await pool.query("SELECT role, disabled FROM users WHERE email = $1", [user.email]);
  if (!result.rowCount || result.rows[0].disabled) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const role = normalizeRole(result.rows[0].role);
  if (role === "user") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  respondUserStrict(req, res, { email: user.email, name: user.name, role }, "auth/admin-access");
});

router.get("/config", async (_req: Request, res: Response) => {
  const settings = await getSettingsMap();
  const localBootstrapOnly = isBootstrapLocalOnlyMode();
  const payload = {
    localLoginEnabled: localBootstrapOnly || settings.local_login_enabled !== "false",
    ssoLoginEnabled: !localBootstrapOnly,
    authEncryptionEnabled: AUTH_ENCRYPTION_ENABLED
  };
  res.setHeader("Cache-Control", "no-store");
  const handshake = requireHandshake(_req, res, true);
  if (!handshake) return;
  const bundle = encryptPayload(payload, handshake.key, handshake.kid, [
    handshake.handshakeId,
    buildOrigin(_req),
    "auth/config"
  ]);
  res.json({ encConfig: bundle });
});

router.post("/handshake", async (req: Request, res: Response) => {
  const clientPublicKey = (req.body?.clientPublicKey as string | undefined) || "";
  if (!clientPublicKey) {
    res.status(400).json({ error: "Missing clientPublicKey" });
    return;
  }
  try {
    const serverKeys = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
      publicKeyEncoding: { type: "spki", format: "der" },
      privateKeyEncoding: { type: "pkcs8", format: "der" }
    });
    const serverPublic = serverKeys.publicKey.toString("base64");
    const serverPrivateKey = crypto.createPrivateKey({
      key: serverKeys.privateKey,
      format: "der",
      type: "pkcs8"
    });
    const clientKey = crypto.createPublicKey({
      key: Buffer.from(clientPublicKey, "base64"),
      format: "der",
      type: "spki"
    });
    const secret = crypto.diffieHellman({ privateKey: serverPrivateKey, publicKey: clientKey });
    const handshakeId = randomUUID();
    const info = Buffer.from("itd-auth-payload-v1", "utf8");
    const salt = Buffer.from(handshakeId, "utf8");
    const key = crypto.hkdfSync("sha256", secret, salt, info, 32);
    const kid = process.env.AUTH_PAYLOAD_ENC_KID || "v1";
    storeHandshake(handshakeId, Buffer.from(key), kid);
    res.json({ handshakeId, serverPublicKey: serverPublic, kid });
  } catch {
    res.status(500).json({ error: "Handshake failed" });
  }
});

router.get("/admin-check", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user as AuthUser | undefined;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.email.endsWith("@local")) {
    const local = await pool.query("SELECT role, disabled FROM local_admins WHERE username = $1", [
      user.email.replace("@local", "")
    ]);
    if (!local.rowCount || local.rows[0].disabled) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const role = normalizeRole(local.rows[0].role);
    if (role !== "superadmin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.status(204).send();
    return;
  }
  const result = await pool.query("SELECT role, disabled FROM users WHERE email = $1", [user.email]);
  if (!result.rowCount || result.rows[0].disabled) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const role = normalizeRole(result.rows[0].role);
  if (role !== "superadmin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.status(204).send();
});

router.post("/logout", (_req: Request, res: Response) => {
  clearAuthCookie(_req, res);
  res.json({ ok: true });
});

router.post("/session", blockUnexpectedBodyKeys(["token"]), async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  const bearer = header && header.startsWith("Bearer ") ? header.replace("Bearer ", "") : "";
  const token = bearer || (req.body?.token as string | undefined) || "";
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }
  try {
    jwt.verify(token, secret);
    setAuthCookie(req, res, token);
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
