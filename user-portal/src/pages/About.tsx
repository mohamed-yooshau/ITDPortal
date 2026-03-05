export default function About() {
  return (
    <section className="card">
      <div className="hero">
        <div>
          <h1>About the IT Team</h1>
          <p>We keep MTCC teams connected, supported, and secure with reliable technology.</p>
        </div>
      </div>
      <div className="about-grid">
        <div className="panel">
          <h3>What the IT Team Does</h3>
          <ul>
            <li>Service desk and incident management</li>
            <li>Device, network, and infrastructure support</li>
            <li>Business application enablement</li>
            <li>Security and access management</li>
          </ul>
        </div>
        <div className="panel">
          <h3>IT Action Plan 2026</h3>
          <p>See the initiatives roadmap and priorities for this year.</p>
          <a className="btn" href="/action-plan">Open Action Plan</a>
        </div>
      </div>
    </section>
  );
}
