import { useEffect, useState } from "react";
import api from "../api";
import useAdminAuth from "../hooks/useAdminAuth";

interface ImportSummary {
  rowCount: number;
  writtenCount: number;
  skippedCount: number;
  errorCount: number;
}

interface ImportError {
  row: number;
  message: string;
}

interface AutodeskEntitlement {
  id: string;
  user_email: string;
  product_name_friendly: string;
  product_name_raw: string;
  team_name?: string | null;
  status?: string | null;
  last_used_at?: string | null;
}

export default function AutodeskImport() {
  const { user: currentUser } = useAdminAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<AutodeskEntitlement[]>([]);
  const [entitlementsLoading, setEntitlementsLoading] = useState(false);
  const [entitlementsError, setEntitlementsError] = useState<string | null>(null);
  const [filterEmail, setFilterEmail] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualProduct, setManualProduct] = useState("");
  const [manualTeam, setManualTeam] = useState("");
  const [manualStatus, setManualStatus] = useState("");
  const [manualLastUsed, setManualLastUsed] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);

  const loadEntitlements = async (email?: string) => {
    setEntitlementsLoading(true);
    setEntitlementsError(null);
    try {
      const res = await api.get("/admin/autodesk/licenses", {
        params: email ? { email } : undefined
      });
      setEntitlements(Array.isArray(res.data?.entitlements) ? res.data.entitlements : []);
    } catch (err: any) {
      setEntitlementsError(err?.response?.data?.error || "Unable to load entitlements.");
    } finally {
      setEntitlementsLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setLoading(true);
    setErrorMessage(null);
    setSummary(null);
    setErrors([]);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("/admin/autodesk/licenses/import", form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setSummary(res.data.summary || null);
      setErrors(Array.isArray(res.data.errors) ? res.data.errors : []);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.error || "Import failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!manualEmail || !manualProduct) return;
    setManualLoading(true);
    setEntitlementsError(null);
    try {
      await api.post("/admin/autodesk/licenses", {
        email: manualEmail,
        productName: manualProduct,
        teamName: manualTeam || undefined,
        status: manualStatus || undefined,
        lastUsedAt: manualLastUsed || undefined
      });
      setManualEmail("");
      setManualProduct("");
      setManualTeam("");
      setManualStatus("");
      setManualLastUsed("");
      await loadEntitlements(filterEmail || undefined);
    } catch (err: any) {
      setEntitlementsError(err?.response?.data?.error || "Unable to add entitlement.");
    } finally {
      setManualLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/autodesk/licenses/${id}`);
      await loadEntitlements(filterEmail || undefined);
    } catch (err: any) {
      setEntitlementsError(err?.response?.data?.error || "Unable to delete entitlement.");
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Clear all Autodesk licenses?")) return;
    setClearLoading(true);
    setEntitlementsError(null);
    try {
      await api.delete("/admin/autodesk/licenses");
      await loadEntitlements(filterEmail || undefined);
    } catch (err: any) {
      setEntitlementsError(err?.response?.data?.error || "Unable to clear entitlements.");
    } finally {
      setClearLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role === "admin" || currentUser?.role === "superadmin") {
      loadEntitlements();
    }
  }, [currentUser]);

  if (currentUser?.role !== "admin" && currentUser?.role !== "superadmin") {
    return <p className="note">Only admins can access this page.</p>;
  }

  return (
    <section className="card">
      <h1>Autodesk License Import</h1>
      <p className="note">Upload Autodesk CSV exports (seat usage or usage reports).</p>
      <form className="form" onSubmit={handleSubmit}>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button className="btn" type="submit" disabled={!file || loading}>
          {loading ? "Uploading..." : "Upload CSV"}
        </button>
      </form>
      {errorMessage && <p className="error">{errorMessage}</p>}
      {summary && (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <h3>Import Summary</h3>
          <ul>
            <li>Total rows: {summary.rowCount}</li>
            <li>Written: {summary.writtenCount}</li>
            <li>Skipped: {summary.skippedCount}</li>
            <li>Errors: {summary.errorCount}</li>
          </ul>
        </div>
      )}
      {errors.length > 0 && (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <h3>Errors</h3>
          <ul>
            {errors.slice(0, 10).map((err) => (
              <li key={`${err.row}-${err.message}`}>
                Row {err.row}: {err.message}
              </li>
            ))}
          </ul>
          {errors.length > 10 && <p className="note">Showing first 10 errors.</p>}
        </div>
      )}
      <div className="panel" style={{ marginTop: "1.5rem" }}>
        <h3>Manual License Entry</h3>
        <form className="form" onSubmit={handleManualAdd}>
          <input
            type="email"
            placeholder="User email"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Product name"
            value={manualProduct}
            onChange={(e) => setManualProduct(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Team / Group (optional)"
            value={manualTeam}
            onChange={(e) => setManualTeam(e.target.value)}
          />
          <input
            type="text"
            placeholder="Status (optional)"
            value={manualStatus}
            onChange={(e) => setManualStatus(e.target.value)}
          />
          <input
            type="date"
            value={manualLastUsed}
            onChange={(e) => setManualLastUsed(e.target.value)}
          />
          <button className="btn" type="submit" disabled={manualLoading}>
            {manualLoading ? "Saving..." : "Add License"}
          </button>
        </form>
      </div>
      <div className="panel" style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Autodesk Licenses</h3>
          <button className="btn danger" type="button" onClick={handleClearAll} disabled={clearLoading}>
            {clearLoading ? "Clearing..." : "Clear All"}
          </button>
        </div>
        <div className="form" style={{ marginTop: "0.75rem" }}>
          <input
            type="email"
            placeholder="Filter by user email"
            value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
          />
          <button
            className="btn"
            type="button"
            onClick={() => loadEntitlements(filterEmail || undefined)}
            disabled={entitlementsLoading}
          >
            {entitlementsLoading ? "Loading..." : "Search"}
          </button>
        </div>
        {entitlementsError && <p className="error">{entitlementsError}</p>}
        {entitlementsLoading && <p className="note">Loading licenses…</p>}
        {!entitlementsLoading && entitlements.length === 0 && (
          <p className="note">No entitlements found.</p>
        )}
        {!entitlementsLoading && entitlements.length > 0 && (
          <div className="table-scroll" style={{ marginTop: "0.75rem" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Product</th>
                  <th>Team</th>
                  <th>Status</th>
                  <th>Last Used</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entitlements.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.user_email}</td>
                    <td>{entry.product_name_friendly || entry.product_name_raw}</td>
                    <td>{entry.team_name || "—"}</td>
                    <td>{entry.status || "Assigned"}</td>
                    <td>
                      {entry.last_used_at ? new Date(entry.last_used_at).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      <button className="btn ghost" type="button" onClick={() => handleDelete(entry.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
