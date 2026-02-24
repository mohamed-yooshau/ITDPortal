import { useEffect, useState } from "react";
import { MdContentCopy, MdVisibility, MdVisibilityOff } from "react-icons/md";
import api from "../api";
import SettingsNav from "../components/SettingsNav";

export default function SettingsUptime() {
  const [form, setForm] = useState({
    uptimeKumaBaseUrl: "",
    uptimeKumaApiEndpoint: "",
    uptimeKumaApiKey: "",
    uptimeKumaInsecure: false
  });
  const [showSecrets, setShowSecrets] = useState({ uptimeKumaApiKey: false });
  const [storedSecrets, setStoredSecrets] = useState({ uptimeKumaApiKey: false });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/settings")
      .then((res) => {
        const settings = res.data.settings || {};
        setStoredSecrets({ uptimeKumaApiKey: Boolean(settings.uptime_kuma_api_key_present) });
        setForm({
          uptimeKumaBaseUrl: settings.uptime_kuma_base_url || "",
          uptimeKumaApiEndpoint: settings.uptime_kuma_api_endpoint || "",
          uptimeKumaApiKey: "",
          uptimeKumaInsecure: settings.uptime_kuma_insecure === "true"
        });
      })
      .catch(() => undefined);
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    await api.put("/settings", form);
    setMessage("Uptime Kuma settings saved.");
  };

  const copyValue = async (value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  };

  return (
    <section className="card">
      <SettingsNav />
      <div className="panel">
        <h2>Uptime Kuma</h2>
        <p className="muted">Configure the Status page data source.</p>
        <form className="form" onSubmit={handleSave}>
          <label>
            Base URL
            <input
              value={form.uptimeKumaBaseUrl}
              onChange={(event) => setForm({ ...form, uptimeKumaBaseUrl: event.target.value })}
            />
          </label>
          <label>
            API Endpoint (optional)
            <input
              value={form.uptimeKumaApiEndpoint}
              onChange={(event) => setForm({ ...form, uptimeKumaApiEndpoint: event.target.value })}
            />
          </label>
          <label>
            API Key
            <div className="input-with-actions">
              <input
                type={showSecrets.uptimeKumaApiKey ? "text" : "password"}
                placeholder={storedSecrets.uptimeKumaApiKey ? "Stored (leave blank to keep)" : ""}
                value={form.uptimeKumaApiKey}
                onChange={(event) => setForm({ ...form, uptimeKumaApiKey: event.target.value })}
              />
              <button
                type="button"
                className="btn ghost icon-btn"
                onClick={() =>
                  setShowSecrets((prev) => ({ ...prev, uptimeKumaApiKey: !prev.uptimeKumaApiKey }))
                }
              >
                {showSecrets.uptimeKumaApiKey ? <MdVisibilityOff /> : <MdVisibility />}
              </button>
              <button
                type="button"
                className="btn ghost icon-btn"
                onClick={() => copyValue(form.uptimeKumaApiKey)}
              >
                <MdContentCopy />
              </button>
            </div>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.uptimeKumaInsecure}
              onChange={(event) => setForm({ ...form, uptimeKumaInsecure: event.target.checked })}
            />
            Allow insecure HTTPS (self-signed)
          </label>
          <button className="btn primary" type="submit">
            Save Uptime Settings
          </button>
          {message && <p className="muted">{message}</p>}
        </form>
      </div>
    </section>
  );
}
