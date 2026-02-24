import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { canAccessSection, normalizeRole } from "../permissions";
import useAdminAuth from "../hooks/useAdminAuth";

type SourceType = "manual" | "uptime_kuma";
type StatusType = "active" | "scheduled" | "expired" | "resolved";
type Severity = "info" | "warning" | "critical";

interface Announcement {
  id: string;
  source: SourceType;
  kind?: "information" | "announcement" | "system_maintenance";
  title: string;
  message: string;
  severity: Severity;
  pinned: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  service_name?: string | null;
  computed_status?: StatusType;
  status?: StatusType;
}

const MANUAL_TABS: StatusType[] = ["active", "scheduled", "expired"];
const SYSTEM_TABS: StatusType[] = ["active", "resolved"];

export default function Announcements() {
  const { user } = useAdminAuth();
  const role = normalizeRole(user?.role);
  const canEdit = canAccessSection(role, "announcements");
  const [source, setSource] = useState<SourceType>("manual");
  const [status, setStatus] = useState<StatusType>("active");
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    id: "",
    title: "",
    message: "",
    severity: "info" as Severity,
    kind: "announcement" as "information" | "announcement" | "system_maintenance",
    pinned: false,
    starts_at: "",
    ends_at: ""
  });

  const statusTabs = useMemo(() => (source === "manual" ? MANUAL_TABS : SYSTEM_TABS), [source]);

  const load = () => {
    setLoading(true);
    setError("");
    api
      .get(`/admin/announcements?source=${source}&status=${status}`)
      .then((res) => {
        setItems(Array.isArray(res.data?.announcements) ? res.data.announcements : []);
      })
      .catch(() => setError("Unable to load announcements."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [source, status]);

  useEffect(() => {
    if (source === "manual") return;
    const sourceStream = new EventSource("/api/announcements/stream");
    sourceStream.addEventListener("announcements:update", () => load());
    sourceStream.onerror = () => sourceStream.close();
    return () => sourceStream.close();
  }, [source, status]);

  const resetForm = () => {
    setForm({
      id: "",
      title: "",
      message: "",
      severity: "info",
      kind: "announcement",
      pinned: false,
      starts_at: "",
      ends_at: ""
    });
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      setError("Title and message are required.");
      return;
    }
    const payload = {
      title: form.title.trim(),
      message: form.message.trim(),
      severity: form.severity,
      kind: form.kind,
      pinned: form.pinned,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : undefined,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : undefined
    };
    try {
      if (form.id) {
        await api.put(`/admin/announcements/${form.id}`, payload);
      } else {
        await api.post("/admin/announcements", payload);
      }
      resetForm();
      load();
    } catch {
      setError("Unable to save announcement.");
    }
  };

  const handleEdit = (item: Announcement) => {
    if (item.source !== "manual") return;
    setForm({
      id: item.id,
      title: item.title,
      message: item.message,
      severity: item.severity,
      kind: item.kind || "announcement",
      pinned: Boolean(item.pinned),
      starts_at: item.starts_at ? item.starts_at.slice(0, 16) : "",
      ends_at: item.ends_at ? item.ends_at.slice(0, 16) : ""
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this announcement?")) return;
    try {
      await api.delete(`/admin/announcements/${id}`);
      load();
    } catch {
      setError("Unable to delete announcement.");
    }
  };

  return (
    <section className="card">
      <div className="section-header">
        <h2>Announcements</h2>
        <p>Manage manual notices and view system status alerts.</p>
      </div>

      <div className="tabs">
        <button className={source === "manual" ? "active" : ""} onClick={() => setSource("manual")}>
          Manual
        </button>
        <button className={source === "uptime_kuma" ? "active" : ""} onClick={() => setSource("uptime_kuma")}>
          System
        </button>
      </div>

      <div className="tabs secondary">
        {statusTabs.map((tab) => (
          <button key={tab} className={status === tab ? "active" : ""} onClick={() => setStatus(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {error && <p className="note error">{error}</p>}

      {source === "manual" && canEdit && (
        <div className="form-grid announcement-form">
          <div>
            <label>Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Announcement title"
            />
          </div>
          <div>
            <label>Severity</label>
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label>Type</label>
            <select
              value={form.kind}
              onChange={(e) =>
                setForm({ ...form, kind: e.target.value as "information" | "announcement" | "system_maintenance" })
              }
            >
              <option value="information">Information</option>
              <option value="announcement">Announcement</option>
              <option value="system_maintenance">System Maintenance</option>
            </select>
          </div>
          <div className="full">
            <label>Message</label>
            <textarea
              rows={3}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Announcement message"
            />
          </div>
          <div>
            <label>Start time</label>
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            />
          </div>
          <div>
            <label>End time</label>
            <input
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
            />
          </div>
          <label className="checkbox-row full">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
            />
            Pin to top
          </label>
          <div className="actions">
            <button className="btn" onClick={handleSubmit}>
              {form.id ? "Update" : "Create"}
            </button>
            {form.id && (
              <button className="btn ghost" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      <div className="list">
        {loading && <p className="muted">Loading...</p>}
        {!loading && items.length === 0 && <p className="muted">No announcements.</p>}
        {items.map((item) => (
          <div key={item.id} className="list-item">
            <div>
              <strong>{item.title}</strong>
              <p className="muted">{item.message}</p>
              <div className="meta">
                <span>{item.source === "manual" ? "Manual" : "System"}</span>
                {item.kind && <span>{item.kind.replace(/_/g, " ")}</span>}
                <span>{item.computed_status || item.status}</span>
                {item.service_name && <span>{item.service_name}</span>}
              </div>
            </div>
            {item.source === "manual" && canEdit && (
              <div className="actions">
                <button className="btn ghost" onClick={() => handleEdit(item)}>Edit</button>
                <button className="btn ghost" onClick={() => handleDelete(item.id)}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
