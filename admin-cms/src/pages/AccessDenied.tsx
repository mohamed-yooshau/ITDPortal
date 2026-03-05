export default function AccessDenied() {
  return (
    <section className="card" style={{ textAlign: "center" }}>
      <h1 style={{ fontSize: "96px", letterSpacing: "0.08em", margin: 0 }}>NO</h1>
      <div style={{ width: "120px", height: "2px", background: "var(--glass-border)", margin: "16px auto" }} />
      <p className="muted">Access denied or page unavailable.</p>
    </section>
  );
}
