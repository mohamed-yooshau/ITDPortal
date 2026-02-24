import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import pool from "../db.js";
import bcrypt from "bcrypt";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth.js";
import { blockUnexpectedBodyKeys } from "../middleware/validate.js";
import { normalizeRole } from "../permissions.js";
import { clearSettingsCache } from "../settings.js";
import { parse } from "csv-parse/sync";
import {
  mapHeaders,
  detectSourceType,
  normalizeEmail,
  normalizeHeader,
  friendlyProductName,
  slugifyProduct,
  normalizeStatus,
  isEntitledStatus
} from "../utils/autodesk.js";
import {
  listGuides,
  createGuide,
  updateGuide,
  deleteGuide,
  getGuide,
  GuideStepInput,
  GuideType
} from "../stores/guidesStore.js";
import { broadcastAnnouncementsUpdate } from "../services/announcementsHub.js";
import { logAuditEvent } from "../utils/audit.js";

const router = Router();
const getActor = (req: any) => (req as AuthedRequest).user;
const parseBooleanEnv = (value?: string): boolean => /^(1|true|yes|on)$/i.test((value || "").trim());
const BOOTSTRAP_LOCAL_ONLY = parseBooleanEnv(process.env.BOOTSTRAP_LOCAL_ONLY);

const guideUploadDir = "/uploads/guides";
const guideStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(guideUploadDir, { recursive: true });
    cb(null, guideUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    const safeBase = path.basename(file.originalname || "upload", ext).replace(/[^a-z0-9-_]/gi, "_");
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  }
});
const guideUpload = multer({
  storage: guideStorage,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image uploads are allowed."));
  }
});

const policyUploadDir = "/uploads/policies";
const policyStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(policyUploadDir, { recursive: true });
    cb(null, policyUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".pdf";
    const safeBase = path.basename(file.originalname || "policy", ext).replace(/[^a-z0-9-_]/gi, "_");
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  }
});
const policyUpload = multer({
  storage: policyStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain"
    ];
    if (file.mimetype && allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only PDF or Office documents are allowed."));
  }
});

const autodeskUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

const dbUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

const brandingUploadDir = "/uploads/branding";
const brandingStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(brandingUploadDir, { recursive: true });
    cb(null, brandingUploadDir);
  },
  filename: (req, file, cb) => {
    const name = String(req.query.name || "");
    const allowed: Record<string, string> = {
      "favicon-16": "favicon-16.png",
      "favicon-32": "favicon-32.png",
      "favicon-48": "favicon-48.png",
      "app-192": "app-192.png",
      "app-256": "app-256.png",
      "app-512": "app-512.png",
      "favicon-svg": "favicon.svg"
    };
    const target = allowed[name];
    if (!target) {
      cb(new Error("Invalid icon name."), "");
      return;
    }
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (target.endsWith(".svg") && ext !== ".svg") {
      cb(new Error("SVG required for favicon-svg."), "");
      return;
    }
    if (!target.endsWith(".svg") && ext && ext !== ".png") {
      cb(new Error("PNG required for this icon size."), "");
      return;
    }
    cb(null, target);
  }
});
const brandingUpload = multer({
  storage: brandingStorage,
  limits: { fileSize: 2 * 1024 * 1024 }
});

const extractIframeSrc = (input?: string) => {
  if (!input) return undefined;
  const trimmed = input.trim();
  const match = trimmed.match(/src\s*=\s*["']([^"']+)["']/i);
  return match ? match[1] : trimmed;
};

const normalizeEmbedUrl = (input?: string) => {
  if (!input) return undefined;
  const candidate = extractIframeSrc(input);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
};

const normalizeGuideImageUrl = (value?: string) => {
  if (!value) return undefined;
  if (value.startsWith("/api/guides/images/")) return value;
  if (
    value.startsWith("/admin/uploads/guides/") ||
    value.startsWith("/uploads/guides/") ||
    value.startsWith("/api/uploads/guides/")
  ) {
    const filename = path.basename(value);
    return `/api/guides/images/${filename}`;
  }
  return value;
};

const normalizeGuidePayload = (guide: ReturnType<typeof createGuide>) => ({
  ...guide,
  steps: guide.steps.map((step) => ({
    ...step,
    imageUrl: normalizeGuideImageUrl(step.imageUrl)
  }))
});

router.use(requireAuth, requireRole(["admin", "superadmin", "editor", "planner"]));

router.post("/services", requireRole(["admin", "superadmin"]), async (req, res) => {
  const { code, title, description, category_id, icon, status, form_link } = req.body;
  const result = await pool.query(
    "INSERT INTO services (code, title, description, category_id, icon, status, form_link) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
    [code, title, description, category_id || null, icon, status, form_link]
  );
  res.json({ service: result.rows[0] });
  logAuditEvent({ action: "admin.services.create", resource: "services" }, req, getActor(req));
});

router.put("/services/:id", requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { code, title, description, category_id, icon, status, form_link } = req.body;
  const result = await pool.query(
    "UPDATE services SET code=$1, title=$2, description=$3, category_id=$4, icon=$5, status=$6, form_link=$7, updated_at=NOW() WHERE id=$8 RETURNING *",
    [code, title, description, category_id || null, icon, status, form_link, id]
  );
  res.json({ service: result.rows[0] });
  logAuditEvent({ action: "admin.services.update", resource: `services:${id}` }, req, getActor(req));
});

router.delete("/services/:id", requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM services WHERE id = $1", [id]);
  res.json({ ok: true });
  logAuditEvent({ action: "admin.services.delete", resource: `services:${id}` }, req, getActor(req));
});

