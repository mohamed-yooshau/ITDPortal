export type Role = "superadmin" | "admin" | "editor" | "planner" | "user";

export const ROLE_PERMISSIONS: Record<
  Role,
  { sections: string[]; actions: string[] }
> = {
  superadmin: {
    sections: ["*"],
    actions: ["*"]
  },
  admin: {
    sections: [
      "overview",
      "forms",
      "policies",
      "guides",
      "action_plan",
      "helpdesk",
      "announcements",
      "autodesk",
      "users_read",
    ],
    actions: [
      "forms_read",
      "forms_write",
      "policies_read",
      "policies_write",
      "guides_read",
      "guides_write",
      "action_plan_read",
      "action_plan_write",
      "helpdesk_read",
      "helpdesk_write",
      "announcements_read",
      "announcements_write",
      "autodesk_read",
      "autodesk_write",
      "users_read",
    ]
  },
  editor: {
    sections: ["guides"],
    actions: ["guides_read", "guides_write"]
  },
  planner: {
    sections: ["action_plan"],
    actions: ["action_plan_read", "action_plan_write"]
  },
  user: {
    sections: [],
    actions: []
  }
};

export function normalizeRole(role?: string | null): Role {
  if (!role) return "user";
  const normalized = role.toLowerCase().replace(/\s+/g, "").replace("_", "");
  if (normalized === "superadmin") return "superadmin";
  if (normalized === "admin") return "admin";
  if (normalized === "editor") return "editor";
  if (normalized === "planner") return "planner";
  return "user";
}

export function canAccessSection(role: Role, section: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (permissions.sections.includes("*")) return true;
  return permissions.sections.includes(section);
}

export function canPerform(role: Role, action: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (permissions.actions.includes("*")) return true;
  return permissions.actions.includes(action);
}
