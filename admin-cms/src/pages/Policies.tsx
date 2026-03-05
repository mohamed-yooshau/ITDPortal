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
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"policy" | "procedure">("policy");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpen = async (policyId: number) => {
    try {
      const response = await api.get(`/policies/${policyId}/download`, { responseType: "blob" });
      const blobUrl = URL.createObjectURL(response.data as Blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch {
      setMessage("Unable to open this document. Please sign in again.");
    }
  };

  const loadPolicies = () => {
    api
      .get("/admin/policies")
      .then((res) => setPolicies(Array.isArray(res.data.policies) ? res.data.policies : []))
      .catch(() => setPolicies([]));
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!title.trim() || !file) {
      setMessage("Title and file are required.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await api.post("/admin/policies/upload", formData);
      const fileUrl = uploadRes.data?.url;
      if (!fileUrl) {
        throw new Error("Upload failed");
      }
      await api.post("/admin/policies", { title: title.trim(), fileUrl, kind });
      setTitle("");
      setKind("policy");
      setFile(null);
      setMessage("Policy uploaded.");
      loadPolicies();
    } catch (err: any) {
      setMessage(err?.response?.data?.error || "Unable to upload policy.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this policy?")) return;
    await api.delete(`/admin/policies/${id}`);
    loadPolicies();
  };

  return (
    <section className="card">
      <h1>Policies & Procedures</h1>
      <p className="note">Upload official policy documents and procedures for staff.</p>
      <form className="panel form-grid" onSubmit={handleSubmit}>
        <input
          placeholder="Policy title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as "policy" | "procedure")}>
          <option value="policy">Policy</option>
          <option value="procedure">Procedure</option>
        </select>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Uploading..." : "Upload Policy"}
        </button>
        {message && <p className={message.includes("Unable") ? "error" : "success"}>{message}</p>}
      </form>
      <div className="panel">
        {policies.length === 0 ? (
          <p className="note">No policies uploaded yet.</p>
        ) : (
          <div className="list">
            {policies.map((policy) => (
              <div key={policy.id} className="list-item policy-item">
                <div>
                  <strong>{policy.title}</strong>
                  <span className="note">
                    {(policy.kind || "policy").toUpperCase()} •{" "}
                    {new Date(policy.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="actions">
                  <a
                    className="btn ghost"
                    href={`/api/policies/${policy.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => {
                      event.preventDefault();
                      handleOpen(policy.id);
                    }}
                  >
                    View
                  </a>
                  <button className="btn ghost" type="button" onClick={() => handleDelete(policy.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