router.post("/autodesk/licenses/import", requireRole(["admin", "superadmin"]), autodeskUpload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }
  const uploadedBy = req.user?.id ?? null;
  const rawFileName = req.file.originalname || null;
  const buffer = req.file.buffer;

  let records: Record<string, string>[] = [];
  let headers: string[] = [];
  try {
    const parsed = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
      bom: true
    }) as Record<string, string>[];
    records = parsed;
    headers = parsed.length ? Object.keys(parsed[0]) : [];
  } catch (err) {
    res.status(400).json({ error: "Invalid CSV file." });
    return;
  }

  const headerMap = mapHeaders(headers);
  const normalizedHeaders = headers.map((header) => ({
    raw: header,
    norm: normalizeHeader(header)
  }));
  const preferredProductHeader =
    normalizedHeaders.find((item) => item.norm === "product name") ||
    normalizedHeaders.find((item) => item.norm === "product");
  const hasPreferredProductHeader = Boolean(preferredProductHeader);
  if (preferredProductHeader) {
    headerMap.product = preferredProductHeader.raw;
  } else {
    const offeringHeader = normalizedHeaders.find(
      (item) => item.norm === "offering name" || item.norm === "offering"
    );
    if (offeringHeader) {
      headerMap.product = offeringHeader.raw;
    }
  }
  const sourceType = detectSourceType(headers);
  const errors: Array<{ row: number; message: string }> = [];
  let written = 0;
  let skipped = 0;

  const importResult = await pool.query(
    "INSERT INTO autodesk_license_imports (uploaded_by, source_type, raw_file_name) VALUES ($1, $2, $3) RETURNING id",
    [uploadedBy, sourceType, rawFileName]
  );
  const importId = importResult.rows[0].id as string;

  for (let i = 0; i < records.length; i += 1) {
    const row = records[i];
    const emailValue = headerMap.email ? row[headerMap.email] : undefined;
    let productValue = headerMap.product ? row[headerMap.product] : undefined;
    const statusValue = headerMap.status ? row[headerMap.status] : undefined;
    const teamValue = headerMap.team ? row[headerMap.team] : undefined;
    const lastUsedValue = headerMap.lastUsed ? row[headerMap.lastUsed] : undefined;

    if (!productValue && !hasPreferredProductHeader) {
      const preferredSynonyms = ["product name", "product"];
      const fallbackSynonyms = ["offering name", "offering", "application", "app"];
      for (const key of Object.keys(row)) {
        const normalizedKey = normalizeHeader(key);
        if (preferredSynonyms.some((syn) => normalizedKey.includes(syn))) {
          const candidate = row[key];
          if (candidate) {
            productValue = candidate;
            break;
          }
        }
      }
      if (!productValue) {
        for (const key of Object.keys(row)) {
          const normalizedKey = normalizeHeader(key);
          if (fallbackSynonyms.some((syn) => normalizedKey.includes(syn))) {
            const candidate = row[key];
            if (candidate) {
              productValue = candidate;
              break;
            }
          }
        }
      }
    }

    if (!emailValue || !productValue) {
      errors.push({ row: i + 1, message: "Missing required email or product field." });
      skipped += 1;
      continue;
    }

    const userEmail = normalizeEmail(emailValue);
    const productRaw = String(productValue).trim();
    if (!userEmail || !productRaw) {
      errors.push({ row: i + 1, message: "Invalid email or product value." });
      skipped += 1;
      continue;
    }

    const productKey = slugifyProduct(productRaw);
    if (!productKey) {
      errors.push({ row: i + 1, message: "Unable to normalize product key." });
      skipped += 1;
      continue;
    }

    const status = normalizeStatus(statusValue);
    if (status && !isEntitledStatus(status)) {
      skipped += 1;
      continue;
    }

    const friendly = friendlyProductName(productRaw);
    let lastUsedAt: string | null = null;
    if (lastUsedValue) {
      const parsedDate = new Date(lastUsedValue);
      if (!Number.isNaN(parsedDate.getTime())) {
        lastUsedAt = parsedDate.toISOString();
      }
    }

    await pool.query(
      `INSERT INTO autodesk_user_entitlements\n       (user_email, product_name_raw, product_name_friendly, product_key, team_name, status, last_used_at, import_id)\n       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)\n       ON CONFLICT (user_email, product_key)\n       DO UPDATE SET\n         product_name_raw = EXCLUDED.product_name_raw,\n         product_name_friendly = EXCLUDED.product_name_friendly,\n         team_name = EXCLUDED.team_name,\n         status = EXCLUDED.status,\n         last_used_at = EXCLUDED.last_used_at,\n         import_id = EXCLUDED.import_id,\n         updated_at = NOW()`,
      [userEmail, productRaw, friendly, productKey, teamValue || null, status, lastUsedAt, importId]
    );
    written += 1;
  }

  await pool.query(
    "UPDATE autodesk_license_imports SET row_count=$1, written_count=$2, skipped_count=$3, error_count=$4, errors=$5 WHERE id=$6",
    [records.length, written, skipped, errors.length, errors.length ? JSON.stringify(errors) : null, importId]
  );

  res.json({
    importId,
    summary: {
      rowCount: records.length,
      writtenCount: written,
      skippedCount: skipped,
      errorCount: errors.length
    },
    errors
  });
  logAuditEvent(
    {
      action: "admin.autodesk.import",
      resource: "autodesk",
      metadata: { rowCount: records.length, writtenCount: written, skippedCount: skipped }
    },
    req,
    req.user
  );
});

router.get("/autodesk/licenses", requireRole(["admin", "superadmin"]), async (req, res) => {
  const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : null;
  const result = await pool.query(
    `SELECT id, user_email, product_name_raw, product_name_friendly, team_name, status, last_used_at, updated_at
     FROM autodesk_user_entitlements
     WHERE ($1::text IS NULL OR user_email = $1)
     ORDER BY user_email ASC, product_name_friendly ASC`,
    [email]
  );
  res.json({ entitlements: result.rows });
});

router.post("/autodesk/licenses", requireRole(["admin", "superadmin"]), async (req: AuthedRequest, res) => {
  const { email, productName, teamName, status, lastUsedAt } = req.body || {};
  if (!email || !productName) {
    res.status(400).json({ error: "Email and product name are required." });
    return;
  }
  const userEmail = normalizeEmail(String(email));
  const productRaw = String(productName).trim();
  if (!userEmail || !productRaw) {
    res.status(400).json({ error: "Email and product name are required." });
    return;
  }
  const productKey = slugifyProduct(productRaw);
  const friendly = friendlyProductName(productRaw);
  let lastUsedAtIso: string | null = null;
  if (lastUsedAt) {
    const parsedDate = new Date(lastUsedAt);
    if (!Number.isNaN(parsedDate.getTime())) {
      lastUsedAtIso = parsedDate.toISOString();
    }
  }
  const result = await pool.query(
    `INSERT INTO autodesk_user_entitlements
     (user_email, product_name_raw, product_name_friendly, product_key, team_name, status, last_used_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_email, product_key)
     DO UPDATE SET
       product_name_raw = EXCLUDED.product_name_raw,
       product_name_friendly = EXCLUDED.product_name_friendly,
       team_name = EXCLUDED.team_name,
       status = EXCLUDED.status,
       last_used_at = EXCLUDED.last_used_at,
       updated_at = NOW()
     RETURNING *`,
    [
      userEmail,
      productRaw,
      friendly,
      productKey,
      teamName ? String(teamName) : null,
      status ? String(status) : null,
      lastUsedAtIso
    ]
  );
  res.json({ entitlement: result.rows[0] });
  logAuditEvent({ action: "admin.autodesk.upsert", resource: "autodesk" }, req, getActor(req));
});

