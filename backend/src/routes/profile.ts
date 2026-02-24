import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/auth.js";
import { getGraphToken } from "../graphTokens.js";

const router = Router();

const LICENSE_FRIENDLY_NAMES: Record<string, string> = {
  ENTERPRISEPACK: "Office 365 E3",
  SPE_E3: "Microsoft 365 E3",
  SPE_E5: "Microsoft 365 E5",
  BUSINESS_STANDARD: "Microsoft 365 Business Standard",
  BUSINESS_BASIC: "Microsoft 365 Business Basic"
};

const SERVICE_PLAN_MAP: Record<
  string,
  { friendlyServiceName: string; description: string }
> = {
  EXCHANGE_S_ENTERPRISE: {
    friendlyServiceName: "Email & Calendar (Outlook)",
    description: "Business email, calendars, and contacts."
  },
  EXCHANGE_S_STANDARD: {
    friendlyServiceName: "Email & Calendar (Outlook)",
    description: "Business email, calendars, and contacts."
  },
  MCOSTANDARD: {
    friendlyServiceName: "Chat, calls, and meetings (Teams)",
    description: "Teams messaging, meetings, and collaboration."
  },
  MCOEV: {
    friendlyServiceName: "Chat, calls, and meetings (Teams)",
    description: "Teams voice, meetings, and collaboration."
  },
  SHAREPOINTSTANDARD: {
    friendlyServiceName: "Intranet & document sites (SharePoint)",
    description: "Team sites and document collaboration."
  },
  SHAREPOINTENTERPRISE: {
    friendlyServiceName: "Intranet & document sites (SharePoint)",
    description: "Advanced SharePoint collaboration and intranet."
  },
  ONEDRIVE: {
    friendlyServiceName: "Personal cloud storage (OneDrive)",
    description: "Store, sync, and share files securely."
  },
  OFFICESUBSCRIPTION: {
    friendlyServiceName: "Installable Office apps (Word, Excel, PowerPoint, Outlook)",
    description: "Desktop Office apps for PC and Mac."
  },
  OFFICEWEB: {
    friendlyServiceName: "Use Word/Excel/PowerPoint in the browser",
    description: "Office apps available on the web."
  },
  OFFICE_FORMS_PLAN_2: {
    friendlyServiceName: "Use Word/Excel/PowerPoint in the browser",
    description: "Office apps available on the web."
  },
  SHAREPOINTWAC: {
    friendlyServiceName: "Use Word/Excel/PowerPoint in the browser",
    description: "Office apps available on the web."
  },
  POWER_BI_STANDARD: {
    friendlyServiceName: "Analytics and dashboards (Power BI)",
    description: "Create and share interactive reports."
  },
  INTUNE_A: {
    friendlyServiceName: "Device management and compliance (Intune)",
    description: "Manage devices and enforce compliance."
  },
  ENTERPRISE_MOBILITY_SECURITY_E3: {
    friendlyServiceName: "Device management and compliance (Intune)",
    description: "Security and device management tools."
  },
  ATP_ENTERPRISE: {
    friendlyServiceName: "Security protection (Microsoft Defender)",
    description: "Threat protection and security controls."
  },
  MDE_PLAN_1: {
    friendlyServiceName: "Security protection (Microsoft Defender)",
    description: "Endpoint protection for devices."
  },
  AIP_S_CLP1: {
    friendlyServiceName: "Data protection and classification",
    description: "Data classification and protection policies."
  },
  AIP_S_CLP2: {
    friendlyServiceName: "Data protection and classification",
    description: "Advanced data classification and protection."
  }
};

type LicenseCacheEntry = {
  expiresAt: number;
  data: unknown;
};

const licenseCache = new Map<string, LicenseCacheEntry>();
const LICENSE_TTL_MS = 15 * 60 * 1000;
const accessCache = new Map<string, LicenseCacheEntry>();

function getCached(email: string): unknown | null {
  const entry = licenseCache.get(email.toLowerCase());
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    licenseCache.delete(email.toLowerCase());
    return null;
  }
  return entry.data;
}

function setCached(email: string, data: unknown): void {
  licenseCache.set(email.toLowerCase(), { data, expiresAt: Date.now() + LICENSE_TTL_MS });
}

function getAccessCached(email: string): unknown | null {
  const entry = accessCache.get(email.toLowerCase());
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    accessCache.delete(email.toLowerCase());
    return null;
  }
  return entry.data;
}

function setAccessCached(email: string, data: unknown): void {
  accessCache.set(email.toLowerCase(), { data, expiresAt: Date.now() + LICENSE_TTL_MS });
}

