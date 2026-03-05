import { useEffect, useState } from "react";

export default function WelcomeOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("itportal_welcome_seen");
    if (!seen) setOpen(true);
  }, []);

  const close = () => {
    localStorage.setItem("itportal_welcome_seen", "true");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="welcome-overlay" role="dialog" aria-modal="true">
      <div className="welcome-card">
        <h2>Welcome to the IT Portal</h2>
        <p>Here is a quick guide to get you started:</p>
        <ol>
          <li>Browse Guides for quick fixes.</li>
          <li>Use ITD services to submit requests.</li>
          <li>Check Profile for your role and access.</li>
        </ol>
        <button className="btn" onClick={close}>Got it</button>
      </div>
    </div>
  );
}
