import { NavLink } from "react-router-dom";
import SettingsNav from "../components/SettingsNav";
import useAdminAuth from "../hooks/useAdminAuth";
import { canAccessSection, normalizeRole } from "../permissions";

export default function SettingsHome() {
  const { user } = useAdminAuth();
  const role = normalizeRole(user?.role);

  return (
    <section className="card">
      <SettingsNav />
      <div className="panel">
        <h2>Settings</h2>
        <p className="muted">Choose a settings area to manage the portal configuration.</p>
        <div className="settings-grid">
          {canAccessSection(role, "settings_portal") && (
            <NavLink className="panel settings-card" to="/settings/portal">
              <h3>Portal</h3>
              <p className="muted">Titles, footer text, homepage copy.</p>
            </NavLink>
          )}
          {canAccessSection(role, "settings_pages") && (
            <NavLink className="panel settings-card" to="/settings/pages">
              <h3>Pages</h3>
              <p className="muted">Enable or disable sections of the portal.</p>
            </NavLink>
          )}
          {canAccessSection(role, "settings_navigation") && (
            <NavLink className="panel settings-card" to="/settings/navigation">
              <h3>Navigation</h3>
              <p className="muted">Order desktop navigation links.</p>
            </NavLink>
          )}
          {canAccessSection(role, "settings_branding") && (
            <NavLink className="panel settings-card" to="/settings/branding">
              <h3>Branding</h3>
              <p className="muted">Upload favicon and app icons.</p>
            </NavLink>
          )}
          {canAccessSection(role, "settings_auth") && (
            <NavLink className="panel settings-card" to="/settings/auth">
              <h3>Auth & Azure</h3>
              <p className="muted">Microsoft login configuration and redirects.</p>
            </NavLink>
          )}
          {canAccessSection(role, "settings_uptime") && (
            <NavLink className="panel settings-card" to="/settings/uptime">
              <h3>Uptime Kuma</h3>
              <p className="muted">Status page data source settings.</p>
            </NavLink>
          )}
          {canAccessSection(role, "settings_database") && (
            <NavLink className="panel settings-card" to="/settings/database">
              <h3>Database</h3>
              <p className="muted">Connection + export/import tools.</p>
            </NavLink>
          )}
          {canAccessSection(role, "settings_aps") && (
            <NavLink className="panel settings-card" to="/settings/aps">
              <h3>APS</h3>
              <p className="muted">APS API token.</p>
            </NavLink>
          )}
        </div>
      </div>
    </section>
  );
}
