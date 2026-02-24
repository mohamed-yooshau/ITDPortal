import { NavLink } from "react-router-dom";
import { canAccessSection, normalizeRole } from "../permissions";
import useAdminAuth from "../hooks/useAdminAuth";

const links = [
  { key: "settings_portal", to: "/settings/portal", label: "Portal" },
  { key: "settings_pages", to: "/settings/pages", label: "Pages" },
  { key: "settings_navigation", to: "/settings/navigation", label: "Navigation" },
  { key: "settings_branding", to: "/settings/branding", label: "Branding" },
  { key: "settings_auth", to: "/settings/auth", label: "Auth & Azure" },
  { key: "settings_uptime", to: "/settings/uptime", label: "Uptime Kuma" },
  { key: "settings_database", to: "/settings/database", label: "Database" },
  { key: "settings_aps", to: "/settings/aps", label: "APS" }
];

export default function SettingsNav() {
  const { user } = useAdminAuth();
  const role = normalizeRole(user?.role);

  return (
    <div className="settings-nav">
      {links
        .filter((item) => canAccessSection(role, item.key))
        .map((item) => (
          <NavLink key={item.key} to={item.to} className="settings-link">
            {item.label}
          </NavLink>
        ))}
    </div>
  );
}
