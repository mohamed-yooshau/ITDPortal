import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import cookieParser from "cookie-parser";
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

app.use(express.json({ limit: "2mb" }));
app.use(morgan("combined"));
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

app.use("/api/auth", cors({ origin: true, credentials: true }), authRoutes);
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
app.use("/api/webhooks", webhooksRoutes);
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
    console.warn("ADMIN_USERNAME/ADMIN_PASSWORD not set; skipping local admin seed.");
    return;
  }
  const existing = await pool.query("SELECT id FROM local_admins WHERE username = $1", [username]);
  if (existing.rowCount) return;
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    "INSERT INTO local_admins (username, password_hash, role) VALUES ($1, $2, 'superadmin')",
    [username, hash]
  );
  console.log("Seeded local admin account");
}

async function start(): Promise<void> {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is required. Set it in the environment before starting.");
    process.exit(1);
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
