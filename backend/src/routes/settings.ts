import { Router } from "express";
import pool from "../db.js";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth.js";
import { clearSettingsCache } from "../settings.js";
import { encryptPayload } from "../utils/cryptoPayload.js";
import { buildOrigin, requireHandshake } from "../authHandshake.js";

const router = Router();
const parseBooleanEnv = (value?: string): boolean => /^(1|true|yes|on)$/i.test((value || "").trim());
const BOOTSTRAP_LOCAL_ONLY = parseBooleanEnv(process.env.BOOTSTRAP_LOCAL_ONLY);

const SAFE_SETTING_KEYS = new Set([
  "portal_title",
  "announcement",
  "footer_text",
  "nav_order_desktop",
  "local_login_enabled",
  "page_guides_enabled",
  "page_action_plan_enabled",
  "page_announcements_enabled",
  "page_tickets_enabled",
  "page_forms_enabled",
  "page_policies_enabled",
  "page_profile_enabled",
  "page_services_enabled",
  "page_status_enabled",
  "page_about_enabled",
  "home_start_title",
  "home_start_items",
  "home_operational_title",
  "home_operational_body"
]);

const pickSafeSettings = (settings: Record<string, string>) => {
  const safe: Record<string, string> = {};
  for (const key of SAFE_SETTING_KEYS) {
    if (settings[key] !== undefined) {
      safe[key] = settings[key];
    }
  }
  return safe;
};

router.get("/public", requireAuth, async (_req, res) => {
  const result = await pool.query("SELECT key, value FROM settings ORDER BY key");
  const settings = result.rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
  res.json({ settings: pickSafeSettings(settings) });
});

router.get("/", requireAuth, requireRole(["superadmin"]), async (req, res) => {
  const result = await pool.query("SELECT key, value FROM settings ORDER BY key");
  const settings = result.rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
  const secretPresence = {
    azure_client_secret_present: Boolean(settings.azure_client_secret || process.env.AZURE_CLIENT_SECRET),
    db_password_present: Boolean(process.env.DB_PASSWORD),
    uptime_kuma_api_key_present: Boolean(settings.uptime_kuma_api_key),
    aps_api_token_present: Boolean(settings.aps_api_token || process.env.APS_TOKEN)
  };
  const fallback = {
    azure_client_id: process.env.AZURE_CLIENT_ID || "",
    azure_tenant_id: process.env.AZURE_TENANT_ID || "",
    frontend_url: process.env.FRONTEND_URL || "",
    admin_url: process.env.ADMIN_URL || "",
    user_redirect_uri: process.env.USER_REDIRECT_URI || "",
    admin_redirect_uri: process.env.ADMIN_REDIRECT_URI || "",
    db_user: process.env.DB_USER || "",
    db_name: process.env.DB_NAME || "",
    db_host: process.env.DB_HOST || "",
    db_port: process.env.DB_PORT || ""
  };
  for (const [key, value] of Object.entries(fallback)) {
    if (settings[key] === undefined && value) {
      settings[key] = value;
    }
  }
  // DB runtime connection settings are now server-managed; always display env values in admin UI.
  settings.db_user = process.env.DB_USER || "";
  settings.db_name = process.env.DB_NAME || "";
  settings.db_host = process.env.DB_HOST || "";
  settings.db_port = process.env.DB_PORT || "";
  settings.bootstrap_local_only_active = BOOTSTRAP_LOCAL_ONLY ? "true" : "false";
  settings.db_connection_managed_externally = "true";
  settings.infra_config_managed_externally = "true";
  settings.azure_client_secret = "";
  settings.db_password = "";
  settings.uptime_kuma_api_key = "";
  settings.aps_api_token = "";
  Object.assign(settings, secretPresence);
  const handshake = requireHandshake(req, res, true);
  if (!handshake) return;
  const bundle = encryptPayload({ settings }, handshake.key, handshake.kid, [
    handshake.handshakeId,
    buildOrigin(req),
    "settings"
  ]);
  res.json({ encSettings: bundle });
});

router.put("/", requireAuth, requireRole(["admin", "superadmin"]), async (req: AuthedRequest, res) => {
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
    uptimeKumaBaseUrl,
    uptimeKumaApiKey,
    uptimeKumaMonitorIds,
    uptimeKumaApiEndpoint,
    uptimeKumaInsecure,
    navOrderDesktop,
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
    apsApiToken,
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
    uptimeKumaBaseUrl?: string;
    uptimeKumaApiKey?: string;
    uptimeKumaMonitorIds?: string;
    uptimeKumaApiEndpoint?: string;
    uptimeKumaInsecure?: boolean;
    navOrderDesktop?: string;
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
    apsApiToken?: string;
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
    ["admin_redirect_uri", adminRedirectUri],
    ["uptime_kuma_base_url", uptimeKumaBaseUrl],
    ["uptime_kuma_api_key", uptimeKumaApiKey],
    ["uptime_kuma_monitor_ids", uptimeKumaMonitorIds],
    ["uptime_kuma_api_endpoint", uptimeKumaApiEndpoint],
    ["uptime_kuma_insecure", uptimeKumaInsecure === undefined ? undefined : uptimeKumaInsecure ? "true" : "false"],
    ["nav_order_desktop", navOrderDesktop],
    ["aps_api_token", apsApiToken]
  ];
  const secretKeys = new Set([
    "azure_client_secret",
    "uptime_kuma_api_key",
    "aps_api_token"
  ]);
  const role = req.user?.role || "user";
  const isSuperAdmin = role === "superadmin";
  const safeKeys = new Set(["portal_title", "announcement", "footer_text"]);
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
});

export default router;
