import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import useAdminAuth from "../hooks/useAdminAuth";
import useAdminSettings from "../hooks/useAdminSettings";
import api from "../api";
import ThemeToggle from "./ThemeToggle";
import MobileNavBar from "./MobileNavBar";
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

export default function Layout() {
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  const settings = useAdminSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const role = normalizeRole(user?.role);

  const isPageEnabled = (key: string) => settings[key] !== "false";

  const handleLogout = async () => {
    await api.post("/auth/logout").catch(() => undefined);
    sessionStorage.setItem("itportal_logout_admin", "1");
    navigate("/login");
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (event.target instanceof Node && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!user?.email) {
      setAvatarUrl(null);
      return;
    }
    api
      .get("/aps/me")
      .then((res) => {
        const rcno = res.data?.rcno;
        if (rcno === undefined || rcno === null || rcno === "") {
          setAvatarUrl(null);
          return;
        }
        return api.get(`/aps/photo/${encodeURIComponent(String(rcno))}`, { responseType: "blob" });
      })
      .then((response) => {
        if (!response || !active) return;
        objectUrl = URL.createObjectURL(response.data as Blob);
        setAvatarUrl(objectUrl);
      })
      .catch(() => setAvatarUrl(null));
    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [user?.email]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>IT Admin</h2>
          <span>Control Center</span>
        </div>
        <nav>
          {canAccessSection(role, "overview") && (
            <NavLink to="/" end>
              <OverviewIcon className="nav-icon" aria-hidden="true" />
              Overview
            </NavLink>
          )}
          {canAccessSection(role, "forms") && isPageEnabled("page_forms_enabled") && (
            <NavLink to="/forms">
              <FormsIcon className="nav-icon" aria-hidden="true" />
              Forms
            </NavLink>
          )}
          {canAccessSection(role, "policies") && isPageEnabled("page_policies_enabled") && (
            <NavLink to="/policies">
              <PoliciesIcon className="nav-icon" aria-hidden="true" />
              Policies
            </NavLink>
          )}
          {canAccessSection(role, "guides") && isPageEnabled("page_guides_enabled") && (
            <NavLink to="/guides">
              <GuidesIcon className="nav-icon" aria-hidden="true" />
              Guides
            </NavLink>
          )}
          {canAccessSection(role, "action_plan") && isPageEnabled("page_action_plan_enabled") && (
            <NavLink to="/action-plan">
              <ActionPlanIcon className="nav-icon" aria-hidden="true" />
              Action Plan 2026
            </NavLink>
          )}
          {canAccessSection(role, "helpdesk") && (
            <NavLink to="/helpdesk">
              <HelpdeskIcon className="nav-icon" aria-hidden="true" />
              Helpdesk
            </NavLink>
          )}
          {canAccessSection(role, "announcements") && (
            <NavLink to="/announcements">
              <AnnouncementsIcon className="nav-icon" aria-hidden="true" />
              Announcements
            </NavLink>
          )}
          {canAccessSection(role, "autodesk") && (
            <NavLink to="/autodesk">
              <AutodeskIcon className="nav-icon" aria-hidden="true" />
              Autodesk Import
            </NavLink>
          )}
          {canAccessSection(role, "users_read") && (
            <NavLink to="/users">
              <UsersIcon className="nav-icon" aria-hidden="true" />
              User Management
            </NavLink>
          )}
          {canAccessSection(role, "audit_logs") && (
            <NavLink to="/audit-logs">
              <AuditLogsIcon className="nav-icon" aria-hidden="true" />
              Audit Logs
            </NavLink>
          )}
          {canAccessSection(role, "settings_portal") && (
            <NavLink to="/settings/portal">
              <SettingsIcon className="nav-icon" aria-hidden="true" />
              Settings
            </NavLink>
          )}
          {canAccessSection(role, "tour") && (
            <NavLink to="/tour">
              <TourIcon className="nav-icon" aria-hidden="true" />
              Tour
            </NavLink>
          )}
        </nav>
      </aside>
      <main className="content">
        <div className="topbar">
          <div>
            <h1>Admin Console</h1>
            <p>Manage the portal and its content.</p>
          </div>
          <div className="topbar-actions">
            <a className="back-portal" href="/">Back to Portal</a>
            <ThemeToggle />
            <div className="user-menu" ref={menuRef}>
              <button className="user-chip" onClick={() => setMenuOpen((current) => !current)}>
                <span className="user-chip-avatar" aria-hidden="true">
                  {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{(user?.name || "A").slice(0, 1)}</span>}
                </span>
                <span className="user-chip-text">
                  <span>{user?.name || "Admin"}</span>
                  <small className="user-role">{user?.role || "admin"}</small>
                </span>
              </button>
              {menuOpen && (
                <div className="user-dropdown">
                  <span className="user-name">{user?.name || "Admin"}</span>
                  <span className="user-role">{user?.role || "admin"}</span>
                  <button className="menu-link" onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <Outlet />
      </main>
      <MobileNavBar role={role} settings={settings} />
    </div>
  );
}
