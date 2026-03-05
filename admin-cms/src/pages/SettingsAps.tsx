import { useEffect, useState } from "react";
import { MdContentCopy, MdVisibility, MdVisibilityOff } from "react-icons/md";
import api from "../api";
import SettingsNav from "../components/SettingsNav";

export default function SettingsAps() {
  const [apsApiToken, setApsApiToken] = useState("");
  const [storedSecret, setStoredSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/settings")
      .then((res) => {
        const settings = res.data.settings || {};
        setStoredSecret(Boolean(settings.aps_api_token_present));
        setApsApiToken("");
      })
      .catch(() => undefined);
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    await api.put("/settings", { apsApiToken });
    setMessage("APS token saved.");
    setApsApiToken("");
  };

  const copyValue = async () => {
    if (!apsApiToken) return;
    await navigator.clipboard.writeText(apsApiToken);
  };

  return (
    <section className="card">
      <SettingsNav />
      <div className="panel">
        <h2>APS Integration</h2>
        <p className="muted">Configure APS API token used for profile and team data.</p>
        <form className="form" onSubmit={handleSave}>
          <label>
            APS API Token
            <div className="input-with-actions">
              <input
                type={showSecret ? "text" : "password"}
                placeholder={storedSecret ? "Stored (leave blank to keep)" : ""}
                value={apsApiToken}
                onChange={(event) => setApsApiToken(event.target.value)}
              />
              <button
                type="button"
                className="btn ghost icon-btn"
                onClick={() => setShowSecret((prev) => !prev)}
              >
                {showSecret ? <MdVisibilityOff /> : <MdVisibility />}
              </button>
              <button type="button" className="btn ghost icon-btn" onClick={copyValue}>
                <MdContentCopy />
              </button>
            </div>
          </label>
          <button className="btn primary" type="submit">
            Save APS Token
          </button>
          {message && <p className="muted">{message}</p>}
        </form>
      </div>
    </section>
  );
}
