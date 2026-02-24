import { useEffect, useState } from "react";
import api from "../api";
import useAuth from "../hooks/useAuth";
import { UserIcon } from "../components/NavIcons";

interface EmployeeProfile {
  name: string;
  rcno: number | string | null;
  division: string;
  email: string;
  designation?: string;
}

interface TicketSummary {
  ticketNumber: number;
  title: string;
  createdAt: string;
  url: string;
}

interface MicrosoftAccessPayload {
  outlookEmail: { hasAccess: boolean; note: string };
  officeApps: { desktop: boolean; web: boolean; note: string };
  teams: { hasAccess: boolean; note: string };
  project: { hasAccess: boolean; note: string };
  message?: string;
}

interface AutodeskEntitlement {
  productName: string;
  teamName?: string | null;
  status?: string | null;
  lastUsedAt?: string | null;
}

export default function Profile() {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [accessData, setAccessData] = useState<MicrosoftAccessPayload | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [autodesk, setAutodesk] = useState<AutodeskEntitlement[]>([]);
  const [autodeskLoading, setAutodeskLoading] = useState(false);
  const [autodeskError, setAutodeskError] = useState<string | null>(null);
  const [autodeskVisible, setAutodeskVisible] = useState(false);
  const isLocalUser = !!user?.email?.endsWith("@local");
  const shouldFetchAps = !!user && !isLocalUser;

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!shouldFetchAps) {
      setEmployee(null);
      setPhotoUrl(null);
      return;
    }
    api
      .get("/aps/me")
      .then((res) => {
        const data = res.data as EmployeeProfile;
        setEmployee(data);
        setError(null);
        const rcno = data?.rcno;
        if (rcno === undefined || rcno === null || rcno === "") {
          setPhotoUrl(null);
          return null;
        }
        return api.get(`/aps/photo/${encodeURIComponent(String(rcno))}`, { responseType: "blob" });
      })
      .then((response) => {
        if (!response || !active) return;
        objectUrl = URL.createObjectURL(response.data as Blob);
        setPhotoUrl(objectUrl);
      })
      .catch(() => {
        setEmployee(null);
        setError("Unable to load employee details.");
        setPhotoUrl(null);
      });
    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [shouldFetchAps]);

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

  useEffect(() => {
    if (!user) return;
    setAccessLoading(true);
    setAccessError(null);
    api
      .get("/profile/microsoft-access")
      .then((res) => setAccessData(res.data as MicrosoftAccessPayload))
      .catch((err) => {
        setAccessData(null);
        setAccessError(err?.response?.data?.message || "Unable to load Microsoft access details.");
      })
      .finally(() => setAccessLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setAutodeskLoading(true);
    setAutodeskError(null);
    api
      .get("/me/autodesk/licenses")
      .then((res) => {
        const rows = Array.isArray(res.data?.entitlements) ? res.data.entitlements : [];
        setAutodesk(rows);
        setAutodeskVisible(rows.length > 0);
      })
      .catch((err) => {
        setAutodesk([]);
        setAutodeskError(err?.response?.data?.message || "Unable to load Autodesk licenses.");
        setAutodeskVisible(true);
      })
      .finally(() => setAutodeskLoading(false));
  }, [user]);

  if (!user) {
    return <div className="card">Please log in to view your profile.</div>;
  }

  return (
    <section className="card profile-page">
      <div className="panel profile-panel profile-summary">
        <div className="profile-card-header">
          <div>
            <h2 className="section-title">Profile</h2>
            <p className="note">Your account details</p>
          </div>
          {shouldFetchAps && (
            <div className="profile-photo">
              <span className="profile-photo-frame" aria-hidden="true">
                {photoUrl ? <img src={photoUrl} alt="" /> : <UserIcon />}
              </span>
            </div>
          )}
        </div>
        {error && <p className="error">{error}</p>}
        <div className="profile-rows">
          <div className="profile-row">
            <span className="profile-label">Name</span>
            <span className="profile-value">{employee?.name || user.name}</span>
          </div>
          <div className="profile-row">
            <span className="profile-label">Email</span>
            <span className="profile-value">{employee?.email || user.email}</span>
          </div>
          <div className="profile-row">
            <span className="profile-label">RC Number</span>
            <span className="profile-value">{employee?.rcno ?? "—"}</span>
          </div>
          <div className="profile-row">
            <span className="profile-label">Division</span>
            <span className="profile-value">{employee?.division || "—"}</span>
          </div>
          <div className="profile-row">
            <span className="profile-label">Designation</span>
            <span className="profile-value">{employee?.designation || "Not available"}</span>
          </div>
        </div>
      </div>
      <div className="panel profile-panel">
        <h2 className="section-title">My Tickets</h2>
        {tickets.length === 0 ? (
          <p className="note">No tickets raised yet.</p>
        ) : (
          <div className="ticket-list">
            {tickets.slice(0, 5).map((ticket) => (
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
            <a className="ticket-more" href="https://helpdesk.mtcc.com.mv/my-tickets" target="_blank" rel="noreferrer">
              More of your tickets
            </a>
          </div>
        )}
      </div>
      <div className="panel profile-panel">
        <h2 className="section-title">Microsoft Access</h2>
        {accessLoading && (
          <div className="license-skeleton">
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
          </div>
        )}
        {!accessLoading && accessError && <p className="error">{accessError}</p>}
        {!accessLoading && accessData?.message && (
          <div className="info-banner">
            <p>{accessData.message}</p>
            <p className="note">Contact IT Support if you believe this is incorrect.</p>
          </div>
        )}
        {!accessLoading && accessData && (
          <div className="access-grid">
            <div className="access-row">
              <div>
                <strong>Outlook Email</strong>
                <span>{accessData.outlookEmail.note}</span>
              </div>
              <span className={`status-pill ${accessData.outlookEmail.hasAccess ? "ok" : "no"}`}>
                {accessData.outlookEmail.hasAccess ? "Yes" : "No"}
              </span>
            </div>
            <div className="access-row">
              <div>
                <strong>Office Apps</strong>
                <span>{accessData.officeApps.note}</span>
              </div>
              <span className={`status-pill ${accessData.officeApps.desktop || accessData.officeApps.web ? "ok" : "no"}`}>
                {accessData.officeApps.desktop && accessData.officeApps.web
                  ? "Desktop + Web"
                  : accessData.officeApps.web
                    ? "Web only"
                    : accessData.officeApps.desktop
                      ? "Desktop only"
                      : "No access"}
              </span>
            </div>
            <div className="access-row">
              <div>
                <strong>Microsoft Teams</strong>
                <span>{accessData.teams.note}</span>
              </div>
              <span className={`status-pill ${accessData.teams.hasAccess ? "ok" : "no"}`}>
                {accessData.teams.hasAccess ? "Yes" : "No"}
              </span>
            </div>
          </div>
        )}
      </div>
      {autodeskVisible && (
        <div className="panel profile-panel">
          <h2 className="section-title">Autodesk Licenses</h2>
          {autodeskLoading && (
            <div className="license-skeleton">
              <div className="skeleton-line" />
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
            </div>
          )}
          {!autodeskLoading && autodeskError && <p className="error">{autodeskError}</p>}
          {!autodeskLoading && !autodeskError && autodesk.length === 0 && (
            <p className="note">No Autodesk licenses assigned.</p>
          )}
          {!autodeskLoading && autodesk.length > 0 && (
            <div className="autodesk-list">
              {autodesk.map((item) => {
                const displayStatus =
                  item.status && !/verified/i.test(item.status) ? item.status : "Assigned";
                return (
                <div key={`${item.productName}-${item.teamName || ""}`} className="autodesk-item">
                  <div>
                    <strong>{item.productName}</strong>
                  </div>
                  <div className="autodesk-meta">
                    <span className="status-pill ok">{displayStatus}</span>
                    {item.lastUsedAt && (
                      <small>Last used {new Date(item.lastUsedAt).toLocaleDateString()}</small>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
