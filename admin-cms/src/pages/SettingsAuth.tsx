import { useEffect, useState } from "react";
import { MdContentCopy, MdVisibility, MdVisibilityOff } from "react-icons/md";
import api from "../api";
import SettingsNav from "../components/SettingsNav";

export default function SettingsAuth() {
  const [form, setForm] = useState({
    localLoginEnabled: true,
    azureClientId: "",
    azureClientSecret: "",
    azureTenantId: "",
    frontendUrl: "",
    adminUrl: "",
    userRedirectUri: "",
    adminRedirectUri: ""
  });
  const [showSecrets, setShowSecrets] = useState({
    azureClientSecret: false
  });
  const [storedSecrets, setStoredSecrets] = useState({
    azureClientSecret: false
  });
  const [bootstrapLocalOnlyActive, setBootstrapLocalOnlyActive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/settings")
      .then((res) => {
        const settings = res.data.settings || {};
        setBootstrapLocalOnlyActive(settings.bootstrap_local_only_active === "true");
        setStoredSecrets({
          azureClientSecret: Boolean(settings.azure_client_secret_present)
        });
        setForm({
          localLoginEnabled: settings.local_login_enabled !== "false",
          azureClientId: settings.azure_client_id || "",
          azureClientSecret: "",
          azureTenantId: settings.azure_tenant_id || "",
          frontendUrl: settings.frontend_url || "",
          adminUrl: settings.admin_url || "",
          userRedirectUri: settings.user_redirect_uri || "",
          adminRedirectUri: settings.admin_redirect_uri || ""
        });
      })
      .catch(() => undefined);
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    await api.put("/settings", form);
    setMessage("Auth settings saved.");
  };

  const copyValue = async (value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  };

  return (
    <section className="card">
      <SettingsNav />
      <div className="panel">
        <h2>Authentication & Azure AD</h2>
        <p className="muted">Manage Microsoft login and redirect URLs.</p>
        {bootstrapLocalOnlyActive && (
          <p className="muted">
            Local bootstrap mode is active. Microsoft login is temporarily disabled until
            `BOOTSTRAP_LOCAL_ONLY=false` is set on the server and the backend is restarted.
          </p>
        )}
        <form className="form" onSubmit={handleSave}>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.localLoginEnabled}
              disabled={bootstrapLocalOnlyActive}
              onChange={(event) => setForm({ ...form, localLoginEnabled: event.target.checked })}
            />
            Enable local login (break-glass)
          </label>
          <label>
            Azure Client ID
            <input
              value={form.azureClientId}
              onChange={(event) => setForm({ ...form, azureClientId: event.target.value })}
            />
          </label>
          <label>
            Azure Tenant ID
            <input
              value={form.azureTenantId}
              onChange={(event) => setForm({ ...form, azureTenantId: event.target.value })}
            />
          </label>
          <label>
            Azure Client Secret
            <div className="input-with-actions">
              <input
                type={showSecrets.azureClientSecret ? "text" : "password"}
                placeholder={storedSecrets.azureClientSecret ? "Stored (leave blank to keep)" : ""}
                value={form.azureClientSecret}
                onChange={(event) => setForm({ ...form, azureClientSecret: event.target.value })}
              />
              <button
                type="button"
                className="btn ghost icon-btn"
                onClick={() =>
                  setShowSecrets((prev) => ({ ...prev, azureClientSecret: !prev.azureClientSecret }))
                }
              >
                {showSecrets.azureClientSecret ? <MdVisibilityOff /> : <MdVisibility />}
              </button>
              <button
                type="button"
                className="btn ghost icon-btn"
                onClick={() => copyValue(form.azureClientSecret)}
              >
                <MdContentCopy />
              </button>
            </div>
          </label>
          <label>
            Frontend URL
            <input
              value={form.frontendUrl}
              onChange={(event) => setForm({ ...form, frontendUrl: event.target.value })}
            />
          </label>
          <label>
            Admin URL
            <input
              value={form.adminUrl}
              onChange={(event) => setForm({ ...form, adminUrl: event.target.value })}
            />
          </label>
          <label>
            User Redirect URI
            <input
              value={form.userRedirectUri}
              onChange={(event) => setForm({ ...form, userRedirectUri: event.target.value })}
            />
          </label>
          <label>
            Admin Redirect URI
            <input
              value={form.adminRedirectUri}
              onChange={(event) => setForm({ ...form, adminRedirectUri: event.target.value })}
            />
          </label>
          <button className="btn primary" type="submit">
            Save Auth Settings
          </button>
          {message && <p className="muted">{message}</p>}
        </form>
      </div>
    </section>
  );
}
