import { useEffect, useState } from "react";
import { MdContentCopy, MdVisibility, MdVisibilityOff } from "react-icons/md";
import api from "../api";

type HelpdeskSite = {
  code: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
};

export default function HelpdeskSettings() {
  const [sites, setSites] = useState<HelpdeskSite[]>([]);
  const [newSite, setNewSite] = useState({ code: "", label: "", enabled: true });
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [apiKeyHeaderName, setApiKeyHeaderName] = useState("");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [source, setSource] = useState("Portal");
  const [enableAssets, setEnableAssets] = useState(false);
  const [urgencyOptions, setUrgencyOptions] = useState("");
  const [defaultSiteCode, setDefaultSiteCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [hasStoredSecret, setHasStoredSecret] = useState(false);

  useEffect(() => {
    api
      .get("/admin/helpdesk/settings")
      .then((res) => {
        const settings = res.data.settings || {};
        setApiBaseUrl(settings.apiBaseUrl || "");
        setApiKeyHeaderName(settings.apiKeyHeaderName || "");
        setHasStoredSecret(Boolean(settings.apiKeyValuePresent));
        setApiKeyValue("");
        setSource(settings.source || "Portal");
        setEnableAssets(!!settings.enableAssets);
        setUrgencyOptions(Array.isArray(settings.urgencyOptions) ? settings.urgencyOptions.join("\n") : "");
        setDefaultSiteCode(settings.defaultSiteCode || "");
        setSites(
          Array.isArray(settings.sites)
            ? settings.sites.map((site: HelpdeskSite, index: number) => ({
                code: site.code || "",
                label: site.label || "",
                enabled: site.enabled !== false,
                sortOrder: site.sortOrder || index + 1
              }))
            : []
        );
      })
      .catch(() => {
        setMessage(null);
        setError("Unable to load helpdesk settings.");
        setHasStoredSecret(false);
      });
  }, []);

  const copySecret = async () => {
    if (!apiKeyValue) return;
    try {
      await navigator.clipboard.writeText(apiKeyValue);
      setMessage("Copied to clipboard.");
    } catch {
      setMessage("Copy failed.");
    }
  };

  const handleAddSite = () => {
    setError(null);
    const code = newSite.code.trim();
    const label = newSite.label.trim();
    if (!code || !label) {
      setError("Site code and label are required.");
      return;
    }
    if (sites.some((site) => site.code.toLowerCase() === code.toLowerCase())) {
      setError("Site code must be unique.");
      return;
    }
    const updated = [
      ...sites,
      { code, label, enabled: newSite.enabled, sortOrder: sites.length + 1 }
    ];
    setSites(updated);
    setNewSite({ code: "", label: "", enabled: true });
  };

  const handleRemoveSite = (index: number) => {
    const updated = sites.filter((_, idx) => idx !== index).map((site, idx) => ({
      ...site,
      sortOrder: idx + 1
    }));
    setSites(updated);
  };

  const moveSite = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= sites.length) return;
    const updated = [...sites];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setSites(updated.map((site, idx) => ({ ...site, sortOrder: idx + 1 })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      await api.put("/admin/helpdesk/settings", {
        apiBaseUrl,
        apiKeyHeaderName,
        apiKeyValue: apiKeyValue.trim() ? apiKeyValue : undefined,
        source,
        enableAssets,
        defaultSiteCode,
        urgencyOptions: urgencyOptions
          .split(/\r?\n/)
          .map((opt) => opt.trim())
          .filter(Boolean),
        sites: sites.map((site, index) => ({ ...site, sortOrder: index + 1 }))
      });
      setMessage("Helpdesk settings saved.");
      if (apiKeyValue.trim()) {
        setHasStoredSecret(true);
        setApiKeyValue("");
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || "Unable to save settings.");
    }
  };

  return (
    <section className="card">
      <h1>Helpdesk Ticket API</h1>
      <p className="note">Configure ticket creation and site list for the portal form.</p>
      <form className="form" onSubmit={handleSubmit}>
        <h3>API Configuration</h3>
        <input
          placeholder="API Base URL"
          value={apiBaseUrl}
          onChange={(e) => setApiBaseUrl(e.target.value)}
        />
        <input
          placeholder="API Key Header Name"
          value={apiKeyHeaderName}
          onChange={(e) => setApiKeyHeaderName(e.target.value)}
        />
        <div className="input-with-actions">
          <input
            type={showSecret ? "text" : "password"}
            placeholder={hasStoredSecret ? "Stored (hidden)" : "API Key Value"}
            value={apiKeyValue}
            onChange={(e) => setApiKeyValue(e.target.value)}
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowSecret((prev) => !prev)}
            aria-label="Toggle API key visibility"
          >
            {showSecret ? <MdVisibilityOff /> : <MdVisibility />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={copySecret}
            disabled={!apiKeyValue}
            aria-label="Copy API key"
          >
            <MdContentCopy />
          </button>
        </div>
        <input
          placeholder="Default Source (e.g. Portal)"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={enableAssets}
            onChange={(e) => setEnableAssets(e.target.checked)}
          />
          Enable Assets selector
        </label>
        <select
          value={defaultSiteCode}
          onChange={(e) => setDefaultSiteCode(e.target.value)}
        >
          <option value="">Default Site (select)</option>
          {sites
            .filter((site) => site.enabled)
            .map((site) => (
              <option key={site.code} value={site.code}>
                {site.code} ({site.label})
              </option>
            ))}
        </select>
        <textarea
          placeholder="Urgency options (one per line)"
          value={urgencyOptions}
          onChange={(e) => setUrgencyOptions(e.target.value)}
        />
        <h3>Sites</h3>
        <div className="site-manager">
          <div className="site-add">
            <input
              placeholder="Code"
              value={newSite.code}
              onChange={(e) => setNewSite({ ...newSite, code: e.target.value })}
            />
            <input
              placeholder="Label"
              value={newSite.label}
              onChange={(e) => setNewSite({ ...newSite, label: e.target.value })}
            />
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={newSite.enabled}
                onChange={(e) => setNewSite({ ...newSite, enabled: e.target.checked })}
              />
              Enabled
            </label>
            <button type="button" className="btn ghost" onClick={handleAddSite}>
              Add Site
            </button>
          </div>
          {sites.map((site, index) => (
            <div key={`${site.code}-${index}`} className="list-item site-row">
              <div className="site-fields">
                <input
                  value={site.code}
                  onChange={(e) => {
                    const updated = [...sites];
                    updated[index] = { ...updated[index], code: e.target.value };
                    setSites(updated);
                  }}
                />
                <input
                  value={site.label}
                  onChange={(e) => {
                    const updated = [...sites];
                    updated[index] = { ...updated[index], label: e.target.value };
                    setSites(updated);
                  }}
                />
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={site.enabled}
                    onChange={(e) => {
                      const updated = [...sites];
                      updated[index] = { ...updated[index], enabled: e.target.checked };
                      setSites(updated);
                    }}
                  />
                  Enabled
                </label>
              </div>
              <div className="site-actions">
                <button type="button" className="btn ghost" onClick={() => moveSite(index, "up")}>
                  Up
                </button>
                <button type="button" className="btn ghost" onClick={() => moveSite(index, "down")}>
                  Down
                </button>
                <button type="button" className="btn ghost" onClick={() => handleRemoveSite(index)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        <button className="btn" type="submit">Save</button>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </form>
    </section>
  );
}
