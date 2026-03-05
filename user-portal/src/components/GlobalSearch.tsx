import { useEffect, useRef, useState } from "react";
import api from "../api";

type ContentResult = {
  type: string;
  id: number | string;
  title: string;
  description?: string;
  url: string;
};

type PersonResult = {
  employee: {
    rcno?: number;
    full_name: string;
    post: string;
    division: string;
    email: string;
    doj?: string;
    photoUrl?: string;
  };
  reportsTo?: {
    rcno?: number | null;
    full_name: string;
    post: string;
    division: string;
    email: string;
  } | null;
  hod?: {
    rcno?: number | null;
    full_name: string;
    post: string;
    division: string;
    email: string;
  } | null;
};

type SearchContentProps = {
  variant?: "page" | "modal";
  onClose?: () => void;
};

export function GlobalSearchContent({ variant = "page", onClose }: SearchContentProps) {
  const [tab, setTab] = useState<"content" | "people">("content");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ContentResult[]>([]);
  const [person, setPerson] = useState<PersonResult | null>(null);
  const [error, setError] = useState("");
  const debounceRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const stripLabel = (value?: string | number | null, label?: string) => {
    if (value === null || value === undefined) return "-";
    const text = String(value).trim();
    if (!label) return text || "-";
    const lowerLabel = label.toLowerCase();
    const normalized = text.replace(/\s+/g, " ");
    const matcher = new RegExp(`^${lowerLabel}\\s*[:\\-–—]?\\s*`, "i");
    if (matcher.test(normalized)) {
      const stripped = normalized.replace(matcher, "").trim();
      return stripped || "-";
    }
    return normalized || "-";
  };

  const handleSearch = async () => {
    const q = query.trim();
    setError("");
    setResults([]);
    setPerson(null);
    if (!q) return;
    setLoading(true);
    try {
      if (tab === "content") {
        const res = await api.get(`/search?q=${encodeURIComponent(q)}`);
        setResults(Array.isArray(res.data?.results) ? res.data.results : []);
      } else {
        const res = await api.get(`/search/people?q=${encodeURIComponent(q)}`);
        setPerson(res.data?.person || null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSearch = (value: string) => {
    setQuery(value);
  };

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    if (!query.trim()) {
      setResults([]);
      setPerson(null);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      handleSearch();
    }, 500);
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [query, tab]);

  useEffect(() => {
    if (variant === "modal") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [variant]);

  return (
    <section className={`search-page ${variant === "modal" ? "search-modal-body" : "page"}`}>
      <div className="search-header">
        <div>
          <h2>Search</h2>
          <p>Find services, guides, policies, and people.</p>
        </div>
      </div>

      <div className="search-bar">
        <input
          ref={inputRef}
          type="search"
          placeholder={tab === "content" ? "Search services, guides, policies..." : "Search by email or RC number"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSearch();
          }}
        />
        <button className="btn" type="button" onClick={handleSearch}>
          Search
        </button>
      </div>

      <div className="tabs search-tabs">
        <button className={tab === "content" ? "active" : ""} onClick={() => setTab("content")}>
          Portal Content
        </button>
        <button className={tab === "people" ? "active" : ""} onClick={() => setTab("people")}>
          Staffs and Reporting
        </button>
      </div>

      {loading && <p className="muted">Searching...</p>}
      {error && <p className="note error">{error}</p>}

      {tab === "content" && !loading && (
        <div className="search-results">
          {results.length === 0 && query.trim() && <p className="muted">No results found.</p>}
          {results.map((item) => (
            <a key={`${item.type}-${item.id}`} className="search-result" href={item.url}>
              <div>
                <strong>{item.title}</strong>
                {item.description && <p className="muted">{item.description}</p>}
              </div>
              <span className="badge">{item.type}</span>
            </a>
          ))}
        </div>
      )}

      {tab === "people" && !loading && (
        <div className="search-results">
          {!person && query.trim() && <p className="muted">No matching person found.</p>}
          {person && (
            <div className="person-card person-result-card">
              <div className="person-result-grid">
                <div className="person-result-main">
                  <div className="person-identity">
                    {person.employee.photoUrl && <img src={person.employee.photoUrl} alt="" />}
                    <div className="person-identity-text">
                      <div className="person-identity-line">
                        <strong>{person.employee.full_name}</strong>
                        <span className="pill">RC {stripLabel(person.employee.rcno, "RC")}</span>
                      </div>
                      <p className="muted">{person.employee.post}</p>
                    </div>
                  </div>
                  <div className="person-reporting">
                    <div className="reporting-title">Reporting</div>
                    {person.reportsTo && (
                      <button
                        className="reporting-row"
                        type="button"
                        onClick={() =>
                          handleQuickSearch(person.reportsTo?.email || String(person.reportsTo?.rcno || ""))
                        }
                      >
                        <img
                          src={`/api/aps/photo/${encodeURIComponent(String(person.reportsTo.rcno || ""))}`}
                          alt=""
                        />
                        <div className="reporting-text">
                          <div className="reporting-line">
                            <span className="label">Reports To</span>
                            <strong>{person.reportsTo.full_name}</strong>
                            <span className="pill">RC {stripLabel(person.reportsTo.rcno, "RC")}</span>
                          </div>
                          <p className="muted">{person.reportsTo.post}</p>
                          <span className="reporting-email">
                            {stripLabel(person.reportsTo.email, "Email")}
                          </span>
                        </div>
                      </button>
                    )}
                    {person.hod && (
                      <button
                        className="reporting-row"
                        type="button"
                        onClick={() => handleQuickSearch(person.hod?.email || String(person.hod?.rcno || ""))}
                      >
                        <img src={`/api/aps/photo/${encodeURIComponent(String(person.hod.rcno || ""))}`} alt="" />
                        <div className="reporting-text">
                          <div className="reporting-line">
                            <span className="label">HOD</span>
                            <strong>{person.hod.full_name}</strong>
                            <span className="pill">RC {stripLabel(person.hod.rcno, "RC")}</span>
                          </div>
                          <p className="muted">{person.hod.post}</p>
                          <span className="reporting-email">
                            {stripLabel(person.hod.email, "Email")}
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
                <div className="person-result-meta">
                  <div className="meta-row">
                    <span className="label">Division</span>
                    <span>{stripLabel(person.employee.division, "Division")}</span>
                  </div>
                  <div className="meta-row">
                    <span className="label">Email</span>
                    <span className="truncate">{stripLabel(person.employee.email, "Email")}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {variant === "modal" && onClose && (
        <div className="search-modal-footer">
          <button className="btn ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      )}
    </section>
  );
}

type GlobalSearchOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export default function GlobalSearchOverlay({ open, onClose }: GlobalSearchOverlayProps) {
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("search-open");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("search-open");
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="search-modal" onClick={(event) => event.stopPropagation()}>
        <GlobalSearchContent variant="modal" onClose={onClose} />
      </div>
    </div>
  );
}
