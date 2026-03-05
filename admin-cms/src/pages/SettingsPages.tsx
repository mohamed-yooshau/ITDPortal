import { useEffect, useState } from "react";
import api from "../api";
import SettingsNav from "../components/SettingsNav";

export default function SettingsPages() {
  const [form, setForm] = useState({
    pageGuidesEnabled: true,
    pageActionPlanEnabled: true,
    pageAnnouncementsEnabled: true,
    pageTicketsEnabled: true,
    pageFormsEnabled: true,
    pagePoliciesEnabled: true,
    pageProfileEnabled: true,
    pageServicesEnabled: true,
    pageStatusEnabled: true,
    pageAboutEnabled: true,
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/settings")
      .then((res) => {
        const settings = res.data.settings || {};
        setForm({
          pageGuidesEnabled: settings.page_guides_enabled !== "false",
          pageActionPlanEnabled: settings.page_action_plan_enabled !== "false",
          pageAnnouncementsEnabled: settings.page_announcements_enabled !== "false",
          pageTicketsEnabled: settings.page_tickets_enabled !== "false",
          pageFormsEnabled: settings.page_forms_enabled !== "false",
          pagePoliciesEnabled: settings.page_policies_enabled !== "false",
          pageProfileEnabled: settings.page_profile_enabled !== "false",
          pageServicesEnabled: settings.page_services_enabled !== "false",
          pageStatusEnabled: settings.page_status_enabled !== "false",
          pageAboutEnabled: settings.page_about_enabled !== "false",
        });
      })
      .catch(() => undefined);
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    await api.put("/settings", form);
    setMessage("Page visibility updated.");
  };

  return (
    <section className="card">
      <SettingsNav />
      <div className="panel">
        <h2>Page Visibility</h2>
        <p className="muted">Enable or disable portal sections.</p>
        <form className="form" onSubmit={handleSave}>
          {Object.entries(form).map(([key, value]) => (
            <label key={key} className="checkbox-row">
              <input
                type="checkbox"
                checked={value}
                onChange={(event) => setForm({ ...form, [key]: event.target.checked })}
              />
              {key
                .replace("page", "")
                .replace("Enabled", "")
                .replace(/([A-Z])/g, " $1")
                .trim()}
            </label>
          ))}
          <button className="btn primary" type="submit">
            Save Visibility
          </button>
          {message && <p className="muted">{message}</p>}
        </form>
      </div>
    </section>
  );
}
