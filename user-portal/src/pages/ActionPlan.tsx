import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";

const departments: Record<string, { color: string }> = {
  ITOps: { color: "#dc2626" },
  Infra: { color: "#7c3aed" },
  Dev: { color: "#3b82f6" },
  ERP: { color: "#ea580c" },
  "3rd Party": { color: "#1f2937" },
  Admin: { color: "#6b7280" }
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Segment = {
  id: number;
  start_month: number;
  end_month: number;
  department: string;
  sort_order?: number | null;
};

type Initiative = {
  id: number;
  name: string;
  segments: Segment[];
};

export default function ActionPlan() {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDepartments, setActiveDepartments] = useState<Set<string>>(new Set(Object.keys(departments)));
  const [sortField, setSortField] = useState<"name" | "start" | "duration">("start");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const sortRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api
      .get("/action-plan/initiatives")
      .then((res) => setInitiatives(res.data.initiatives || []))
      .catch(() => setInitiatives([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (filterRef.current && !filterRef.current.contains(target)) {
        setFilterOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(target)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const filteredInitiatives = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return initiatives.filter((init) => {
      const matchesSearch = !search || init.name.toLowerCase().includes(search);
      const matchesDepartment = init.segments.some((seg) => activeDepartments.has(seg.department));
      return matchesSearch && matchesDepartment;
    });
  }, [initiatives, searchQuery, activeDepartments]);

  const sortedInitiatives = useMemo(() => {
    const list = [...filteredInitiatives];
    list.sort((a, b) => {
      const aStart = Math.min(...a.segments.map((s) => s.start_month));
      const bStart = Math.min(...b.segments.map((s) => s.start_month));
      const aEnd = Math.max(...a.segments.map((s) => s.end_month));
      const bEnd = Math.max(...b.segments.map((s) => s.end_month));
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "start") cmp = aStart - bStart;
      else cmp = (aEnd - aStart) - (bEnd - bStart);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [filteredInitiatives, sortField, sortDir]);

  const activeCount = activeDepartments.size;

  const toggleDepartment = (dept: string) => {
    setActiveDepartments((current) => {
      const next = new Set(current);
      if (next.has(dept)) {
        next.delete(dept);
      } else {
        next.add(dept);
      }
      return next;
    });
  };

  const resetFilters = () => {
    setActiveDepartments(new Set(Object.keys(departments)));
    setSearchQuery("");
    setFilterOpen(false);
  };

  return (
    <div className={`action-plan ${viewMode ? "view-mode" : ""}`}>
      <div className="action-plan-header">
        <div className="action-plan-title">
          <h1>IT Action Plan 2026</h1>
          <span>MTCC Information Technology</span>
        </div>
        <div className="action-plan-actions">
          <button className="ap-btn ap-btn-secondary" onClick={() => setViewMode((prev) => !prev)}>
            {viewMode ? "Exit" : "View"}
          </button>
        </div>
      </div>

      <div className="action-plan-main">
        <div className="ap-toolbar">
          <div className="ap-toolbar-left">
            <div className="ap-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                type="search"
                placeholder="Search initiatives"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <div className={`ap-dropdown ${filterOpen ? "open" : ""}`} ref={filterRef}>
              <button className="ap-btn ap-btn-secondary" onClick={() => setFilterOpen((prev) => !prev)}>
                Filter
                {activeCount < Object.keys(departments).length && <span className="ap-badge">{activeCount}</span>}
              </button>
              <div className="ap-dropdown-menu">
                <div className="ap-dropdown-title">Departments</div>
                {Object.entries(departments).map(([dept, meta]) => (
                  <button
                    key={dept}
                    className={`ap-dropdown-item ${activeDepartments.has(dept) ? "active" : ""}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleDepartment(dept);
                    }}
                  >
                    <span className="ap-dot" style={{ background: meta.color }} />
                    {dept}
                  </button>
                ))}
                <div className="ap-dropdown-divider" />
                <button
                  className="ap-dropdown-item"
                  onClick={(event) => {
                    event.preventDefault();
                    resetFilters();
                  }}
                >
                  Reset all
                </button>
              </div>
            </div>
          </div>
          <div className="ap-toolbar-right">
            <div className={`ap-dropdown ${sortOpen ? "open" : ""}`} ref={sortRef}>
              <button className="ap-btn ap-btn-secondary" onClick={() => setSortOpen((prev) => !prev)}>
                Sort
              </button>
              <div className="ap-dropdown-menu">
                <button
                  className={`ap-dropdown-item ${sortField === "name" ? "active" : ""}`}
                  onClick={() => {
                    setSortField("name");
                    setSortDir("asc");
                    setSortOpen(false);
                  }}
                >
                  Name (A-Z)
                </button>
                <button
                  className={`ap-dropdown-item ${sortField === "start" ? "active" : ""}`}
                  onClick={() => {
                    setSortField("start");
                    setSortDir("asc");
                    setSortOpen(false);
                  }}
                >
                  Start month
                </button>
                <button
                  className={`ap-dropdown-item ${sortField === "duration" ? "active" : ""}`}
                  onClick={() => {
                    setSortField("duration");
                    setSortDir("asc");
                    setSortOpen(false);
                  }}
                >
                  Duration
                </button>
                <div className="ap-dropdown-divider" />
                <button
                  className="ap-dropdown-item"
                  onClick={() => {
                    setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                    setSortOpen(false);
                  }}
                >
                  Direction: {sortDir === "asc" ? "Ascending" : "Descending"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={`ap-legend ${legendCollapsed ? "collapsed" : ""}`}>
          <div className="ap-legend-header" onClick={() => setLegendCollapsed((prev) => !prev)}>
            <h3>Departments</h3>
            <span className="ap-legend-toggle">▾</span>
          </div>
          <div className="ap-legend-content">
            {Object.entries(departments).map(([dept, meta]) => (
              <button
                key={dept}
                className={`ap-chip ${activeDepartments.has(dept) ? "active" : "inactive"}`}
                onClick={() => toggleDepartment(dept)}
              >
                <span className="ap-dot" style={{ background: meta.color }} />
                {dept}
              </button>
            ))}
          </div>
        </div>

        <div className="ap-stats">
          <div className="ap-stat">
            <strong>{initiatives.length}</strong>
            <span>Initiatives</span>
          </div>
        </div>

        <div className="ap-gantt">
          <div className="ap-gantt-wrapper">
            <table className="ap-table">
              <thead className="ap-table-head">
                <tr>
                  <th>Initiative</th>
                  {monthNames.map((month) => (
                    <th key={month}>{month}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={13}>
                      <div className="ap-empty">Loading initiatives...</div>
                    </td>
                  </tr>
                ) : sortedInitiatives.length === 0 ? (
                  <tr>
                    <td colSpan={13}>
                      <div className="ap-empty">No initiatives found.</div>
                    </td>
                  </tr>
                ) : (
                  sortedInitiatives.map((init) => {
                    const uniqueCats = Array.from(new Set(init.segments.map((seg) => seg.department)));
                    const minStart = Math.min(...init.segments.map((seg) => seg.start_month));
                    const maxEnd = Math.max(...init.segments.map((seg) => seg.end_month));
                    return (
                      <tr key={init.id} className="ap-row">
                        <td className="ap-initiative">
                          <div className="ap-initiative-cell">
                            <div className="ap-initiative-colors">
                              {uniqueCats.map((cat) => (
                                <span key={cat} className="ap-initiative-color" style={{ background: departments[cat]?.color }} />
                              ))}
                            </div>
                            <div className="ap-initiative-info">
                              <div className="ap-initiative-name">{init.name}</div>
                              <div className="ap-initiative-meta">
                                {monthNames[minStart - 1]} - {monthNames[maxEnd - 1]} · {maxEnd - minStart + 1} mo
                              </div>
                            </div>
                          </div>
                        </td>
                        {monthNames.map((_month, idx) => {
                          const m = idx + 1;
                          const bars = init.segments
                            .map((seg, segIdx) => ({ seg, segIdx }))
                            .filter(({ seg }) => seg.start_month === m)
                            .map(({ seg, segIdx }) => {
                              const duration = seg.end_month - seg.start_month + 1;
                              const widthPct = duration * 100;
                              return (
                                <div
                                  key={`${seg.id}-${segIdx}`}
                                  className="ap-bar"
                                  style={{
                                    left: "2px",
                                    width: `calc(${widthPct}% - 4px)`,
                                    background: departments[seg.department]?.color || "#94a3b8"
                                  }}
                                >
                                  <span className="ap-bar-label">
                                    {duration > 1 ? `${duration} mo` : monthNames[seg.start_month - 1]}
                                  </span>
                                </div>
                              );
                            });
                          return (
                            <td key={`${init.id}-${m}`} className="ap-timeline">
                              {bars}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