router.delete("/autodesk/licenses/:id", requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const result = await pool.query("DELETE FROM autodesk_user_entitlements WHERE id = $1", [id]);
  res.json({ ok: true, deleted: result.rowCount });
  logAuditEvent({ action: "admin.autodesk.delete_one", resource: `autodesk:${id}` }, req, getActor(req));
});

router.delete("/autodesk/licenses", requireRole(["admin", "superadmin"]), async (req, res) => {
  const result = await pool.query("DELETE FROM autodesk_user_entitlements");
  res.json({ ok: true, deleted: result.rowCount });
  logAuditEvent({ action: "admin.autodesk.clear_all", resource: "autodesk" }, req, getActor(req));
});

router.get("/users", requireRole(["admin", "superadmin"]), async (_req, res) => {
  const aad = await pool.query("SELECT id, email, name, role, last_login, disabled FROM users ORDER BY email");
  const local = await pool.query("SELECT id, username, role, disabled FROM local_admins ORDER BY username");
  const aadUsers = aad.rows.map((row) => ({
    id: `aad:${row.id}`,
    email: row.email,
    name: row.name,
    role: row.role,
    last_login: row.last_login,
    disabled: row.disabled,
    source: "aad"
  }));
  const localUsers = local.rows.map((row) => ({
    id: `local:${row.id}`,
    email: `${row.username}@local`,
    name: row.username,
    role: row.role,
    last_login: null,
    disabled: row.disabled,
    source: "local"
  }));
  res.json({ users: [...aadUsers, ...localUsers] });
});

