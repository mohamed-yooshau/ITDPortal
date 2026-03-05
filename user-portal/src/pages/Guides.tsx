import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

type Guide = {
  id: number;
  title: string;
  subtitle?: string;
  description?: string;
  type: "step" | "knowledge" | "video";
  body?: string;
  videoUrl?: string;
  steps: Array<{ id: string; title: string; content: string; imageUrl?: string }>;
};

export default function Guides() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    api
      .get("/guides")
      .then((res) => setGuides(Array.isArray(res.data.guides) ? res.data.guides : []))
      .catch(() => setGuides([]))
      .finally(() => setLoading(false));
  }, []);

  const guideBadge = (guide: Guide) => {
    const type = guide.type || "step";
    if (type === "knowledge") return "Knowledge Base";
    if (type === "video") return "Video Guide";
    return `${guide.steps.length} steps`;
  };

  const guideSummary = (guide: Guide) => {
    const type = guide.type || "step";
    if (guide.description) return guide.description;
    if (guide.subtitle) return guide.subtitle;
    if (type === "knowledge" && guide.body) {
      return guide.body.slice(0, 140) + (guide.body.length > 140 ? "..." : "");
    }
    return "Open this guide to see the details.";
  };

  const filtered = guides.filter((guide) => {
    const matchesSearch = guide.title.toLowerCase().includes(search.toLowerCase());
    const type = guide.type || "step";
    const matchesType = typeFilter === "all" || typeFilter === type;
    return matchesSearch && matchesType;
  });

  return (
    <section className="card">
      <h1>Guides</h1>
      <p className="muted">Step-by-step guides, knowledge articles, and video walkthroughs.</p>
      <div className="filters">
        <input
          type="text"
          placeholder="Search guides"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          <option value="step">Step-by-step</option>
          <option value="knowledge">Knowledge Base</option>
          <option value="video">Video Guides</option>
        </select>
      </div>
      {loading ? (
        <div className="panel">Loading guides...</div>
      ) : guides.length === 0 ? (
        <div className="panel empty-state">
          <h3>No guides yet</h3>
          <p>Check back soon for new tutorials and articles.</p>
        </div>
      ) : (
        <>
          <div className="list guides-list">
            {filtered.map((guide) => (
              <Link key={guide.id} to={`/guides/${guide.id}`} className="link-card guide-card">
                <div className="list-item-head">
                  <h4>{guide.title}</h4>
                  <span className="badge">{guideBadge(guide)}</span>
                </div>
                <p>{guideSummary(guide)}</p>
              </Link>
            ))}
          </div>
          {filtered.length === 0 && <p className="muted">No guides match your filters.</p>}
        </>
      )}
    </section>
  );
}
