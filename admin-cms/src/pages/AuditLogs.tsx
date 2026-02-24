import { useEffect, useState } from "react";
import api from "../api";

interface AuditLog {
  id: string;
  created_at: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  resource: string | null;
  status: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata?: Record<string, any> | null;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (actionFilter.trim()) params.set("action", actionFilter.trim());
    if (statusFilter.trim()) params.set("status", statusFilter.trim());
    api
      .get(`/admin/audit-logs?${params.toString()}`)
      .then((res) => {
        setLogs(Array.isArray(res.data?.logs) ? res.data.logs : []);
      })
      .catch(() => setError("Unable to load audit logs."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [actionFilter, statusFilter]);

  const download = () => {
    window.open("/api/admin/audit-logs/export", "_blank", "noopener");
  };

  return (
    <section className="card">
      <div className="section-header">
        <h2>Audit Logs</h2>
        <p>Security and activity trail for logins, comments, and admin actions.</p>
      </div>

      <div className="form-grid">
        <div>
          <label>Action</label>
          <input
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            placeholder="e.g. admin.settings.update"
          />
        </div>
        <div>
          <label>Status</label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="denied">Denied</option>
          </select>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={download}>Download CSV</button>
          <button className="btn" onClick={load}>Refresh</button>
        </div>
      </div>

      {error && <p className="note error">{error}</p>}
      {loading && <p className="muted">Loading...</p>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Role</th>
              <th>Action</th>
              <th>Status</th>
              <th>Resource</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString()}</td>
                <td>{log.actor_email || "System"}</td>
                <td>{log.actor_role || "-"}</td>
                <td>{log.action}</td>
                <td>{log.status}</td>
                <td>{log.resource || "-"}</td>
                <td>{log.ip_address || "-"}</td>
              </tr>
            ))}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">No logs found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
