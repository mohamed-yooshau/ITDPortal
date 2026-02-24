import { hasAdminAccess } from "../permissions";
import type { PortalSettings } from "../hooks/useSettings";

export type NavItem = {
  id: string;
  label: string;
  to: string;
  adminOnly?: boolean;
};

export const baseNavItems: NavItem[] = [
  { id: "home", label: "Home", to: "/", adminOnly: false },
  { id: "search", label: "Search", to: "/search", adminOnly: false },
  { id: "guides", label: "Guides", to: "/guides", adminOnly: false },
  { id: "about", label: "About", to: "/about", adminOnly: false },
  { id: "policies", label: "Policies", to: "/policies", adminOnly: false },
  { id: "profile", label: "Profile", to: "/profile", adminOnly: false },
  { id: "services", label: "Services", to: "/services", adminOnly: false },
  { id: "status", label: "Status", to: "/status", adminOnly: false }
];

export const navEnabledMap: Record<string, keyof PortalSettings> = {
  guides: "page_guides_enabled",
  about: "page_about_enabled",
  policies: "page_policies_enabled",
  profile: "page_profile_enabled",
  services: "page_services_enabled",
  status: "page_status_enabled"
};

export const navDefaultOrder = [
  "home",
  "search",
  "guides",
  "about",
  "policies",
  "profile",
  "services",
  "status"
];

export function buildNavItems(settings: PortalSettings, userRole?: string | null): NavItem[] {
  let order: string[] = [];
  if (settings.nav_order_desktop) {
    try {
      const parsed = JSON.parse(settings.nav_order_desktop);
      if (Array.isArray(parsed)) {
        order = parsed.filter((entry) => typeof entry === "string");
      }
    } catch {
      order = [];
    }
  }
  const ordered = [
    ...order
      .map((id) => baseNavItems.find((item) => item.id === id))
      .filter((item): item is NavItem => !!item),
    ...baseNavItems.filter((item) => !order.includes(item.id))
  ];
  return ordered.filter((item) => {
    if (item.adminOnly && (!userRole || !hasAdminAccess(userRole))) return false;
    const key = navEnabledMap[item.id];
    return key ? settings[key] !== "false" : true;
  });
}
