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
  const [form, setForm] = useState({ id: 0, title: "", type: "generic", url: "", description: "" });

  const load = () => {
    api
      .get("/forms")
      .then((res) => setForms(Array.isArray(res.data.forms) ? res.data.forms : []))
      .catch(() => setForms([]));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { title: form.title, type: form.type, url: form.url, description: form.description };
    if (form.id) {
      await api.put(`/admin/forms/${form.id}`, payload);
    } else {
      await api.post("/admin/forms", payload);
    }
    setForm({ id: 0, title: "", type: "generic", url: "", description: "" });
    load();
  };

  const handleEdit = (item: FormLink) => {
    setForm({
      id: item.id,
      title: item.title,
      type: item.type,
      url: item.url,
      description: item.description || ""
    });
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/admin/forms/${id}`);
    load();
  };

  return (
    <section className="card">
      <h1>Forms & Lists</h1>
      <form className="form" onSubmit={handleSubmit}>
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <input value="Generic" disabled />
        <input
          placeholder="URL"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
        />
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <button className="btn" type="submit">{form.id ? "Update" : "Create"}</button>
      </form>
      <div className="list">
        {forms.map((item) => (
          <div key={item.id} className="list-item">
            <div>
              <h3>{item.title}</h3>
              <p>{item.type}</p>
            </div>
            <div className="actions">
              <button className="btn ghost" onClick={() => handleEdit(item)}>Edit</button>
              <button className="btn ghost" onClick={() => handleDelete(item.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