router.post(
  "/users/local",
  requireRole(["superadmin"]),
  blockUnexpectedBodyKeys(["username", "password", "role"]),
  async (req: AuthedRequest, res) => {
  const { username, password, role } = req.body as {
    username?: string;
    password?: string;
    role?: string;
  };
  const normalizedUsername = String(username || "").trim().toLowerCase();
  if (!normalizedUsername) {
    res.status(400).json({ error: "Username is required." });
    return;
  }
  if (!/^[a-z0-9._-]{3,32}$/i.test(normalizedUsername)) {
    res.status(400).json({ error: "Username must be 3-32 characters (letters, numbers, . _ -)." });
    return;
  }
  if (!password || String(password).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  const normalizedRole = role ? normalizeRole(role) : "user";
  if (!["user", "admin", "superadmin", "editor", "planner"].includes(normalizedRole)) {
    res.status(400).json({ error: "Invalid role." });
    return;
  }
  const existing = await pool.query("SELECT id FROM local_admins WHERE username = $1", [
    normalizedUsername
  ]);
  if (existing.rowCount) {
    res.status(409).json({ error: "Username already exists." });
    return;
  }
  const hash = await bcrypt.hash(String(password), 10);
  const result = await pool.query(
    "INSERT INTO local_admins (username, password_hash, role, disabled) VALUES ($1, $2, $3, false) RETURNING id, username, role, disabled",
    [normalizedUsername, hash, normalizedRole]
  );
  res.json({
    user: {
      id: `local:${result.rows[0].id}`,
      email: `${result.rows[0].username}@local`,
      name: result.rows[0].username,
      role: result.rows[0].role,
      disabled: result.rows[0].disabled,
      source: "local"
    }
  });
  logAuditEvent({ action: "admin.users.create", resource: "local_admins" }, req, getActor(req));
  }
);

router.put(
  "/users/:id",
  requireRole(["superadmin"]),
  blockUnexpectedBodyKeys(["role", "disabled"]),
  async (req, res) => {
  const { id } = req.params;
  const { role, disabled } = req.body as { role?: string; disabled?: boolean };
  if (role !== undefined) {
    const normalized = normalizeRole(role);
    if (!["user", "admin", "superadmin", "editor", "planner"].includes(normalized)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
  }
  if (role === undefined && disabled === undefined) {
    res.status(400).json({ error: "No updates provided" });
    return;
  }
  if (id.startsWith("local:")) {
    const localId = id.replace("local:", "");
    const fields: string[] = [];
    const values: Array<string | boolean> = [];
    let idx = 1;
    if (role !== undefined) {
      const normalized = normalizeRole(role);
      fields.push(`role = $${idx++}`);
      values.push(normalized);
    }
    if (disabled !== undefined) {
      fields.push(`disabled = $${idx++}`);
      values.push(disabled);
    }
    values.push(localId);
    const result = await pool.query(
      `UPDATE local_admins SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id, username, role, disabled`,
      values
    );
    res.json({
      user: {
        id: `local:${result.rows[0].id}`,
        email: `${result.rows[0].username}@local`,
        name: result.rows[0].username,
        role: result.rows[0].role,
        disabled: result.rows[0].disabled,
        source: "local"
      }
    });
    logAuditEvent({ action: "admin.users.update", resource: `local_admins:${localId}` }, req, getActor(req));
    return;
  }
  const aadId = id.replace("aad:", "");
  const fields: string[] = [];
  const values: Array<string | boolean> = [];
  let idx = 1;
  if (role !== undefined) {
    const normalized = normalizeRole(role);
    fields.push(`role = $${idx++}`);
    values.push(normalized);
  }
  if (disabled !== undefined) {
    fields.push(`disabled = $${idx++}`);
    values.push(disabled);
  }
  values.push(aadId);
  const result = await pool.query(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id, email, name, role, last_login, disabled`,
    values
  );
  res.json({
    user: {
      id: `aad:${result.rows[0].id}`,
      email: result.rows[0].email,
      name: result.rows[0].name,
      role: result.rows[0].role,
      last_login: result.rows[0].last_login,
      disabled: result.rows[0].disabled,
      source: "aad"
    }
  });
  logAuditEvent({ action: "admin.users.update", resource: `users:${aadId}` }, req, getActor(req));
  }
);

router.delete("/users/:id", requireRole(["superadmin"]), async (req: AuthedRequest, res) => {
  const { id } = req.params;
  if (id.startsWith("local:")) {
    const localId = id.replace("local:", "");
    const target = await pool.query("SELECT username FROM local_admins WHERE id = $1", [localId]);
    const targetEmail = target.rowCount ? `${target.rows[0].username}@local` : null;
    if (req.user && targetEmail && req.user.email === targetEmail) {
      res.status(400).json({ error: "Cannot delete current user" });
      return;
    }
    await pool.query("DELETE FROM local_admins WHERE id = $1", [localId]);
    res.json({ ok: true });
    logAuditEvent({ action: "admin.users.delete", resource: `local_admins:${localId}` }, req, getActor(req));
    return;
  }
  const aadId = id.replace("aad:", "");
  const target = await pool.query("SELECT email FROM users WHERE id = $1", [aadId]);
  const targetEmail = target.rowCount ? target.rows[0].email : null;
  if (req.user && targetEmail && req.user.email === targetEmail) {
    res.status(400).json({ error: "Cannot delete current user" });
    return;
  }
  await pool.query("DELETE FROM users WHERE id = $1", [aadId]);
  res.json({ ok: true });
  logAuditEvent({ action: "admin.users.delete", resource: `users:${aadId}` }, req, getActor(req));
});

router.post("/categories", requireRole(["admin", "superadmin"]), async (req, res) => {
  const { name } = req.body;
  const result = await pool.query("INSERT INTO categories (name) VALUES ($1) RETURNING *", [name]);
  res.json({ category: result.rows[0] });
  logAuditEvent({ action: "admin.categories.create", resource: "categories" }, req, getActor(req));
});

router.put("/categories/:id", requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const result = await pool.query("UPDATE categories SET name = $1 WHERE id = $2 RETURNING *", [name, id]);
  res.json({ category: result.rows[0] });
  logAuditEvent({ action: "admin.categories.update", resource: `categories:${id}` }, req, getActor(req));
});

router.delete("/categories/:id", requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM categories WHERE id = $1", [id]);
  res.json({ ok: true });
  logAuditEvent({ action: "admin.categories.delete", resource: `categories:${id}` }, req, getActor(req));
});

router.post("/forms", requireRole(["admin", "superadmin"]), async (req, res) => {
  const { title, type, url, description } = req.body;
  const result = await pool.query(
    "INSERT INTO forms (title, type, url, description) VALUES ($1,$2,$3,$4) RETURNING *",
    [title, type, url, description]
  );
  res.json({ form: result.rows[0] });
  logAuditEvent({ action: "admin.forms.create", resource: "forms" }, req, getActor(req));
});

router.put("/forms/:id", requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { title, type, url, description } = req.body;
  const result = await pool.query(
    "UPDATE forms SET title=$1, type=$2, url=$3, description=$4 WHERE id=$5 RETURNING *",
    [title, type, url, description, id]
  );
  res.json({ form: result.rows[0] });
  logAuditEvent({ action: "admin.forms.update", resource: `forms:${id}` }, req, getActor(req));
});

router.delete("/forms/:id", requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM forms WHERE id = $1", [id]);
  res.json({ ok: true });
  logAuditEvent({ action: "admin.forms.delete", resource: `forms:${id}` }, req, getActor(req));
});

router.get("/guides", requireRole(["admin", "superadmin", "editor"]), (_req, res) => {
  res.json({ guides: listGuides().map((guide) => normalizeGuidePayload(guide)) });
});

router.post("/guides/upload", requireRole(["admin", "superadmin", "editor"]), guideUpload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }
  res.json({ url: `/api/guides/images/${req.file.filename}` });
  logAuditEvent({ action: "admin.guides.upload", resource: "guides" }, req, getActor(req));
});

router.get("/policies", requireRole(["admin", "superadmin"]), async (_req, res) => {
  const result = await pool.query(
    "SELECT id, title, file_url, kind, created_at FROM policies ORDER BY created_at DESC"
  );
  res.json({ policies: result.rows });
});

router.post("/policies/upload", requireRole(["admin", "superadmin"]), policyUpload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }
  res.json({ url: `/api/uploads/policies/${req.file.filename}` });
  logAuditEvent({ action: "admin.policies.upload", resource: "policies" }, req, getActor(req));
});

router.post(
  "/branding/favicon",
  requireRole(["superadmin"]),
  brandingUpload.single("file"),
  (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }
    res.json({ ok: true, name: req.file.filename });
    logAuditEvent({ action: "admin.branding.upload", resource: "branding" }, req, getActor(req));
  }
);

router.post("/policies", requireRole(["admin", "superadmin"]), async (req, res) => {
  const { title, fileUrl, kind } = req.body as { title?: string; fileUrl?: string; kind?: string };
  if (!title || !fileUrl) {
    res.status(400).json({ error: "Title and file URL are required." });
    return;
  }
  const normalizedKind = kind === "procedure" ? "procedure" : "policy";
  const result = await pool.query(
    "INSERT INTO policies (title, file_url, kind) VALUES ($1, $2, $3) RETURNING id, title, file_url, kind, created_at",
    [title, fileUrl, normalizedKind]
  );
  res.json({ policy: result.rows[0] });
  logAuditEvent({ action: "admin.policies.create", resource: "policies" }, req, getActor(req));
});

router.delete("/policies/:id", requireRole(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const existing = await pool.query("SELECT file_url FROM policies WHERE id = $1", [id]);
  await pool.query("DELETE FROM policies WHERE id = $1", [id]);
  const fileUrl = existing.rows[0]?.file_url as string | undefined;
  if (fileUrl && fileUrl.startsWith("/uploads/policies/")) {
    const filename = path.basename(fileUrl);
    const filePath = path.join(policyUploadDir, filename);
    fs.unlink(filePath, () => undefined);
  }
  res.json({ ok: true });
  logAuditEvent({ action: "admin.policies.delete", resource: `policies:${id}` }, req, getActor(req));
});

router.post("/guides", requireRole(["admin", "superadmin", "editor"]), (req, res) => {
  const { title, subtitle, description, steps, published, type, body, videoUrl } = req.body as {
    title?: string;
    subtitle?: string;
    description?: string;
    steps?: GuideStepInput[];
    published?: boolean;
    type?: GuideType;
    body?: string;
    videoUrl?: string;
  };
  const normalizedVideoUrl = normalizeEmbedUrl(videoUrl);
  const resolvedType: GuideType =
    type || (normalizedVideoUrl ? "video" : body ? "knowledge" : "step");
  if (!title) {
    res.status(400).json({ error: "Title and guide type are required." });
    return;
  }
  if (resolvedType === "step") {
    if (!Array.isArray(steps) || steps.length === 0) {
      res.status(400).json({ error: "Step guides need at least one step." });
      return;
    }
    if (
      steps.some((step) => {
        const hasTitle = !!step.title && step.title.trim().length > 0;
        const hasContent = !!step.content && step.content.trim().length > 0;
        const hasImage = !!step.imageUrl && step.imageUrl.trim().length > 0;
        return !hasTitle || (!hasContent && !hasImage);
      })
    ) {
      res.status(400).json({ error: "Each step needs a title and either content or an image." });
      return;
    }
  }
  if (resolvedType === "knowledge" && (!body || !body.trim())) {
    res.status(400).json({ error: "Knowledge guides need content." });
    return;
  }
  if (resolvedType === "video" && !normalizedVideoUrl) {
    res.status(400).json({ error: "Video guides need a valid embed URL." });
    return;
  }
  const guide = createGuide({
    title,
    subtitle,
    description,
    steps,
    published,
    type: resolvedType,
    body,
    videoUrl: normalizedVideoUrl
  });
  res.json({ guide: normalizeGuidePayload(guide) });
  logAuditEvent({ action: "admin.guides.create", resource: "guides" }, req, getActor(req));
});

router.put("/guides/:id", requireRole(["admin", "superadmin", "editor"]), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid guide id" });
    return;
  }
  const { title, subtitle, description, steps, published, type, body, videoUrl } = req.body as {
    title?: string;
    subtitle?: string;
    description?: string;
    steps?: GuideStepInput[];
    published?: boolean;
    type?: GuideType;
    body?: string;
    videoUrl?: string;
  };
  const normalizedVideoUrl = normalizeEmbedUrl(videoUrl);
  const resolvedType: GuideType =
    type || (normalizedVideoUrl ? "video" : body ? "knowledge" : "step");
  if (!title) {
    res.status(400).json({ error: "Title and guide type are required." });
    return;
  }
  if (resolvedType === "step") {
    if (!Array.isArray(steps) || steps.length === 0) {
      res.status(400).json({ error: "Step guides need at least one step." });
      return;
    }
    if (
      steps.some((step) => {
        const hasTitle = !!step.title && step.title.trim().length > 0;
        const hasContent = !!step.content && step.content.trim().length > 0;
        const hasImage = !!step.imageUrl && step.imageUrl.trim().length > 0;
        return !hasTitle || (!hasContent && !hasImage);
      })
    ) {
      res.status(400).json({ error: "Each step needs a title and either content or an image." });
      return;
    }
  }
  if (resolvedType === "knowledge" && (!body || !body.trim())) {
    res.status(400).json({ error: "Knowledge guides need content." });
    return;
  }
  if (resolvedType === "video" && !normalizedVideoUrl) {
    res.status(400).json({ error: "Video guides need a valid embed URL." });
    return;
  }
  const guide = updateGuide(id, {
    title,
    subtitle,
    description,
    steps,
    published,
    type: resolvedType,
    body,
    videoUrl: normalizedVideoUrl
  });
  if (!guide) {
    res.status(404).json({ error: "Guide not found" });
    return;
  }
  res.json({ guide: normalizeGuidePayload(guide) });
  logAuditEvent({ action: "admin.guides.update", resource: `guides:${id}` }, req, getActor(req));
});

router.delete("/guides/:id", requireRole(["admin", "superadmin", "editor"]), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid guide id" });
    return;
  }
  const removed = deleteGuide(id);
  if (!removed) {
    res.status(404).json({ error: "Guide not found" });
    return;
  }
  res.json({ ok: true });
  logAuditEvent({ action: "admin.guides.delete", resource: `guides:${id}` }, req, getActor(req));
});

router.get("/guides/ratings", requireRole(["superadmin"]), async (req, res) => {
  const guideId = req.query.guideId ? String(req.query.guideId) : null;
  try {
    const params: string[] = [];
    let query =
      "SELECT id, guide_id, user_name, user_email, rating, comment, created_at FROM guide_ratings WHERE comment IS NOT NULL AND comment <> ''";
    if (guideId) {
      params.push(guideId);
      query += " AND guide_id = $1";
    }
    query += " ORDER BY created_at DESC LIMIT 200";
    const result = await pool.query(query, params);
    const rows = result.rows.map((row) => ({
      ...row,
      guide_title: getGuide(Number(row.guide_id))?.title || `Guide ${row.guide_id}`
    }));
    res.json({ comments: rows });
  } catch (error) {
    console.error("Guide comments fetch failed", error);
    res.status(500).json({ error: "Failed to load guide comments" });
  }
});

router.delete("/guides/ratings/:id/comment", requireRole(["superadmin"]), async (req, res) => {
  const id = String(req.params.id || "");
  if (!id) {
    res.status(400).json({ error: "Invalid comment id" });
    return;
  }
  try {
    await pool.query("UPDATE guide_ratings SET comment = NULL, updated_at = NOW() WHERE id = $1", [id]);
    res.json({ ok: true });
    logAuditEvent({ action: "admin.guides.comment_delete", resource: `guide_ratings:${id}` }, req, getActor(req));
  } catch (error) {
    console.error("Guide comment delete failed", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

router.post("/knowledge", async (req: AuthedRequest, res) => {
  const { title, category, body, tags } = req.body;
  const author = req.user?.name || req.user?.email || "Unknown";
  const result = await pool.query(
    "INSERT INTO knowledge_base (title, category, body, tags, author) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [title, category, body, tags, author]
  );
  res.json({ article: result.rows[0] });
  logAuditEvent({ action: "admin.knowledge.create", resource: "knowledge" }, req, getActor(req));
});

router.put("/knowledge/:id", async (req, res) => {
  const { id } = req.params;
  const { title, category, body, tags } = req.body;
  const result = await pool.query(
    "UPDATE knowledge_base SET title=$1, category=$2, body=$3, tags=$4, updated_at=NOW() WHERE id=$5 RETURNING *",
    [title, category, body, tags, id]
  );
  res.json({ article: result.rows[0] });
  logAuditEvent({ action: "admin.knowledge.update", resource: `knowledge:${id}` }, req, getActor(req));
});

router.delete("/knowledge/:id", async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM knowledge_base WHERE id = $1", [id]);
  res.json({ ok: true });
  logAuditEvent({ action: "admin.knowledge.delete", resource: `knowledge:${id}` }, req, getActor(req));
});

router.get("/helpdesk/settings", requireRole(["admin", "superadmin"]), async (_req, res) => {
  const result = await pool.query("SELECT key, value FROM settings");
  const settings = result.rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
  let sites: unknown[] = [];
  let urgencyOptions: unknown[] = [];
  try {
    sites = settings.helpdesk_sites ? JSON.parse(settings.helpdesk_sites) : [];
  } catch {
    sites = [];
  }
  try {
    urgencyOptions = settings.helpdesk_urgency_options ? JSON.parse(settings.helpdesk_urgency_options) : [];
  } catch {
    urgencyOptions = [];
  }
  res.json({
    settings: {
      apiBaseUrl: settings.helpdesk_api_base_url || "",
      apiKeyHeaderName: settings.helpdesk_api_key_header || "",
      apiKeyValue: "",
      apiKeyValuePresent: Boolean(settings.helpdesk_api_key_value),
      source: settings.helpdesk_source || "Portal",
      enableAssets: settings.helpdesk_enable_assets === "true",
      defaultSiteCode: settings.helpdesk_default_site_code || "",
      urgencyOptions: Array.isArray(urgencyOptions) ? urgencyOptions : [],
      sites: Array.isArray(sites) ? sites : []
    }
  });
});

router.put("/helpdesk/settings", requireRole(["admin", "superadmin"]), async (req, res) => {
  const {
    apiBaseUrl,
    apiKeyHeaderName,
    apiKeyValue,
    source,
    enableAssets,
    defaultSiteCode,
    urgencyOptions,
    sites
  } = req.body as {
    apiBaseUrl?: string;
    apiKeyHeaderName?: string;
    apiKeyValue?: string;
    source?: string;
    enableAssets?: boolean;
    defaultSiteCode?: string;
    urgencyOptions?: string[];
    sites?: Array<{ code?: string; label?: string; enabled?: boolean; sortOrder?: number }>;
  };

  const normalizedSites = Array.isArray(sites)
    ? sites
        .map((site, index) => ({
          code: typeof site.code === "string" ? site.code.trim() : "",
          label: typeof site.label === "string" ? site.label.trim() : "",
          enabled: typeof site.enabled === "boolean" ? site.enabled : true,
          sortOrder:
            typeof site.sortOrder === "number" && Number.isFinite(site.sortOrder)
              ? site.sortOrder
              : index + 1
        }))
        .filter((site) => site.code && site.label)
    : [];

  const codes = normalizedSites.map((site) => site.code.toLowerCase());
  const uniqueCodes = new Set(codes);
  if (codes.length !== uniqueCodes.size) {
    res.status(400).json({ error: "Site codes must be unique." });
    return;
  }

  const normalizedUrgency = Array.isArray(urgencyOptions)
    ? urgencyOptions.map((opt) => String(opt).trim()).filter(Boolean)
    : [];

  const updates: Array<[string, string | undefined]> = [
    ["helpdesk_api_base_url", apiBaseUrl],
    ["helpdesk_api_key_header", apiKeyHeaderName],
    ["helpdesk_api_key_value", apiKeyValue],
    ["helpdesk_source", source],
    ["helpdesk_enable_assets", enableAssets !== undefined ? String(enableAssets) : undefined],
    ["helpdesk_default_site_code", defaultSiteCode],
    ["helpdesk_urgency_options", JSON.stringify(normalizedUrgency)],
    ["helpdesk_sites", JSON.stringify(normalizedSites)]
  ];
  const secretKeys = new Set(["helpdesk_api_key_value"]);

  for (const [key, value] of updates) {
    if (value === undefined) continue;
    if (secretKeys.has(key) && String(value).trim() === "") continue;
    await pool.query(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [key, value]
    );
  }
  clearSettingsCache();
  res.json({ ok: true });
  logAuditEvent({ action: "admin.helpdesk.update", resource: "helpdesk_settings" }, req, getActor(req));
});

router.put("/settings", requireRole(["admin", "superadmin"]), async (req: AuthedRequest, res) => {
  const { portalTitle, announcement } = req.body as {
    portalTitle?: string;
    announcement?: string;
  };
  const {
    azureClientId,
    azureClientSecret,
    azureTenantId,
    frontendUrl,
    adminUrl,
    userRedirectUri,
    adminRedirectUri,
    footerText,
    localLoginEnabled,
    pageGuidesEnabled,
    pageActionPlanEnabled,
    pageAnnouncementsEnabled,
    pageTicketsEnabled,
    pageFormsEnabled,
    pagePoliciesEnabled,
    pageProfileEnabled,
    pageServicesEnabled,
    pageStatusEnabled,
    pageAboutEnabled,
    homeStartTitle,
    homeStartItems,
    homeOperationalTitle,
    homeOperationalBody
  } = req.body as {
    azureClientId?: string;
    azureClientSecret?: string;
    azureTenantId?: string;
    frontendUrl?: string;
    adminUrl?: string;
    userRedirectUri?: string;
    adminRedirectUri?: string;
    footerText?: string;
    localLoginEnabled?: boolean;
    pageGuidesEnabled?: boolean;
    pageActionPlanEnabled?: boolean;
    pageAnnouncementsEnabled?: boolean;
    pageTicketsEnabled?: boolean;
    pageFormsEnabled?: boolean;
    pagePoliciesEnabled?: boolean;
    pageProfileEnabled?: boolean;
    pageServicesEnabled?: boolean;
    pageStatusEnabled?: boolean;
    pageAboutEnabled?: boolean;
    homeStartTitle?: string;
    homeStartItems?: string;
    homeOperationalTitle?: string;
    homeOperationalBody?: string;
  };
  const localLoginEnabledValue =
    localLoginEnabled === undefined
      ? undefined
      : BOOTSTRAP_LOCAL_ONLY
        ? "true"
        : localLoginEnabled
          ? "true"
          : "false";
  const updates: Array<[string, string | undefined]> = [
    ["portal_title", portalTitle],
    ["announcement", announcement],
    ["footer_text", footerText],
    ["home_start_title", homeStartTitle],
    ["home_start_items", homeStartItems],
    ["home_operational_title", homeOperationalTitle],
    ["home_operational_body", homeOperationalBody],
    ["local_login_enabled", localLoginEnabledValue],
    ["page_guides_enabled", pageGuidesEnabled === undefined ? undefined : pageGuidesEnabled ? "true" : "false"],
    ["page_action_plan_enabled", pageActionPlanEnabled === undefined ? undefined : pageActionPlanEnabled ? "true" : "false"],
    ["page_announcements_enabled", pageAnnouncementsEnabled === undefined ? undefined : pageAnnouncementsEnabled ? "true" : "false"],
    ["page_tickets_enabled", pageTicketsEnabled === undefined ? undefined : pageTicketsEnabled ? "true" : "false"],
    ["page_forms_enabled", pageFormsEnabled === undefined ? undefined : pageFormsEnabled ? "true" : "false"],
    ["page_policies_enabled", pagePoliciesEnabled === undefined ? undefined : pagePoliciesEnabled ? "true" : "false"],
    ["page_profile_enabled", pageProfileEnabled === undefined ? undefined : pageProfileEnabled ? "true" : "false"],
    ["page_services_enabled", pageServicesEnabled === undefined ? undefined : pageServicesEnabled ? "true" : "false"],
    ["page_status_enabled", pageStatusEnabled === undefined ? undefined : pageStatusEnabled ? "true" : "false"],
    ["page_about_enabled", pageAboutEnabled === undefined ? undefined : pageAboutEnabled ? "true" : "false"],
    ["azure_client_id", azureClientId],
    ["azure_client_secret", azureClientSecret],
    ["azure_tenant_id", azureTenantId],
    ["frontend_url", frontendUrl],
    ["admin_url", adminUrl],
    ["user_redirect_uri", userRedirectUri],
    ["admin_redirect_uri", adminRedirectUri]
  ];
  const secretKeys = new Set([
    "azure_client_secret",
    "uptime_kuma_api_key"
  ]);
  const role = req.user?.role || "user";
  const isSuperAdmin = role === "superadmin";
  const safeKeys = new Set([
    "portal_title",
    "announcement",
    "footer_text"
  ]);
  for (const [key, value] of updates) {
    if (value === undefined) continue;
    if (!isSuperAdmin && !safeKeys.has(key)) continue;
    if (secretKeys.has(key) && String(value).trim() === "") continue;
    await pool.query(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [key, value]
    );
  }
  clearSettingsCache();
  res.json({ ok: true });
  logAuditEvent({ action: "admin.settings.update", resource: "settings" }, req, getActor(req));
});

router.get("/tour", requireRole(["superadmin"]), async (_req, res) => {
  const result = await pool.query("SELECT value FROM settings WHERE key = 'tour_steps'");
  if (!result.rowCount) {
    res.json({ steps: [] });
    return;
  }
  let steps: unknown = [];
  try {
    steps = JSON.parse(result.rows[0].value as string);
  } catch {
    steps = [];
  }
  res.json({ steps: Array.isArray(steps) ? steps : [] });
});

router.put("/tour", requireRole(["superadmin"]), async (req: AuthedRequest, res) => {
  const { steps } = req.body as { steps?: unknown };
  if (!Array.isArray(steps)) {
    res.status(400).json({ error: "Invalid steps payload" });
    return;
  }
  const normalized = steps
    .filter((step) => step && typeof step === "object")
    .map((step: any) => ({
      id: String(step.id || ""),
      title: String(step.title || ""),
      body: String(step.body || ""),
      selector: String(step.selector || ""),
      route: step.route ? String(step.route) : "",
      placement: step.placement ? String(step.placement) : "",
      enabled: step.enabled !== false
    }));
  await pool.query(
    "INSERT INTO settings (key, value) VALUES ('tour_steps', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [JSON.stringify(normalized)]
  );
  clearSettingsCache();
  res.json({ ok: true });
});

router.get("/db/export", requireRole(["superadmin"]), async (req: AuthedRequest, res) => {
  const tablesResult = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  const tables = tablesResult.rows.map((row) => row.tablename as string);
  const data: Record<string, unknown[]> = {};
  for (const table of tables) {
    const rows = await pool.query(`SELECT * FROM "${table}"`);
    data[table] = rows.rows;
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    exportedBy: req.user?.email || "unknown",
    tables: data
  };
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename=\"itdportal-export-${stamp}.json\"`);
  res.send(JSON.stringify(payload));
  logAuditEvent({ action: "admin.db.export", resource: "db" }, req, getActor(req));
});

router.post("/db/import", requireRole(["superadmin"]), dbUpload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  let payload: { tables?: Record<string, unknown[]> } | null = null;
  try {
    payload = JSON.parse(req.file.buffer.toString("utf-8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON file" });
    return;
  }
  if (!payload?.tables || typeof payload.tables !== "object") {
    res.status(400).json({ error: "Invalid export format" });
    return;
  }
  const tables = Object.keys(payload.tables);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET session_replication_role = replica");
    if (tables.length) {
      await client.query(`TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
    }
    for (const table of tables) {
      const rows = payload.tables[table] || [];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const keys = Object.keys(row as Record<string, unknown>);
        if (!keys.length) continue;
        const cols = keys.map((key) => `"${key}"`).join(", ");
        const values = keys.map((_, idx) => `$${idx + 1}`).join(", ");
        const params = keys.map((key) => (row as Record<string, unknown>)[key]);
        await client.query(`INSERT INTO "${table}" (${cols}) VALUES (${values})`, params);
      }
    }
    await client.query("SET session_replication_role = origin");
    await client.query("COMMIT");
    console.log("Database import completed by", req.user?.email || "unknown");
    res.json({ ok: true });
    logAuditEvent({ action: "admin.db.import", resource: "db" }, req, getActor(req));
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Import failed" });
  } finally {
    try {
      await client.query("SET session_replication_role = origin");
    } catch {
      // ignore
    }
    client.release();
  }
});

const computeManualStatus = (startsAt: Date, endsAt: Date | null) => {
  const now = new Date();
  if (now < startsAt) return "scheduled";
  if (endsAt && now > endsAt) return "expired";
  return "active";
};

router.get("/announcements", requireRole(["admin", "superadmin", "editor", "planner"]), async (req, res) => {
  const source = typeof req.query.source === "string" ? req.query.source : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";

  if (source && !["manual", "uptime_kuma"].includes(source)) {
    return res.status(400).json({ message: "Invalid source" });
  }

  if (source === "uptime_kuma") {
    const params: unknown[] = [];
    let where = "source = 'uptime_kuma'";
    if (status) {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT * FROM announcements WHERE ${where} ORDER BY updated_at DESC`,
      params
    );
    return res.json({ announcements: rows });
  }

  const { rows } = await pool.query(
    `
    SELECT
      *,
      CASE
        WHEN now() < starts_at THEN 'scheduled'
        WHEN ends_at IS NOT NULL AND now() > ends_at THEN 'expired'
        ELSE 'active'
      END AS computed_status
    FROM announcements
    WHERE source = 'manual'
    ORDER BY pinned DESC, created_at DESC
    `
  );

  const filtered = status
    ? rows.filter((row) => row.computed_status === status)
    : rows;
  res.json({ announcements: filtered });
});

router.post(
  "/announcements",
  requireRole(["admin", "superadmin"]),
  async (req: AuthedRequest, res) => {
    const { title, message, severity, pinned, starts_at, ends_at, kind } = req.body as Record<string, unknown>;
    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required." });
    }
    const starts = starts_at ? new Date(String(starts_at)) : new Date();
    const ends = ends_at ? new Date(String(ends_at)) : null;
    if (ends && ends <= starts) {
      return res.status(400).json({ message: "End time must be after start time." });
    }
    const status = computeManualStatus(starts, ends);
    const { rows } = await pool.query(
      `
      INSERT INTO announcements
        (source, kind, title, message, severity, status, pinned, starts_at, ends_at, created_by, created_at, updated_at)
      VALUES
        ('manual', $1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
      RETURNING *
      `,
      [
        kind && ["information", "announcement", "system_maintenance"].includes(String(kind))
          ? String(kind)
          : "announcement",
        String(title),
        String(message),
        severity && ["info", "warning", "critical"].includes(String(severity)) ? String(severity) : "info",
        status,
        Boolean(pinned),
        starts,
        ends,
        req.user?.email || null
      ]
    );
    broadcastAnnouncementsUpdate({ type: "changed" });
    res.json({ announcement: rows[0] });
    logAuditEvent({ action: "admin.announcements.create", resource: "announcements" }, req, getActor(req));
  }
);

