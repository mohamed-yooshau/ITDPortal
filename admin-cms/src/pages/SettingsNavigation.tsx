import { useEffect, useState } from "react";
import api from "../api";
import SettingsNav from "../components/SettingsNav";

const defaultNavOrder = ["home", "status", "guides", "services", "policies", "about", "profile"];

export default function SettingsNavigation() {
  const [navOrder, setNavOrder] = useState<string[]>(defaultNavOrder);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/settings")
      .then((res) => {
        const settings = res.data.settings || {};
        try {
          const parsed = JSON.parse(settings.nav_order_desktop || "[]");
          if (Array.isArray(parsed) && parsed.length) {
            const cleaned = parsed.filter((item: unknown) => typeof item === "string");
            const merged = [
              ...cleaned,
              ...defaultNavOrder.filter((item) => !cleaned.includes(item))
            ];
            setNavOrder(merged.length ? merged : defaultNavOrder);
            return;
          }
        } catch {
          // ignore
        }
        setNavOrder(defaultNavOrder);
      })
      .catch(() => undefined);
  }, []);

  const moveItem = (index: number, direction: number) => {
    setNavOrder((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    setMessage(null);
    await api.put("/settings", { navOrderDesktop: JSON.stringify(navOrder) });
    setMessage("Navigation order saved.");
  };

  return (
    <section className="card">
      <SettingsNav />
      <div className="panel">
        <h2>Navigation Order</h2>
        <p className="muted">Control the desktop navigation order in the user portal.</p>
        <div className="nav-order">
          {navOrder.map((item, index) => (
            <div key={item} className="nav-order-item">
              <span>{item}</span>
              <div className="row-actions">
                <button className="btn ghost" onClick={() => moveItem(index, -1)} disabled={index === 0}>
                  Up
                </button>
                <button
                  className="btn ghost"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === navOrder.length - 1}
                >
                  Down
                </button>
              </div>
            </div>
          ))}
        </div>
        <button className="btn primary" onClick={handleSave}>
          Save Navigation
        </button>
        {message && <p className="muted">{message}</p>}
      </div>
    </section>
  );
}
