import { useEffect, useState } from "react";
import api from "../api";

interface FormLink {
  id: number;
  title: string;
  type: string;
  url: string;
  description?: string;
}

export default function Forms() {
  const [forms, setForms] = useState<FormLink[]>([]);
  const [query, setQuery] = useState("");
  const filtered = forms.filter((form) => {
    const haystack = `${form.title} ${form.description || ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  useEffect(() => {
    api
      .get("/forms")
      .then((res) => setForms(Array.isArray(res.data.forms) ? res.data.forms : []))
      .catch(() => setForms([]));
  }, []);

  return (
    <section className="card">
      <h1>Forms</h1>
      <input
        type="text"
        placeholder="Search forms"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="list forms-list">
        {filtered.map((form) => (
          <a key={form.id} href={form.url} target="_blank" rel="noreferrer" className="link-card form-card">
            <h4>{form.title}</h4>
            {form.description && <p>{form.description}</p>}
          </a>
        ))}
        {forms.length === 0 && <p>No links available.</p>}
        {forms.length > 0 && filtered.length === 0 && <p>No forms match your search.</p>}
      </div>
    </section>
  );
}
