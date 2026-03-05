import { useEffect, useState } from "react";
import api from "../api";

const departments = ["ITOps", "Infra", "Dev", "ERP", "3rd Party", "Admin"] as const;

type Segment = {
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

const emptySegment = (): Segment => ({
  start_month: 1,
  end_month: 1,
  department: "ITOps",
  sort_order: null
});

export default function ActionPlan() {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formId, setFormId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [segments, setSegments] = useState<Segment[]>([emptySegment()]);

  const load = () => {
    setLoading(true);
    api
      .get("/action-plan/initiatives")
      .then((res) => setInitiatives(Array.isArray(res.data.initiatives) ? res.data.initiatives : []))
      .catch(() => setInitiatives([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setFormId(null);
    setName("");
    setSegments([emptySegment()]);
    setError(null);
  };

  const handleAddSegment = () => {
    setSegments((current) => [...current, emptySegment()]);
  };

  const handleRemoveSegment = (index: number) => {
    setSegments((current) => current.filter((_, idx) => idx !== index));
  };

  const handleSegmentChange = (index: number, updates: Partial<Segment>) => {
    setSegments((current) =>
      current.map((seg, idx) => (idx === index ? { ...seg, ...updates } : seg))
    );
  };

  const validateForm = () => {
    if (!name.trim()) {
      setError("Initiative name is required.");
      return false;
    }
    if (!segments.length) {
      setError("At least one segment is required.");
      return false;
    }
    for (const seg of segments) {
      if (!departments.includes(seg.department as typeof departments[number])) {
        setError("Department is invalid.");
        return false;
      }
      if (seg.start_month < 1 || seg.start_month > 12 || seg.end_month < 1 || seg.end_month > 12) {
        setError("Months must be between 1 and 12.");
        return false;
      }
      if (seg.end_month < seg.start_month) {
        setError("End month must be after start month.");
        return false;
      }
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;
    const payload = {
      name: name.trim(),
      segments: segments.map((seg, idx) => ({
        start_month: Number(seg.start_month),
        end_month: Number(seg.end_month),
        department: seg.department,
        sort_order: seg.sort_order ?? idx + 1
      }))
    };
    if (formId) {
      await api.put(`/action-plan/initiatives/${formId}`, payload);
    } else {
      await api.post("/action-plan/initiatives", payload);
    }
    resetForm();
    load();
  };

  const handleEdit = (initiative: Initiative) => {
    setFormId(initiative.id);
    setName(initiative.name);
    setSegments(
      initiative.segments.length
        ? initiative.segments.map((seg) => ({
            start_month: seg.start_month,
            end_month: seg.end_month,
            department: seg.department,
            sort_order: seg.sort_order ?? null
          }))
        : [emptySegment()]
    );
    setError(null);
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/action-plan/initiatives/${id}`);
    load();
  };

  return (
    <section className="card">
      <h1>Action Plan 2026</h1>
      <p className="muted">Manage initiatives and segment timelines for the IT Action Plan.</p>
      <form className="form" onSubmit={handleSubmit}>
        <input
          placeholder="Initiative name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="segments-block">
          <div className="segments-header">
            <strong>Segments</strong>
            <button type="button" className="btn ghost" onClick={handleAddSegment}>
              Add segment
            </button>
          </div>
          {segments.map((seg, idx) => (
            <div key={idx} className="segment-row">
              <select
                value={seg.department}
                onChange={(event) => handleSegmentChange(idx, { department: event.target.value })}
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
              <select
                value={seg.start_month}
                onChange={(event) => handleSegmentChange(idx, { start_month: Number(event.target.value) })}
              >
                {Array.from({ length: 12 }).map((_, monthIdx) => (
                  <option key={monthIdx + 1} value={monthIdx + 1}>
                    {monthIdx + 1}
                  </option>
                ))}
              </select>
              <select
                value={seg.end_month}
                onChange={(event) => handleSegmentChange(idx, { end_month: Number(event.target.value) })}
              >
                {Array.from({ length: 12 }).map((_, monthIdx) => (
                  <option key={monthIdx + 1} value={monthIdx + 1}>
                    {monthIdx + 1}
                  </option>
                ))}
              </select>
              <button type="button" className="btn ghost" onClick={() => handleRemoveSegment(idx)}>
                Remove
              </button>
            </div>
          ))}
        </div>
        {error && <div className="error-text">{error}</div>}
        <div className="actions">
          <button className="btn" type="submit">
            {formId ? "Update" : "Create"}
          </button>
          {formId && (
            <button type="button" className="btn ghost" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>
      <div className="list">
        {loading ? (
          <div className="list-item">Loading initiatives...</div>
        ) : (
          initiatives.map((initiative) => (
            <div key={initiative.id} className="list-item">
              <div>
                <h3>{initiative.name}</h3>
                <p>
                  {initiative.segments
                    .map((seg) => `${seg.department}: ${seg.start_month}-${seg.end_month}`)
                    .join(" · ")}
                </p>
              </div>
              <div className="actions">
                <button className="btn ghost" onClick={() => handleEdit(initiative)}>
                  Edit
                </button>
                <button className="btn ghost" onClick={() => handleDelete(initiative.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
