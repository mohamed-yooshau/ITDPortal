import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import pool from "./db.js";
import authRoutes from "./routes/auth.js";
import servicesRoutes from "./routes/services.js";
import categoriesRoutes from "./routes/categories.js";
import formsRoutes from "./routes/forms.js";
import knowledgeRoutes from "./routes/knowledge.js";
import guidesRoutes from "./routes/guides.js";
import settingsRoutes from "./routes/settings.js";
import actionPlanRoutes from "./routes/actionPlan.js";
import statusRoutes from "./routes/status.js";
import announcementsRoutes from "./routes/announcements.js";
import webhooksRoutes from "./routes/webhooks.js";
import apsRoutes from "./routes/aps.js";
import profileRoutes from "./routes/profile.js";
import meRoutes from "./routes/me.js";
import helpdeskRoutes from "./routes/helpdesk.js";
import policiesRoutes from "./routes/policies.js";
import adminRoutes from "./routes/admin.js";
import utilsRoutes from "./routes/utils.js";
import usersRoutes from "./routes/users.js";
import tourRoutes from "./routes/tour.js";
import brandingRoutes from "./routes/branding.js";
import searchRoutes from "./routes/search.js";
import { runMigrations } from "./migrate.js";
import { getSettingsMap } from "./settings.js";
import bcrypt from "bcrypt";

dotenv.config();

const app = express();
const parseBooleanEnv = (value?: string): boolean => /^(1|true|yes|on)$/i.test((value || "").trim());
const BOOTSTRAP_LOCAL_ONLY = parseBooleanEnv(process.env.BOOTSTRAP_LOCAL_ONLY);

app.disable("x-powered-by");
app.set("trust proxy", 1);

const formatPathForLogs = (url?: string): string => {
  if (!url) return "/";
  return url.split("?")[0] || "/";
};

const requestLogger = morgan((tokens, req, res) => {
  const request = req as express.Request;
  if (request.path === "/api/health") return undefined;
  const remoteUser = tokens["remote-user"](req, res) || "-";
  const pathOnly = formatPathForLogs(request.originalUrl || req.url);
  return [
    tokens["remote-addr"](req, res) || "-",
    "-",
    remoteUser,
    `[${tokens.date(req, res, "clf")}]`,
    `"${tokens.method(req, res) || "GET"} ${pathOnly} HTTP/${tokens["http-version"](req, res) || "1.1"}"`,
    tokens.status(req, res) || "-",
    tokens.res(req, res, "content-length") || "-",
    `"${tokens.referrer(req, res) || "-"}"`,
    `"${tokens["user-agent"](req, res) || "-"}"`
  ].join(" ");
});

const buildLimiter = (windowMs: number, max: number, message: string) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message }
  });

const authGeneralLimiter = buildLimiter(
  15 * 60 * 1000,
  1000,
  "Too many authentication requests. Please try again later."
);
const authLoginLimiter = buildLimiter(
  15 * 60 * 1000,
  30,
  "Too many login attempts. Please try again later."
);
const authCallbackLimiter = buildLimiter(
  15 * 60 * 1000,
  180,
  "Too many authentication callback requests. Please try again later."
);
const authHandshakeLimiter = buildLimiter(
  5 * 60 * 1000,
  300,
  "Too many handshake requests. Please retry shortly."
);
const webhooksLimiter = buildLimiter(
  5 * 60 * 1000,
  600,
  "Too many webhook requests. Please try again later."
);

app.use(express.json({ limit: "2mb" }));
app.use(requestLogger);
app.use(cookieParser());
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

const normalizeOrigin = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
};

const resolveAllowedOrigins = async (): Promise<string[]> => {
  const settings = await getSettingsMap();
  const origins = new Set<string>();
  const frontendUrl = settings.frontend_url || process.env.FRONTEND_URL || "";
  const adminUrl = settings.admin_url || process.env.ADMIN_URL || "";
  const normalizedFrontend = frontendUrl ? normalizeOrigin(frontendUrl) : null;
  const normalizedAdmin = adminUrl ? normalizeOrigin(adminUrl) : null;
  if (normalizedFrontend) origins.add(normalizedFrontend);
  if (normalizedAdmin) origins.add(normalizedAdmin);
  return Array.from(origins);
};

let cachedOrigins: string[] = [];
let lastOriginLoad = 0;

app.use(async (req, res, next) => {
  const now = Date.now();
  if (!cachedOrigins.length || now - lastOriginLoad > 60_000) {
    cachedOrigins = await resolveAllowedOrigins();
    lastOriginLoad = now;
  }
  const origin = req.headers.origin as string | undefined;
  if (!origin) {
    next();
    return;
  }
  if (!cachedOrigins.includes(origin)) {
    res.status(403).json({ error: "CORS blocked" });
    return;
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "600");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});


app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: true, time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: "error", db: false, time: new Date().toISOString() });
  }
});

app.use("/api/auth/login", authLoginLimiter);
app.use("/api/auth/local-login", authLoginLimiter);
app.use("/api/auth/session", authLoginLimiter);
app.use("/api/auth/callback", authCallbackLimiter);
app.use("/api/auth/handshake", authHandshakeLimiter);
app.use("/api/auth", authGeneralLimiter, cors({ origin: true, credentials: true }), authRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/forms", formsRoutes);
app.use("/api/knowledge", knowledgeRoutes);
app.use("/api/guides", guidesRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/action-plan", actionPlanRoutes);
app.use("/api/status", statusRoutes);
app.use("/api/announcements", announcementsRoutes);
app.use("/api/webhooks", webhooksLimiter, webhooksRoutes);
app.use("/api/aps", apsRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/me", meRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/tour", tourRoutes);
app.use("/api/helpdesk", helpdeskRoutes);
app.use("/api/policies", policiesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/utils", utilsRoutes);
app.use("/api", brandingRoutes);

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

async function ensureLocalAdmin(): Promise<void> {
  const username = process.env.ADMIN_USERNAME || "";
  const password = process.env.ADMIN_PASSWORD || "";
  if (!username || !password) {
    const message = "ADMIN_USERNAME/ADMIN_PASSWORD not set; skipping local admin seed.";
    if (BOOTSTRAP_LOCAL_ONLY) {
      throw new Error("BOOTSTRAP_LOCAL_ONLY requires ADMIN_USERNAME and ADMIN_PASSWORD.");
    }
    console.warn(message);
    return;
  }
  const existing = await pool.query("SELECT id, role, disabled FROM local_admins WHERE username = $1", [username]);
  if (!existing.rowCount) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO local_admins (username, password_hash, role, disabled) VALUES ($1, $2, 'superadmin', false)",
      [username, hash]
    );
    console.log("Seeded local admin account");
    return;
  }
  if (!BOOTSTRAP_LOCAL_ONLY) return;
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    "UPDATE local_admins SET password_hash = $2, role = 'superadmin', disabled = false WHERE username = $1",
    [username, hash]
  );
  console.log("Refreshed bootstrap local admin account");
}

async function start(): Promise<void> {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is required. Set it in the environment before starting.");
    process.exit(1);
  }
  if (BOOTSTRAP_LOCAL_ONLY) {
    console.warn("BOOTSTRAP_LOCAL_ONLY enabled: SSO login is disabled until this flag is turned off.");
  }
  await runMigrations();
  await ensureLocalAdmin();
  app.listen(port, () => {
    console.log(`Backend listening on ${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
