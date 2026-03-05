import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Forms from "./pages/Forms";
import Guides from "./pages/Guides";
import Policies from "./pages/Policies";
import Settings from "./pages/Settings";
import SettingsPortal from "./pages/SettingsPortal";
import SettingsPages from "./pages/SettingsPages";
import SettingsNavigation from "./pages/SettingsNavigation";
import SettingsBranding from "./pages/SettingsBranding";
import SettingsAuth from "./pages/SettingsAuth";
import SettingsUptime from "./pages/SettingsUptime";
import SettingsDatabase from "./pages/SettingsDatabase";
import SettingsAps from "./pages/SettingsAps";
import HelpdeskSettings from "./pages/HelpdeskSettings";
import AuthCallback from "./pages/AuthCallback";
import Users from "./pages/Users";
import ActionPlan from "./pages/ActionPlan";
import AutodeskImport from "./pages/AutodeskImport";
import Tour from "./pages/Tour";
import Announcements from "./pages/Announcements";
import AuditLogs from "./pages/AuditLogs";
import AccessDenied from "./pages/AccessDenied";
import PageDisabled from "./pages/PageDisabled";
import { canAccessSection, normalizeRole } from "./permissions";
import useAdminSettings from "./hooks/useAdminSettings";
import useAdminAuth from "./hooks/useAdminAuth";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAdminAuth();
  if (loading) {
    return <div className="card">Loading...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  const role = normalizeRole(user.role);
  if (role === "user") {
    return <AccessDenied />;
  }
  return children;
}

function RequireRole({ children, section }: { children: JSX.Element; section: string }) {
  const { user, loading } = useAdminAuth();
  if (loading) {
    return <div className="card">Loading...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  const role = normalizeRole(user.role);
  if (!canAccessSection(role, section)) {
    return <AccessDenied />;
  }
  return children;
}

export default function App() {
  const settings = useAdminSettings();
  const isPageEnabled = (key: string) => settings[key] !== "false";

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route
          index
          element={
            <RequireRole section="overview">
              <Overview />
            </RequireRole>
          }
        />
        <Route
          path="forms"
          element={
            isPageEnabled("page_forms_enabled") ? (
              <RequireRole section="forms">
                <Forms />
              </RequireRole>
            ) : (
              <PageDisabled />
            )
          }
        />
        <Route
          path="policies"
          element={
            isPageEnabled("page_policies_enabled") ? (
              <RequireRole section="policies">
                <Policies />
              </RequireRole>
            ) : (
              <PageDisabled />
            )
          }
        />
        <Route
          path="guides"
          element={
            isPageEnabled("page_guides_enabled") ? (
              <RequireRole section="guides">
                <Guides />
              </RequireRole>
            ) : (
              <PageDisabled />
            )
          }
        />
        <Route
          path="action-plan"
          element={
            isPageEnabled("page_action_plan_enabled") ? (
              <RequireRole section="action_plan">
                <ActionPlan />
              </RequireRole>
            ) : (
              <PageDisabled />
            )
          }
        />
        <Route
          path="helpdesk"
          element={
            <RequireRole section="helpdesk">
              <HelpdeskSettings />
            </RequireRole>
          }
        />
        <Route
          path="announcements"
          element={
            <RequireRole section="announcements">
              <Announcements />
            </RequireRole>
          }
        />
        <Route
          path="users"
          element={
            <RequireRole section="users_read">
              <Users />
            </RequireRole>
          }
        />
        <Route
          path="audit-logs"
          element={
            <RequireRole section="audit_logs">
              <AuditLogs />
            </RequireRole>
          }
        />
        <Route
          path="autodesk"
          element={
            <RequireRole section="autodesk">
              <AutodeskImport />
            </RequireRole>
          }
        />
        <Route
          path="settings"
          element={
            <RequireRole section="settings_portal">
              <Settings />
            </RequireRole>
          }
        />
        <Route
          path="settings/portal"
          element={
            <RequireRole section="settings_portal">
              <SettingsPortal />
            </RequireRole>
          }
        />
        <Route
          path="settings/pages"
          element={
            <RequireRole section="settings_pages">
              <SettingsPages />
            </RequireRole>
          }
        />
        <Route
          path="settings/navigation"
          element={
            <RequireRole section="settings_navigation">
              <SettingsNavigation />
            </RequireRole>
          }
        />
        <Route
          path="settings/branding"
          element={
            <RequireRole section="settings_branding">
              <SettingsBranding />
            </RequireRole>
          }
        />
        <Route
          path="settings/auth"
          element={
            <RequireRole section="settings_auth">
              <SettingsAuth />
            </RequireRole>
          }
        />
        <Route
          path="settings/uptime"
          element={
            <RequireRole section="settings_uptime">
              <SettingsUptime />
            </RequireRole>
          }
        />
        <Route
          path="settings/database"
          element={
            <RequireRole section="settings_database">
              <SettingsDatabase />
            </RequireRole>
          }
        />
        <Route
          path="settings/aps"
          element={
            <RequireRole section="settings_aps">
              <SettingsAps />
            </RequireRole>
          }
        />
        <Route
          path="tour"
          element={
            <RequireRole section="tour">
              <Tour />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
