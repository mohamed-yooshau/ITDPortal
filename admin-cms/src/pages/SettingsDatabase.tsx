import { useEffect, useState } from "react";
import { MdContentCopy, MdVisibility, MdVisibilityOff } from "react-icons/md";
import api from "../api";
import SettingsNav from "../components/SettingsNav";

export default function SettingsDatabase() {
  const [form, setForm] = useState({
    dbUser: "",
    dbPassword: "",
    dbName: "",
    dbHost: "",
    dbPort: ""
  });
  const [showSecrets, setShowSecrets] = useState({ dbPassword: false });
  const [storedSecrets, setStoredSecrets] = useState({ dbPassword: false });
  const [dbConnectionManagedExternally, setDbConnectionManagedExternally] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dbFile, setDbFile] = useState<File | null>(null);
  const [dbBusy, setDbBusy] = useState(false);
  const [dbMessage, setDbMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/settings")
      .then((res) => {
        const settings = res.data.settings || {};
        setDbConnectionManagedExternally(settings.db_connection_managed_externally === "true");
        setStoredSecrets({ dbPassword: Boolean(settings.db_password_present) });
        setForm({
          dbUser: settings.db_user || "",
          dbPassword: "",
          dbName: settings.db_name || "",
          dbHost: settings.db_host || "",
          dbPort: settings.db_port || ""
        });
      })
      .catch(() => undefined);
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (dbConnectionManagedExternally) {
      setMessage("Database connection is managed on the server (.env / secret manager).");
      return;
    }
    await api.put("/settings", form);
    setMessage("Database settings saved.");
  };

  const copyValue = async (value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  };

  const handleExport = async () => {
    setDbBusy(true);
    setDbMessage(null);
    try {
      const res = await api.get("/admin/db/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "itd-portal-export.json";
      link.click();
      URL.revokeObjectURL(url);
      setDbMessage("Export complete.");
    } catch {
      setDbMessage("Export failed.");
    } finally {
      setDbBusy(false);
    }
  };

  const handleImport = async () => {
    if (!dbFile) {
      setDbMessage("Select a file first.");
      return;
    }
    if (!window.confirm("This will overwrite existing data. Continue?")) return;
    setDbBusy(true);
    setDbMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", dbFile);
      await api.post("/admin/db/import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setDbMessage("Import complete.");
      setDbFile(null);
    } catch {
      setDbMessage("Import failed.");
    } finally {
      setDbBusy(false);
    }
  };

  return (
    <section className="card">
      <SettingsNav />
      <div className="panel">
        <h2>Database</h2>
        <p className="muted">Manage database connection and export/import.</p>
        {dbConnectionManagedExternally && (
          <p className="muted">
            Database runtime connection settings are managed outside the admin panel for safety.
            Use the server `.env` (or your secret manager) and redeploy.
          </p>
        )}
        <form className="form" onSubmit={handleSave}>
          <label>
            DB User
            <input
              value={form.dbUser}
              disabled={dbConnectionManagedExternally}
              onChange={(event) => setForm({ ...form, dbUser: event.target.value })}
            />
          </label>
          <label>
            DB Password
            <div className="input-with-actions">
              <input
                type={showSecrets.dbPassword ? "text" : "password"}
                placeholder={storedSecrets.dbPassword ? "Stored (leave blank to keep)" : ""}
                value={form.dbPassword}
                disabled={dbConnectionManagedExternally}
                onChange={(event) => setForm({ ...form, dbPassword: event.target.value })}
              />
              <button
                type="button"
                className="btn ghost icon-btn"
                disabled={dbConnectionManagedExternally}
                onClick={() => setShowSecrets((prev) => ({ ...prev, dbPassword: !prev.dbPassword }))}
              >
                {showSecrets.dbPassword ? <MdVisibilityOff /> : <MdVisibility />}
              </button>
              <button
                type="button"
                className="btn ghost icon-btn"
                disabled={dbConnectionManagedExternally}
                onClick={() => copyValue(form.dbPassword)}
              >
                <MdContentCopy />
              </button>
            </div>
          </label>
          <label>
            DB Name
            <input
              value={form.dbName}
              disabled={dbConnectionManagedExternally}
              onChange={(event) => setForm({ ...form, dbName: event.target.value })}
            />
          </label>
          <label>
            DB Host
            <input
              value={form.dbHost}
              disabled={dbConnectionManagedExternally}
              onChange={(event) => setForm({ ...form, dbHost: event.target.value })}
            />
          </label>
          <label>
            DB Port
            <input
              value={form.dbPort}
              disabled={dbConnectionManagedExternally}
              onChange={(event) => setForm({ ...form, dbPort: event.target.value })}
            />
          </label>
          <button className="btn primary" type="submit" disabled={dbConnectionManagedExternally}>
            Save Database Settings
          </button>
          {message && <p className="muted">{message}</p>}
        </form>
      </div>
      <div className="panel">
        <h3>Database Export / Import</h3>
        <p className="muted">Use with caution. Import will overwrite data.</p>
        <div className="form">
          <button className="btn ghost" type="button" onClick={handleExport} disabled={dbBusy}>
            Download Database
          </button>
          <input
            type="file"
            onChange={(event) => setDbFile(event.target.files?.[0] || null)}
          />
          <button className="btn primary" type="button" onClick={handleImport} disabled={dbBusy}>
            Upload & Restore Database
          </button>
          {dbMessage && <p className="muted">{dbMessage}</p>}
        </div>
      </div>
    </section>
  );
}
