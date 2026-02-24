import { useEffect, useMemo, useState } from "react";
import { fetchTicketStatusCounts } from "../api/helpdesk";

type StatusPoint = {
  status: string;
  count: number;
};

type CategoryKey = "queue" | "attending" | "resolved";

type CategorySummary = {
  key: CategoryKey;
  title: string;
  helper: string;
  count: number;
};

// Update the default site here when switching to a different helpdesk site.
const DEFAULT_SITE = "ICT";

const CATEGORY_DEFS: Array<Omit<CategorySummary, "count">> = [
  {
    key: "queue",
    title: "In Queue",
    helper: "Tickets awaiting assignment"
  },
  {
    key: "attending",
    title: "Currently Attending",
    helper: "Tickets being worked on"
  },
  {
    key: "resolved",
    title: "Resolved Tickets",
    helper: "Completed tickets"
  }
];

function normalizeStatusCounts(raw: unknown): StatusPoint[] {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => {
        const status =
          typeof entry?.status === "string"
            ? entry.status
            : typeof entry?.name === "string"
              ? entry.name
              : typeof entry?.state === "string"
                ? entry.state
                : "";
        const countValue =
          typeof entry?.count === "number"
            ? entry.count
            : typeof entry?.total === "number"
              ? entry.total
              : typeof entry?.value === "number"
                ? entry.value
                : Number(entry?.count ?? entry?.total ?? entry?.value ?? 0);
        return {
          status: status.trim(),
          count: Number.isFinite(countValue) ? countValue : 0
        };
      })
      .filter((entry) => entry.status);
  }

  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.statuses)) {
      return normalizeStatusCounts(record.statuses);
    }
    if (Array.isArray(record.data)) {
      return normalizeStatusCounts(record.data);
    }
    return Object.entries(record)
      .map(([status, count]) => ({
        status,
        count: typeof count === "number" ? count : Number(count ?? 0)
      }))
      .filter((entry) => entry.status);
  }

  return [];
}

function mapStatusToCategory(status: string): CategoryKey | null {
  const normalized = status.trim().toLowerCase();
  if (normalized === "unassigned") return "queue";
  if (normalized === "open" || normalized === "in progress") return "attending";
  if (normalized === "solved" || normalized === "closed") return "resolved";
  return null;
}

export default function TicketStatusSummary() {
  const [data, setData] = useState<StatusPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = () => {
    setLoading(true);
    setError("");
    fetchTicketStatusCounts(DEFAULT_SITE)
      .then((payload) => {
        const normalized = normalizeStatusCounts(payload);
        setData(normalized);
      })
      .catch((err) => {
        setData([]);
        setError(err?.response?.data?.message || "Unable to load ticket summary.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const summaries = useMemo(() => {
    const counts: Record<CategoryKey, number> = {
      queue: 0,
      attending: 0,
      resolved: 0
    };
    data.forEach((entry) => {
      const category = mapStatusToCategory(entry.status);
      if (!category) return;
      counts[category] += Number.isFinite(entry.count) ? entry.count : 0;
    });
    return CATEGORY_DEFS.map((def) => ({
      ...def,
      count: counts[def.key]
    }));
  }, [data]);

  const totalCount = useMemo(
    () => summaries.reduce((sum, item) => sum + item.count, 0),
    [summaries]
  );

  return (
    <div className="panel ticket-summary">
      <div className="ticket-summary-header">
        <div className="ticket-summary-titleblock">
          <div className="ticket-summary-titleline">
            <h3>Ticket Status Dashboard</h3>
            <span className="ticket-total-badge">Total: {totalCount}</span>
          </div>
          <p className="muted">Live ticket count by status (ITD)</p>
        </div>
      </div>

      {error && (
        <div className="ticket-summary-error">
          <p className="muted">{error}</p>
          <button className="btn" type="button" onClick={loadData}>
            Retry
          </button>
        </div>
      )}

      {loading && !error && <p className="muted">Loading ticket summary...</p>}

      <div className="ticket-summary-grid-wrap">
        <div className="ticket-summary-grid">
        {summaries.map((summary) => (
          <div
            key={summary.key}
            className={`ticket-summary-card ${summary.count === 0 ? "ticket-summary-muted" : ""}`}
          >
            <div className="ticket-summary-count">{summary.count}</div>
            <div className="ticket-summary-title">{summary.title}</div>
            <div className="ticket-summary-helper muted">{summary.helper}</div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
