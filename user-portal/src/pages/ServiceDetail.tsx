import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";

interface Service {
  id: number;
  title: string;
  description: string;
  category: string | null;
  status: string;
  form_link?: string | null;
}

export default function ServiceDetail() {
  const { id } = useParams();
  const [service, setService] = useState<Service | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`/services/${id}`)
      .then((res) => setService(res.data.service))
      .catch(() => setError("Service not found"));
  }, [id]);

  if (error) {
    return <div className="card">{error}</div>;
  }

  if (!service) {
    return <div className="card">Loading...</div>;
  }

  return (
    <section className="card">
      <h1>{service.title}</h1>
      <p>{service.description}</p>
      <div className="meta">
        <span>Category: {service.category || "Uncategorized"}</span>
        <span className={`status ${service.status}`}>{service.status}</span>
      </div>
      {service.form_link && (
        <a className="btn" href={service.form_link} target="_blank" rel="noreferrer">
          Open Request Form
        </a>
      )}
    </section>
  );
}
