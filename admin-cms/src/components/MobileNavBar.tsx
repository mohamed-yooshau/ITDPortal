import { NavLink } from "react-router-dom";
import {
  OverviewIcon,
  FormsIcon,
  PoliciesIcon,
  GuidesIcon,
  ActionPlanIcon,
  HelpdeskIcon,
  AnnouncementsIcon,
  AutodeskIcon,
  UsersIcon,
  AuditLogsIcon,
  SettingsIcon,
  TourIcon
} from "./AdminIcons";
import { canAccessSection, normalizeRole } from "../permissions";
import type { AdminSettings } from "../hooks/useAdminSettings";

type MobileNavBarProps = {
  role: string;
  settings: AdminSettings;
};

export default function MobileNavBar({ role, settings }: MobileNavBarProps) {
  const isPageEnabled = (key: string) => settings[key] !== "false";
  const normalizedRole = normalizeRole(role);

  const items = [
    canAccessSection(normalizedRole, "overview") && {
      to: "/",
      label: "Overview",
      icon: <OverviewIcon className="nav-icon" aria-hidden="true" />
    },
    canAccessSection(normalizedRole, "forms") && isPageEnabled("page_forms_enabled") && {
      to: "/forms",
      label: "Forms",
      icon: <FormsIcon className="nav-icon" aria-hidden="true" />
    },
    canAccessSection(normalizedRole, "policies") && isPageEnabled("page_policies_enabled") && {
      to: "/policies",
      label: "Policies",
      icon: <PoliciesIcon className="nav-icon" aria-hidden="true" />
    },
    canAccessSection(normalizedRole, "guides") && isPageEnabled("page_guides_enabled") && {
      to: "/guides",
      label: "Guides",
      icon: <GuidesIcon className="nav-icon" aria-hidden="true" />
    },
    canAccessSection(normalizedRole, "action_plan") && isPageEnabled("page_action_plan_enabled") && {
      to: "/action-plan",
      label: "Action Plan",
      icon: <ActionPlanIcon className="nav-icon" aria-hidden="true" />
    },
    canAccessSection(normalizedRole, "helpdesk") && {
      to: "/helpdesk",
      label: "Helpdesk",
      icon: <HelpdeskIcon className="nav-icon" aria-hidden="true" />
    },
    canAccessSection(normalizedRole, "announcements") && {
      to: "/announcements",
      label: "Announcements",
      icon: <AnnouncementsIcon className="nav-icon" aria-hidden="true" />
    },
    canAccessSection(normalizedRole, "autodesk") && {
      to: "/autodesk",
      label: "Autodesk",
      icon: <AutodeskIcon className="nav-icon" aria-hidden="true" />
    },
    canAccessSection(normalizedRole, "users_read") && {
      to: "/users",
      label: "Users",
      icon: <UsersIcon className="nav-icon" aria-hidden="true" />
    },
    canAccessSection(normalizedRole, "audit_logs") && {
      to: "/audit-logs",
      label: "Audit Logs",
      icon: <AuditLogsIcon className="nav-icon" aria-hidden="true" />
    },
    canAccessSection(normalizedRole, "settings_portal") && {
      to: "/settings/portal",
      label: "Settings",
      icon: <SettingsIcon className="nav-icon" aria-hidden="true" />
    },
    canAccessSection(normalizedRole, "tour") && {
      to: "/tour",
      label: "Tour",
      icon: <TourIcon className="nav-icon" aria-hidden="true" />
    }
  ].filter(Boolean) as Array<{ to: string; label: string; icon: JSX.Element }>;

  if (!items.length) return null;

  return (
    <nav className="mobile-admin-dock" aria-label="Admin primary">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          aria-label={item.label}
          className={({ isActive }) => `mobile-admin-link ${isActive ? "active" : ""}`}
        >
          <span className="mobile-admin-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="mobile-admin-indicator" aria-hidden="true" />
        </NavLink>
      ))}
    </nav>
  );
}
