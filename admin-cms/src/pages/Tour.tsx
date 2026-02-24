import { useEffect, useMemo, useState } from "react";
import { MdAdd, MdDelete, MdArrowUpward, MdArrowDownward } from "react-icons/md";
import api from "../api";

const placements = ["auto", "top", "bottom", "left", "right"] as const;

type TourStep = {
  id: string;
  title: string;
  body: string;
  selector: string;
  route?: string;
  placement?: string;
  enabled: boolean;
};

const createStep = (): TourStep => ({
  id: crypto.randomUUID(),
  title: "",
  body: "",
  selector: "",
  route: "",
  placement: "auto",
  enabled: true
});

export default function Tour() {
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSteps = () => {
    api
      .get("/admin/tour")
      .then((res) => {
        const data = Array.isArray(res.data?.steps) ? res.data.steps : [];
        const normalized = data.map((step: any) => ({
          id: String(step.id || crypto.randomUUID()),
          title: String(step.title || ""),
          body: String(step.body || ""),
          selector: String(step.selector || ""),
          route: step.route ? String(step.route) : "",
          placement: step.placement ? String(step.placement) : "auto",
          enabled: step.enabled !== false
        }));
        setSteps(normalized);
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 403) {
          setError("Access denied. Superadmin only.");
        } else {
          setError("Unable to load tour steps.");
        }
      });
  };

  useEffect(() => {
    loadSteps();
  }, []);

  const handleSave = async () => {
    setMessage(null);
    setError(null);
    try {
      await api.put("/admin/tour", { steps });
      setMessage("Tour saved.");
      loadSteps();
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.error;
      if (status === 403) {
        setError("Access denied. Superadmin only.");
      } else if (status === 401) {
        setError("Session expired. Please log in again.");
      } else if (detail) {
        setError(detail);
      } else {
        setError("Failed to save tour.");
      }
    }
  };

  const addStep = () => {
    setSteps((prev) => [...prev, createStep()]);
  };

  const updateStep = (index: number, patch: Partial<TourStep>) => {
    setSteps((prev) => prev.map((step, idx) => (idx === index ? { ...step, ...patch } : step)));
  };

  const moveStep = (index: number, direction: number) => {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, idx) => idx !== index));
  };

  const invalidCount = useMemo(
    () => steps.filter((step) => !step.title.trim() || !step.body.trim() || !step.selector.trim()).length,
    [steps]
  );

  return (
    <section className="card">
      <header className="page-header">
        <div>
          <h1>Tour</h1>
          <p>Define the onboarding tour steps shown to normal users.</p>
        </div>
        <button className="btn" onClick={handleSave}>Save</button>
      </header>
      {message && <div className="toast">{message}</div>}
      {error && <div className="toast error">{error}</div>}
      {invalidCount > 0 && (
        <p className="note">{invalidCount} step(s) missing title, body, or selector.</p>
      )}
      <div className="stack">
        {steps.map((step, index) => (
          <div key={step.id} className="panel">
            <div className="panel-header">
              <h3>Step {index + 1}</h3>
              <div className="panel-actions">
                <button className="btn ghost" onClick={() => moveStep(index, -1)} disabled={index === 0}>
                  <MdArrowUpward />
                </button>
                <button className="btn ghost" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1}>
                  <MdArrowDownward />
                </button>
                <button className="btn ghost" onClick={() => removeStep(index)}>
                  <MdDelete />
                </button>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Title
                <input
                  value={step.title}
                  onChange={(e) => updateStep(index, { title: e.target.value })}
                  placeholder="Step title"
                />
              </label>
              <label>
                Selector
                <input
                  value={step.selector}
                  onChange={(e) => updateStep(index, { selector: e.target.value })}
                  placeholder='e.g. [data-tour="nav-guides"]'
                />
              </label>
              <label>
                Body
                <textarea
                  value={step.body}
                  onChange={(e) => updateStep(index, { body: e.target.value })}
                  placeholder="Step instruction text"
                />
              </label>
              <label>
                Route (optional)
                <input
                  value={step.route || ""}
                  onChange={(e) => updateStep(index, { route: e.target.value })}
                  placeholder="/guides"
                />
              </label>
              <label>
                Placement
                <select
                  value={step.placement || "auto"}
                  onChange={(e) => updateStep(index, { placement: e.target.value })}
                >
                  {placements.map((place) => (
                    <option key={place} value={place}>{place}</option>
                  ))}
                </select>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={step.enabled}
                  onChange={(e) => updateStep(index, { enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>
          </div>
        ))}
      </div>
      <button className="btn ghost" onClick={addStep}>
        <MdAdd /> Add step
      </button>
    </section>
  );
}