router.put(
  "/announcements/:id",
  requireRole(["admin", "superadmin"]),
  async (req, res) => {
    const { id } = req.params;
    const { title, message, severity, pinned, starts_at, ends_at, kind } = req.body as Record<string, unknown>;
    const existing = await pool.query("SELECT * FROM announcements WHERE id = $1", [id]);
    if (!existing.rows[0]) {
      return res.status(404).json({ message: "Not found" });
    }
    if (existing.rows[0].source !== "manual") {
      return res.status(403).json({ message: "System announcements are read-only." });
    }
    const starts = starts_at ? new Date(String(starts_at)) : new Date(existing.rows[0].starts_at);
    const ends = ends_at ? new Date(String(ends_at)) : existing.rows[0].ends_at ? new Date(existing.rows[0].ends_at) : null;
    if (ends && ends <= starts) {
      return res.status(400).json({ message: "End time must be after start time." });
    }
    const status = computeManualStatus(starts, ends);
    const { rows } = await pool.query(
      `
      UPDATE announcements
      SET kind = $1,
          title = $2,
          message = $3,
          severity = $4,
          pinned = $5,
          starts_at = $6,
          ends_at = $7,
          status = $8,
          updated_at = now()
      WHERE id = $9
      RETURNING *
      `,
      [
        kind && ["information", "announcement", "system_maintenance"].includes(String(kind))
          ? String(kind)
          : existing.rows[0].kind || "announcement",
        title ? String(title) : existing.rows[0].title,
        message ? String(message) : existing.rows[0].message,
        severity && ["info", "warning", "critical"].includes(String(severity))
          ? String(severity)
          : existing.rows[0].severity,
        pinned !== undefined ? Boolean(pinned) : existing.rows[0].pinned,
        starts,
        ends,
        status,
        id
      ]
    );
    broadcastAnnouncementsUpdate({ type: "changed" });
    res.json({ announcement: rows[0] });
    logAuditEvent({ action: "admin.announcements.update", resource: `announcements:${id}` }, req, getActor(req));
  }
);

