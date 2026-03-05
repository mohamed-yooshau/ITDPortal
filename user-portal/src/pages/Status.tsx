import { useEffect, useState } from "react";
import api from "../api";

type Monitor = {
  id: number;
  name: string;
  status: "up" | "down" | "pending" | "unknown";
  statusCode?: number;
  url?: string | null;
};

type StatusPayload = {
  monitors: Monitor[];
  updatedAt?: string;
  message?: string;
};

function StatusBadge({ status }: { status: Monitor["status"] }) {
  if (status === "up") {
    return <span className="status-dot status-up status-indicator" aria-label="Operational" title="Operational" />;
  }
  if (status === "down") {
    return <span className="status-dot status-down status-indicator" aria-label="Down" title="Down" />;
  }
  if (status === "pending") {
    return <span className="status-dot status-pending status-indicator" aria-label="Pending" title="Pending" />;
  }
  return <span className="status-dot status-pending status-indicator" aria-label="Unknown" title="Unknown" />;
}

export default function Status() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = (force = false) => {
    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    api
      .get(`/status/summary${force ? `?force=1&ts=${Date.now()}` : ""}`)
      .then((res) => setData(res.data))
      .catch((err) => setData({ monitors: [], message: err.response?.data?.message || "Unable to load status." }))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => loadStatus(true), 5000);
    return () => clearInterval(interval);
  }, []);

  const monitors = data?.monitors || [];
  const hasDown = monitors.some((monitor) => monitor.status === "down");
  const hasIssues = hasDown || monitors.some((monitor) => monitor.status === "pending");

  return (
    <section className="card">
      <div className="status-header">
        <h1>Service Health</h1>
        <div className="status-actions">
          <button className="status-refresh" onClick={() => loadStatus(true)} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
      {!loading && !data?.message && (
        <div className={`status-banner ${hasIssues ? "status-banner-alert" : "status-banner-ok"}`}>
          {hasIssues ? "Some services are having issues right now." : "All services are functioning properly."}
        </div>
      )}
      {loading ? (
        <div className="panel">Loading status...</div>
      ) : data?.message ? (
        <div className="panel">{data.message}</div>
      ) : (
        <div className="panel">
          <div className="status-list">
            {monitors.length ? (
              monitors.map((monitor) => (
                <div key={monitor.id} className="status-row">
                  <div>
                    <strong>{monitor.name}</strong>
                    {monitor.url && <span className="status-url">{monitor.url}</span>}
                  </div>
                  <StatusBadge status={monitor.status} />
                </div>
              ))
            ) : (
              <div className="status-empty">No monitors configured.</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
