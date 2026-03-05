import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

type SummaryItem = {
  id: number;
  title: string;
  status: "Planned" | "In Progress" | "Done";
  progress: number;
  dueDate?: string | null;
  owner?: string | null;
};

type SummaryResponse = {
  quarter: number;
  year: number;
  label: string;
  limit: number;
  items: SummaryItem[];
};

const cache = {
  data: null as SummaryResponse | null,
  expiresAt: 0,
  promise: null as Promise<SummaryResponse> | null
};

const CACHE_MS = 5 * 60 * 1000;

type HomepageActionPlanCardProps = {
  onLabelChange?: (label: string) => void;
};

async function fetchSummary(): Promise<SummaryResponse> {
  if (cache.data && cache.expiresAt > Date.now()) {
    return cache.data;
  }
  if (cache.promise) return cache.promise;
  cache.promise = api
    .get("/action-plan/current-quarter-summary")
    .then((res) => res.data as SummaryResponse)
    .then((data) => {
      cache.data = data;
      cache.expiresAt = Date.now() + CACHE_MS;
      return data;
    })
    .finally(() => {
      cache.promise = null;
    });
  return cache.promise;
}

export default function HomepageActionPlanCard({ onLabelChange }: HomepageActionPlanCardProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<SummaryResponse | null>(cache.data);
  const [loading, setLoading] = useState(!cache.data);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(!cache.data);
    setError("");
    fetchSummary()
      .then((res) => {
        if (!active) return;
        setData(res);
        if (res?.label) {
          onLabelChange?.(res.label);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.response?.data?.message || "Unable to load action plan.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const items = data?.items || [];

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="license-skeleton">
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="ticket-summary-error">
          <p className="muted">{error}</p>
          <button
            className="btn"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              window.location.reload();
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    if (!items.length) {
      return (
        <div className="action-plan-empty">
          <p>No initiatives published for this quarter yet.</p>
        </div>
      );
    }
    return (
      <div className="action-plan-list">
        {items.map((item) => (
          <div key={item.id} className="action-plan-row">
            <div className="action-plan-row-top">
              <span className="action-plan-title" title={item.title}>
                {item.title}
              </span>
              <span
                className={`status-pill status-${item.status.replace(/\s+/g, "-").toLowerCase()}`}
                aria-label={`Status: ${item.status}`}
              >
                {item.status}
              </span>
            </div>
            <div className="action-plan-progress">
              <span className="progress-value">{item.progress}%</span>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${item.progress}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [loading, error, items]);

  const handleActivate = () => navigate("/action-plan");

  return (
    <div
      role="button"
      tabIndex={0}
      className="action-plan-card"
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleActivate();
        }
      }}
    >
      <div className="action-plan-body">{content}</div>
    </div>
  );
}