router.get("/microsoft-access", requireAuth, async (req: AuthedRequest, res) => {
  const userEmail = req.user?.email;
  if (!userEmail) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const cached = getAccessCached(userEmail);
  if (cached) {
    res.json(cached);
    return;
  }
  const accessToken = getGraphToken(userEmail);
  if (!accessToken) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me/licenseDetails", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (response.status === 401 || response.status === 403) {
      res.status(403).json({ message: "Insufficient permissions to read Microsoft access details." });
      return;
    }
    if (!response.ok) {
      console.error("Graph microsoft access fetch failed", { status: response.status });
      res.status(502).json({ message: "Unable to load Microsoft access details right now." });
      return;
    }
    const payload = (await response.json()) as {
      value?: Array<{
        skuPartNumber?: string;
        servicePlans?: Array<{
          servicePlanName?: string;
          provisioningStatus?: string;
        }>;
      }>;
    };

    const licenses = payload.value || [];
    const hasLicenses = licenses.length > 0;

    let hasEmail = false;
    let hasTeams = false;
    let hasTeamsFallback = false;
    let desktop = false;
    let web = false;
    let project = false;

    licenses.forEach((license) => {
      const sku = (license.skuPartNumber || "").toUpperCase();
      if (sku.includes("PROJECT")) {
        project = true;
      }
      (license.servicePlans || [])
        .filter((plan) => plan.provisioningStatus === "Success")
        .forEach((plan) => {
          const planName = (plan.servicePlanName || "").toUpperCase();
          if (planName.includes("EXCHANGE")) {
            hasEmail = true;
          }
          if (planName.includes("TEAMS")) {
            hasTeams = true;
          } else if (planName.startsWith("MCO")) {
            hasTeamsFallback = true;
          }
          if (planName.includes("OFFICE_CLIENT")) {
            desktop = true;
          }
          if (planName.includes("OFFICEWEB") || planName.includes("OFFICE_FOR_THE_WEB") || planName.includes("SHAREPOINTWAC")) {
            web = true;
          }
          if (planName.includes("PROJECT")) {
            project = true;
          }
          if (planName.includes("OFFICESUBSCRIPTION")) {
            desktop = true;
          }
        });
    });

    if (!hasTeams && hasTeamsFallback) {
      hasTeams = true;
    }
    if (desktop && !web) {
      web = true;
    }

    const result = {
      outlookEmail: { hasAccess: hasEmail, note: "Email & calendar in Outlook" },
      officeApps: { desktop, web, note: "Word, Excel, PowerPoint" },
      teams: { hasAccess: hasTeams, note: "Chat, calls, meetings" },
      project: { hasAccess: project, note: "Microsoft Project" },
      ...(hasLicenses ? {} : { message: "No Microsoft license assigned to your account." })
    };

    setAccessCached(userEmail, result);
    res.json(result);
  } catch (err) {
    console.error("Graph microsoft access error", err);
    res.status(502).json({ message: "Unable to load Microsoft access details right now." });
  }
});

router.get("/licenses", requireAuth, async (req: AuthedRequest, res) => {
  const userEmail = req.user?.email;
  if (!userEmail) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const cached = getCached(userEmail);
  if (cached) {
    res.json(cached);
    return;
  }
  const accessToken = getGraphToken(userEmail);
  if (!accessToken) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  try {
    const [profileResponse, licenseResponse] = await Promise.all([
      fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${accessToken}` }
      }),
      fetch("https://graph.microsoft.com/v1.0/me/licenseDetails", {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
    ]);

    if ([profileResponse.status, licenseResponse.status].some((status) => status === 401 || status === 403)) {
      res.status(403).json({ message: "Insufficient permissions to read license details." });
      return;
    }
    if (!profileResponse.ok || !licenseResponse.ok) {
      console.error("Graph license fetch failed", {
        profileStatus: profileResponse.status,
        licenseStatus: licenseResponse.status
      });
      res.status(502).json({ message: "Unable to load license details right now." });
      return;
    }
    const profile = (await profileResponse.json()) as {
      displayName?: string;
      userPrincipalName?: string;
    };
    const licensePayload = (await licenseResponse.json()) as {
      value?: Array<{
        skuPartNumber?: string;
        skuId?: string;
        servicePlans?: Array<{
          servicePlanName?: string;
          provisioningStatus?: string;
        }>;
      }>;
    };

    const licenses = (licensePayload.value || []).map((license) => {
      const skuPartNumber = license.skuPartNumber || "UNKNOWN";
      const skuId = license.skuId || "";
      const enabledServices = (license.servicePlans || [])
        .filter((plan) => plan.provisioningStatus === "Success")
        .map((plan) => {
          const planName = plan.servicePlanName || "UNKNOWN_PLAN";
          const mapped = SERVICE_PLAN_MAP[planName];
          return {
            planName,
            friendlyServiceName: mapped?.friendlyServiceName || planName,
            description: mapped?.description || "Enabled service (technical name shown)."
          };
        });
      return {
        skuPartNumber,
        skuId,
        friendlyName: LICENSE_FRIENDLY_NAMES[skuPartNumber] || skuPartNumber,
        enabledServices
      };
    });

    const payload = {
      displayName: profile.displayName || "",
      userPrincipalName: profile.userPrincipalName || "",
      licenseStatus: licenses.length ? "assigned" : "none",
      licenses
    };
    setCached(userEmail, payload);
    res.json(payload);
  } catch (err) {
    console.error("Graph license fetch error", err);
    res.status(502).json({ message: "Unable to load license details right now." });
  }
});

export default router;
