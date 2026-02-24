import { useEffect, useState } from "react";
import api from "../api";
import TicketStatusSummary from "../components/TicketStatusSummary";
import useAuth from "../hooks/useAuth";
import HomepageActionPlanCard from "../components/HomepageActionPlanCard";

interface StatusMonitor {
  id: number;
  name: string;
  status: "up" | "down" | "pending" | "unknown";
}

interface TicketSummary {
  ticketNumber: number;
  title: string;
  createdAt: string;
  url: string;
}

export default function Home() {
  const { user } = useAuth();
  const [actionPlanLabel, setActionPlanLabel] = useState("");
  const [monitors, setMonitors] = useState<StatusMonitor[]>([]);
  const [statusError, setStatusError] = useState("");
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [collapsed, setCollapsed] = useState({
    actionPlan: false,
    health: false,
    desk: false,
  });
  const SERVICE_HEALTH_VISIBLE = 6;
  const SERVICE_DESK_VISIBLE = 4;

  useEffect(() => {
    api
      .get("/status/summary")
      .then((res) => {
        const items = Array.isArray(res.data.monitors) ? res.data.monitors : [];
        setMonitors(items);
        setStatusError(res.data.message || "");
      })
      .catch((err) => {
        setMonitors([]);
        setStatusError(err.response?.data?.message || "Unable to load status.");
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    api
      .get("/helpdesk/tickets")
      .then((res) => {
        const rows = Array.isArray(res.data?.tickets) ? res.data.tickets : [];
        setTickets(rows);
      })
      .catch(() => setTickets([]));
  }, [user]);


  return (
    <section className="card home">
      <div className="dashboard-header">
        {user?.name ? (
          <div className="hero-welcome">
            <h2 className="welcome-title">
              Welcome, <span className="welcome-name">{user.name}</span>
            </h2>
            <p className="welcome-subtitle">ITD Operations Overview</p>
          </div>
        ) : null}
        <span className="hotline-pill">
          <svg className="hotline-pill-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M35.5,16A15.517,15.517,0,0,1,20,.5a.5.5,0,0,1,.5-.5h2.845a1.849,1.849,0,0,1,1.317.546l1.962,1.961a1.5,1.5,0,0,1,0,2.122L25.2,6.048A11.907,11.907,0,0,0,29.952,10.8l1.419-1.42a1.5,1.5,0,0,1,2.121,0l1.962,1.962A1.852,1.852,0,0,1,36,12.656V15.5A.5.5,0,0,1,35.5,16ZM21.009,1A14.52,14.52,0,0,0,35,14.992V12.656a.859.859,0,0,0-.253-.611l-1.962-1.962a.5.5,0,0,0-.707,0L30.4,11.763a.5.5,0,0,1-.578.093A12.893,12.893,0,0,1,24.145,6.18a.5.5,0,0,1,.092-.579l1.68-1.679a.5.5,0,0,0,0-.708L23.955,1.253A.858.858,0,0,0,23.345,1Z"
              transform="translate(-20)"
            />
          </svg>
          Hotline 123
        </span>
      </div>
      <div className="hero-stack">
        <TicketStatusSummary />
      </div>
      <div className="home-grid">
        <div className={`panel ${collapsed.actionPlan ? "collapsed" : ""}`}>
          <div className="panel-header">
            <h3>Action Plan</h3>
            <div className="panel-actions">
              {actionPlanLabel ? <span className="quarter-pill">{actionPlanLabel}</span> : null}
              <button
                type="button"
                className="panel-toggle"
                onClick={() => setCollapsed((prev) => ({ ...prev, actionPlan: !prev.actionPlan }))}
              >
                {collapsed.actionPlan ? "Show" : "Hide"}
              </button>
            </div>
          </div>
          <div className="panel-body">
            <HomepageActionPlanCard onLabelChange={setActionPlanLabel} />
          </div>
          <div className="panel-footer">
            <button
              type="button"
              className="panel-footer-link"
              onClick={() => window.location.assign("/action-plan")}
            >
              View all →
            </button>
          </div>
        </div>
        <div className={`panel ${collapsed.health ? "collapsed" : ""}`}>
          <div className="panel-header">
            <h3>Service Health</h3>
            <div className="panel-actions">
              <span className="meta-pill">Live snapshot</span>
              <button
                type="button"
                className="panel-toggle"
                onClick={() => setCollapsed((prev) => ({ ...prev, health: !prev.health }))}
              >
                {collapsed.health ? "Show" : "Hide"}
              </button>
            </div>
          </div>
          <div className="panel-body">
            {statusError ? (
              <p className="muted">{statusError}</p>
            ) : monitors.length ? (
              <div className="monitor-card-list">
                {monitors
                  .slice()
                  .sort((a, b) => {
                    const rank = (status: StatusMonitor["status"]) => (status === "down" ? 0 : status === "pending" ? 1 : 2);
                    const diff = rank(a.status) - rank(b.status);
                    if (diff !== 0) return diff;
                    return a.name.localeCompare(b.name);
                  })
                  .slice(0, SERVICE_HEALTH_VISIBLE)
                  .map((monitor) => (
                  <div key={monitor.id} className="monitor-card-item">
                    <div className="monitor-card-title">
                      <span title={monitor.name}>{monitor.name}</span>
                      {monitor.status === "up" ? (
                        <span className="status-dot status-up" aria-hidden="true" />
                      ) : monitor.status === "down" ? (
                        <span className="status-dot status-down" aria-hidden="true" />
                      ) : (
                        <span className="status-dot status-pending" aria-hidden="true" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No monitors available.</p>
            )}
          </div>
          <div className="panel-footer">
            <button
              type="button"
              className="panel-footer-link"
              onClick={() => window.location.assign("/status")}
            >
              View all →
            </button>
          </div>
        </div>
        <div className={`panel ${collapsed.desk ? "collapsed" : ""}`}>
          <div className="panel-header">
            <h3>Service Desk</h3>
            <div className="panel-actions">
              <button
                type="button"
                className="panel-toggle"
                onClick={() => setCollapsed((prev) => ({ ...prev, desk: !prev.desk }))}
              >
                {collapsed.desk ? "Show" : "Hide"}
              </button>
            </div>
          </div>
          <div className="panel-body">
            <p>Reach out when you need escalation or urgent support.</p>
            {tickets.length === 0 ? (
              <p className="note">No tickets raised yet.</p>
            ) : (
              <div className="ticket-list panel-list">
                {tickets.slice(0, SERVICE_DESK_VISIBLE).map((ticket) => (
                  <a
                    key={ticket.ticketNumber}
                    className="ticket-item"
                    href={ticket.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>Ticket #{ticket.ticketNumber}</span>
                    <small>{ticket.title}</small>
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="panel-footer">
            <a
              className="panel-footer-link"
              href="https://helpdesk.mtcc.com.mv/my-tickets"
              target="_blank"
              rel="noreferrer"
            >
              More tickets →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
