export type Role = "superadmin" | "admin" | "editor" | "planner" | "user";

export function normalizeRole(role?: string | null): Role {
  if (!role) return "user";
  const normalized = role.toLowerCase().replace(/\s+/g, "").replace("_", "");
  if (normalized === "superadmin") return "superadmin";
  if (normalized === "admin") return "admin";
  if (normalized === "editor") return "editor";
  if (normalized === "planner") return "planner";
  return "user";
}

export function hasAdminAccess(role?: string | null) {
  const normalized = normalizeRole(role);
  return normalized !== "user";
}
