import { useEffect, useState } from "react";
import api from "../api";
import SettingsNav from "../components/SettingsNav";

export default function SettingsPortal() {
  const [form, setForm] = useState({
    portalTitle: "",
    footerText: "",
    homeStartTitle: "",
    homeStartItems: "",
    homeOperationalTitle: "",
    homeOperationalBody: ""
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/settings/public")
      .then((res) => {
        const settings = res.data.settings || {};
        setForm({
          portalTitle: settings.portal_title || "",
          footerText: settings.footer_text || "",
          homeStartTitle: settings.home_start_title || "",
          homeStartItems: settings.home_start_items || "",
          homeOperationalTitle: settings.home_operational_title || "",
          homeOperationalBody: settings.home_operational_body || ""
        });
      })
      .catch(() => undefined);
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    await api.put("/settings", {
      portalTitle: form.portalTitle,
      footerText: form.footerText,
      homeStartTitle: form.homeStartTitle,
      homeStartItems: form.homeStartItems,
      homeOperationalTitle: form.homeOperationalTitle,
      homeOperationalBody: form.homeOperationalBody
    });
    setMessage("Portal settings saved.");
  };

  return (
    <section className="card">
      <SettingsNav />
      <div className="panel">
        <h2>Portal Content</h2>
        <p className="muted">Update public-facing labels and homepage copy.</p>
        <form className="form" onSubmit={handleSave}>
          <label>
            Portal Title
            <input
              value={form.portalTitle}
              onChange={(event) => setForm({ ...form, portalTitle: event.target.value })}
            />
          </label>
          <label>
            Footer Text
            <textarea
              rows={3}
              value={form.footerText}
              onChange={(event) => setForm({ ...form, footerText: event.target.value })}
            />
          </label>
          <div className="form-grid">
            <label>
              Start Here Title
              <input
                value={form.homeStartTitle}
                onChange={(event) => setForm({ ...form, homeStartTitle: event.target.value })}
              />
            </label>
            <label>
              Start Here Items (one per line)
              <textarea
                rows={4}
                value={form.homeStartItems}
                onChange={(event) => setForm({ ...form, homeStartItems: event.target.value })}
              />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Operational Hours Title
              <input
                value={form.homeOperationalTitle}
                onChange={(event) => setForm({ ...form, homeOperationalTitle: event.target.value })}
              />
            </label>
            <label>
              Operational Hours Body
              <textarea
                rows={4}
                value={form.homeOperationalBody}
                onChange={(event) => setForm({ ...form, homeOperationalBody: event.target.value })}
              />
            </label>
          </div>
          <button className="btn primary" type="submit">
            Save Portal Settings
          </button>
          {message && <p className="muted">{message}</p>}
        </form>
      </div>
    </section>
  );
}
