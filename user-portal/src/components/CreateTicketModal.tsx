import { useEffect, useMemo, useState } from "react";
import api from "../api";

type HelpdeskSite = {
  code: string;
  label: string;
};

type HelpdeskConfig = {
  sites: HelpdeskSite[];
  urgencyOptions: string[];
  enableAssets: boolean;
  defaultSiteCode?: string;
};

interface CreateTicketModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateTicketModal({ open, onClose }: CreateTicketModalProps) {
  const [config, setConfig] = useState<HelpdeskConfig>({ sites: [], urgencyOptions: [], enableAssets: false });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("");
  const [assets, setAssets] = useState<string[]>([]);
  const [assetInput, setAssetInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticketUrl, setTicketUrl] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    api
      .get("/helpdesk/config")
      .then((res) => {
        const payload = res.data || {};
        setConfig({
          sites: Array.isArray(payload.sites) ? payload.sites : [],
          urgencyOptions: Array.isArray(payload.urgencyOptions) ? payload.urgencyOptions : [],
          enableAssets: !!payload.enableAssets,
          defaultSiteCode: payload.defaultSiteCode || ""
        });
      })
      .catch(() =>
        setConfig({ sites: [], urgencyOptions: ["Low", "Medium", "High"], enableAssets: false })
      );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    setError(null);
    setTicketUrl(null);
    setTicketNumber(null);
    setShowSuccess(false);
  }, [open]);

  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(() => {
      onClose();
    }, 2200);
    return () => clearTimeout(timer);
  }, [showSuccess, onClose]);

  const canSubmit = title.trim() && description.trim();

  const urgencyOptions = useMemo(
    () => (config.urgencyOptions.length ? config.urgencyOptions : ["Low", "Medium", "High"]),
    [config.urgencyOptions]
  );

  const addAsset = (value: string) => {
    const cleaned = value.trim();
    if (!cleaned) return;
    if (assets.some((asset) => asset.toLowerCase() === cleaned.toLowerCase())) return;
    setAssets([...assets, cleaned]);
  };

  const handleAssetKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addAsset(assetInput);
      setAssetInput("");
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    setTicketUrl(null);
    try {
      const response = await api.post("/helpdesk/ticket/create", {
        title: title.trim(),
        body: description.trim(),
        urgency: urgency || undefined,
        assets: assets.length ? assets : undefined
      });
      const data = response.data || {};
      setTicketNumber(typeof data.ticketNumber === "number" ? data.ticketNumber : null);
      setTicketUrl(data.url || data.ticketUrl || data.link || null);
      setMessage("Ticket has been raised.");
      setShowSuccess(true);
    } catch (err: any) {
      const apiError = err?.response?.data;
      const detail = apiError?.detail ? ` ${apiError.detail}` : "";
      setError((apiError?.error || "Unable to create ticket.") + detail);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="ticket-backdrop" role="dialog" aria-modal="true">
      <div className="ticket-modal">
        <div className="ticket-header">
          <h2>Create Ticket</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            x
          </button>
        </div>
        <div className="ticket-form">
          {showSuccess ? (
            <div className="ticket-success">
              <div className="ticket-success-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img" focusable="false">
                  <path
                    fill="currentColor"
                    d="M9.55 17.2 4.8 12.45l1.4-1.4 3.35 3.35 8.25-8.25 1.4 1.4-9.65 9.65Z"
                  />
                </svg>
              </div>
              <p className="success">{message}</p>
              <div className="ticket-success-detail">
                {ticketNumber && <strong>Ticket #{ticketNumber}</strong>}
                {title.trim() && <span>{title.trim()}</span>}
                {ticketUrl && (
                  <a className="btn ghost" href={ticketUrl} target="_blank" rel="noreferrer">
                    Open Ticket
                  </a>
                )}
              </div>
            </div>
          ) : (
            <>
          <div className="ticket-field">
            <label>Title</label>
            <input
              placeholder="Ticket title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="ticket-field">
            <label>Description</label>
            <textarea
              className="ticket-textarea"
              placeholder="Ticket description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="ticket-field">
            <label>Urgency</label>
            <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
              <option value="">Select urgency</option>
              {urgencyOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          {config.enableAssets && (
            <div className="ticket-field">
              <label>Assets</label>
              <input
                placeholder="Select assets"
                value={assetInput}
                onChange={(e) => setAssetInput(e.target.value)}
                onKeyDown={handleAssetKey}
              />
              {assets.length > 0 && (
                <div className="asset-chips">
                  {assets.map((asset) => (
                    <button
                      key={asset}
                      type="button"
                      className="asset-chip"
                      onClick={() => setAssets(assets.filter((item) => item !== asset))}
                    >
                      {asset} <span aria-hidden="true">x</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {message && <p className="success">{message}</p>}
          {ticketNumber && <p className="note">Ticket #{ticketNumber}</p>}
          {error && <p className="error">{error}</p>}
          <div className="ticket-actions">
            <button className="btn ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            {ticketUrl && (
              <a className="btn ghost" href={ticketUrl} target="_blank" rel="noreferrer">
                Open Ticket
              </a>
            )}
            <button className="btn" type="button" disabled={!canSubmit || loading} onClick={handleSubmit}>
              {loading ? "Creating..." : "Create Ticket"}
            </button>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