router.delete(
  "/announcements/:id",
  requireRole(["admin", "superadmin"]),
  async (req, res) => {
    const { id } = req.params;
    const existing = await pool.query("SELECT * FROM announcements WHERE id = $1", [id]);
    if (!existing.rows[0]) {
      return res.status(404).json({ message: "Not found" });
    }
    if (existing.rows[0].source !== "manual") {
      return res.status(403).json({ message: "System announcements are read-only." });
    }
    await pool.query("DELETE FROM announcements WHERE id = $1", [id]);
    broadcastAnnouncementsUpdate({ type: "changed" });
    res.json({ ok: true });
    logAuditEvent({ action: "admin.announcements.delete", resource: `announcements:${id}` }, req, getActor(req));
  }
);

router.get("/audit-logs", requireRole(["admin", "superadmin"]), async (req: AuthedRequest, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const offset = Math.max(Number(req.query.offset || 0), 0);
  const action = typeof req.query.action === "string" ? req.query.action.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const where: string[] = [];
  const params: any[] = [];
  if (action) {
    params.push(action);
    where.push(`action = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(limit);
  params.push(offset);
  const result = await pool.query(
    `SELECT id, created_at, actor_email, actor_role, action, resource, status, ip_address, user_agent, metadata
     FROM audit_logs ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ logs: result.rows });
});

router.get("/audit-logs/export", requireRole(["admin", "superadmin"]), async (_req, res) => {
  const result = await pool.query(
    `SELECT created_at, actor_email, actor_role, action, resource, status, ip_address, user_agent
     FROM audit_logs ORDER BY created_at DESC LIMIT 5000`
  );
  const header = "created_at,actor_email,actor_role,action,resource,status,ip_address,user_agent\n";
  const rows = result.rows
    .map((row) =>
      [
        row.created_at?.toISOString?.() || row.created_at,
        row.actor_email || "",
        row.actor_role || "",
        row.action || "",
        row.resource || "",
        row.status || "",
        row.ip_address || "",
        (row.user_agent || "").replace(/[\r\n]+/g, " ")
      ]
        .map((val: string) => `"${String(val).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=\"audit-logs-${Date.now()}.csv\"`);
  res.send(header + rows);
});

export default router;
