import { useEffect, useState } from "react";
import api from "../api";

export default function Overview() {
  const [stats, setStats] = useState({ forms: 0, guides: 0 });

  useEffect(() => {
    Promise.all([api.get("/forms"), api.get("/admin/guides")])
      .then(([formsRes, guidesRes]) => {
        setStats({
          forms: Array.isArray(formsRes.data.forms) ? formsRes.data.forms.length : 0,
          guides: Array.isArray(guidesRes.data.guides) ? guidesRes.data.guides.length : 0
        });
      })
      .catch(() => setStats({ forms: 0, guides: 0 }));
  }, []);

  return (
    <section className="card">
      <h2 className="section-title">Portal Overview</h2>
      <div className="grid">
        <div className="panel">
          <h3>Forms</h3>
          <p>{stats.forms}</p>
        </div>
        <div className="panel">
          <h3>Guides</h3>
          <p>{stats.guides}</p>
        </div>
      </div>
    </section>
  );
}
