export type AutodeskHeaderMap = {
  email?: string;
  product?: string;
  team?: string;
  status?: string;
  lastUsed?: string;
};

const HEADER_SYNONYMS: Record<keyof AutodeskHeaderMap, string[]> = {
  email: ["user email", "email", "user"],
  product: ["product name", "product", "application", "offering name", "offering", "app"],
  team: ["team name", "team", "group"],
  status: ["assignment", "access", "status"],
  lastUsed: ["last used date", "last used", "last login", "last activity"]
};

const FRIENDLY_PRODUCT_MAP: Record<string, string> = {
  autocad: "AutoCAD",
  revit: "Revit",
  civil3d: "Civil 3D",
  navisworksmanage: "Navisworks Manage",
  "3dsmax": "3ds Max"
};

export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapHeaders(headers: string[]): AutodeskHeaderMap {
  const map: AutodeskHeaderMap = {};
  const normalized = headers.map((header) => ({
    raw: header,
    norm: normalizeHeader(header)
  }));

  (Object.keys(HEADER_SYNONYMS) as Array<keyof AutodeskHeaderMap>).forEach((key) => {
    if (map[key]) return;
    const synonyms = HEADER_SYNONYMS[key].map((s) => normalizeHeader(s));
    for (const synonym of synonyms) {
      const exact = normalized.find((candidate) => candidate.norm === synonym);
      if (exact) {
        map[key] = exact.raw;
        return;
      }
    }
    for (const candidate of normalized) {
      if (map[key]) continue;
      if (synonyms.some((syn) => candidate.norm.includes(syn))) {
        map[key] = candidate.raw;
      }
    }
  });

  return map;
}

export function detectSourceType(headers: string[]): "seat_usage" | "usage_report" | "unknown" {
  const joined = headers.map((h) => normalizeHeader(h)).join(" ");
  if (joined.includes("last used") || joined.includes("last login") || joined.includes("last activity")) {
    return "usage_report";
  }
  if (joined.includes("assignment") || joined.includes("access")) {
    return "seat_usage";
  }
  return "unknown";
}

export function slugifyProduct(value: string): string {
  return normalizeHeader(value).replace(/\s+/g, "");
}

export function friendlyProductName(raw: string): string {
  const key = slugifyProduct(raw);
  return FRIENDLY_PRODUCT_MAP[key] || raw.trim();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeStatus(raw?: string | null): string | null {
  if (!raw) return null;
  return raw.toString().trim();
}

export function isEntitledStatus(status?: string | null): boolean {
  if (!status) return true;
  const normalized = status.toLowerCase();
  if (["assigned", "active", "enabled"].some((flag) => normalized.includes(flag))) {
    return true;
  }
  if (["removed", "revoked", "expired", "inactive", "unassigned"].some((flag) => normalized.includes(flag))) {
    return false;
  }
  return true;
}
