import { useEffect, useState } from "react";
import api from "../api";

type Policy = {
  id: number;
  title: string;
  file_url: string;
  kind?: "policy" | "procedure";
  created_at: string;
};

export default function Policies() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [selected, setSelected] = useState<Policy | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerType, setViewerType] = useState<string>("");
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  const clearViewer = () => {
    if (viewerUrl) {
      URL.revokeObjectURL(viewerUrl);
    }
    setViewerUrl(null);
    setViewerType("");
    setSelected(null);
    setViewerError(null);
  };

  const handleOpen = async (policy: Policy) => {
    setViewerError(null);
    setLoadingDoc(true);
    try {
      const response = await api.get(`/policies/${policy.id}/download`, { responseType: "blob" });
      const blob = response.data as Blob;
      if (viewerUrl) {
        URL.revokeObjectURL(viewerUrl);
      }
      const blobUrl = URL.createObjectURL(blob);
      setSelected(policy);
      setViewerUrl(blobUrl);
      setViewerType(blob.type || "");
    } catch {
      setViewerError("Unable to open this document. Please sign in again.");
    } finally {
      setLoadingDoc(false);
    }
  };

  useEffect(() => {
    api
      .get("/policies")
      .then((res) => setPolicies(Array.isArray(res.data.policies) ? res.data.policies : []))
      .catch(() => setPolicies([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (viewerUrl) {
        URL.revokeObjectURL(viewerUrl);
      }
    };
  }, [viewerUrl]);

  const filtered = policies.filter((policy) => {
    const matchesSearch = policy.title.toLowerCase().includes(search.toLowerCase());
    const kind = policy.kind || "policy";
    const matchesKind = kindFilter === "all" || kindFilter === kind;
    return matchesSearch && matchesKind;
  });

  return (
    <section className="card">
      <h1>Policies & Procedures</h1>
      <p className="muted">Official IT policies and procedures.</p>
      <div className="filters">
        <input
          type="text"
          placeholder="Search policies"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
          <option value="all">All types</option>
          <option value="policy">Policies</option>
          <option value="procedure">Procedures</option>
        </select>
      </div>
      {loading ? (
        <div className="panel">Loading policies...</div>
      ) : policies.length === 0 ? (
        <div className="panel empty-state">
          <h3>No policies yet</h3>
          <p>Check back later for published documents.</p>
        </div>
      ) : (
        <>
          <div className="list policies-list">
            {filtered.map((policy) => (
              <a
                key={policy.id}
                href={`/api/policies/${policy.id}/download`}
                className="link-card policy-card"
                onClick={(event) => {
                  event.preventDefault();
                  handleOpen(policy);
                }}
              >
                <div className="list-item-head">
                  <h4>{policy.title}</h4>
                  <span className="badge">{(policy.kind || "policy").toUpperCase()}</span>
                </div>
                <p>View document</p>
              </a>
            ))}
          </div>
          {(loadingDoc || viewerUrl || viewerError) && (
            <div className="policy-overlay" onClick={clearViewer} role="dialog" aria-modal="true">
              <div className="policy-modal" onClick={(event) => event.stopPropagation()}>
                <div className="policy-viewer-header">
                  <div>
                    <h3>{selected?.title || "Document Viewer"}</h3>
                    <p className="muted">{(selected?.kind || "policy").toUpperCase()}</p>
                  </div>
                  <div className="policy-viewer-actions">
                    {viewerUrl && (
                      <a className="btn ghost" href={viewerUrl} download>
                        Download
                      </a>
                    )}
                    <button className="btn ghost" type="button" onClick={clearViewer}>
                      Close
                    </button>
                  </div>
                </div>
                {loadingDoc && <p className="muted">Loading document...</p>}
                {viewerError && <p className="error">{viewerError}</p>}
                {!loadingDoc && viewerUrl && (
                  <div className="policy-viewer-frame">
                    {viewerType.startsWith("image/") ? (
                      <img src={viewerUrl} alt={selected?.title || "Document"} />
                    ) : (
                      <iframe title={selected?.title || "Document"} src={viewerUrl} />
                    )}
                  </div>
                )}
                {!loadingDoc && viewerUrl && !viewerType.includes("pdf") && !viewerType.startsWith("image/") && (
                  <p className="muted">
                    If this document does not render in the viewer, use Download.
                  </p>
                )}
              </div>
            </div>
          )}
          {filtered.length === 0 && <p className="muted">No policies match your filters.</p>}
        </>
      )}
    </section>
  );
}
