import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import useSettings from "../hooks/useSettings";
import useAnnouncements from "../hooks/useAnnouncements";
import ThemeToggle from "./ThemeToggle";
import CreateTicketModal from "./CreateTicketModal";
import MobileNavBar from "./MobileNavBar";
import {
  HelpdeskIcon,
  UserIcon,
  SearchIcon
} from "./NavIcons";
import AnnouncementBar from "./AnnouncementBar";
import { buildNavItems, navEnabledMap } from "../config/navItems";
import GlobalSearchOverlay from "./GlobalSearch";

interface LayoutProps {
  user: { email: string } | null;
}

export default function Layout({ user }: LayoutProps) {
  const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [footerPop, setFooterPop] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useSettings();

  const desktopNavItems = useMemo(
    () => buildNavItems(settings, null),
    [settings]
  );

  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => {
        const apiUser = res.data.user || {};
        setUserInfo({
          name: apiUser.name || apiUser.email || "User",
          email: apiUser.email || ""
        });
      })
      .catch(() => setUserInfo(null));
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!user?.email) {
      setAvatarUrl(null);
      return;
    }
    api
      .get("/aps/me")
      .then((res) => {
        const rcno = res.data?.rcno;
        if (rcno === undefined || rcno === null || rcno === "") {
          setAvatarUrl(null);
          return;
        }
        return api.get(`/aps/photo/${encodeURIComponent(String(rcno))}`, { responseType: "blob" });
      })
      .then((response) => {
        if (!response || !active) return;
        objectUrl = URL.createObjectURL(response.data as Blob);
        setAvatarUrl(objectUrl);
      })
      .catch(() => setAvatarUrl(null));
    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [user?.email]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (event.target instanceof Node && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

  useEffect(() => {
    const node = footerRef.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setFooterPop(entry?.isIntersecting ?? false);
      },
      { root: null, threshold: 0.35 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handleLogin = async () => {
    navigate("/login");
  };

  const handleLogout = async () => {
    setUserInfo(null);
    await api.post("/auth/logout");
    window.dispatchEvent(new Event("itportal-auth-changed"));
    sessionStorage.setItem("itportal_logout_user", "1");
    setMenuOpen(false);
    navigate("/login");
  };

  const announcements = useAnnouncements();
  const hasCriticalSystem = announcements.some(
    (item) => item.source === "uptime_kuma" && item.severity === "critical" && item.status === "active"
  );
  const isPageEnabled = (key: keyof typeof settings) => settings[key] !== "false";

  const adminPath = import.meta.env.VITE_ADMIN_PATH || "secure-admin";
  const adminBase = adminPath.startsWith("/") ? adminPath : `/${adminPath}`;

  return (
    <div className={`layout ${announcements.length ? "has-announcement" : ""}`}>
      {isPageEnabled("page_announcements_enabled") && <AnnouncementBar announcements={announcements} />}
      {isPageEnabled("page_announcements_enabled") && hasCriticalSystem && (
        <div className="banner banner-critical" role="alert">
          Some services are currently experiencing issues. Our team is investigating.
        </div>
      )}
      <header className="header minimal">
        <div className="brand minimal-brand">
          <span>{settings.portal_title || "Portal"}</span>
        </div>
        <nav className="nav">
          {desktopNavItems
            .filter((item) => {
              const key = navEnabledMap[item.id];
              return key ? isPageEnabled(key) : true;
            })
            .map((item) => (
              item.id === "search" ? (
                <button
                  key={item.id}
                  type="button"
                  className="nav-link nav-link-icon"
                  data-tour={`nav-${item.id}`}
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search"
                >
                  <span className="nav-icon" aria-hidden="true">
                    <SearchIcon />
                  </span>
                </button>
              ) : (
                <NavLink
                  key={item.id}
                  to={item.to}
                  end={item.to === "/"}
                  data-tour={`nav-${item.id}`}
                  className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
                >
                  {item.id === "search" && (
                    <span className="nav-icon" aria-hidden="true">
                      <SearchIcon />
                    </span>
                  )}
                  {item.label}
                </NavLink>
              )
            ))}
        </nav>
        <div className="profile" ref={menuRef}>
          {userInfo ? (
            <>
              <button
                className="btn ticket-button-label"
                onClick={() => setTicketOpen(true)}
                aria-label="Raise ticket"
                data-tour="raise-ticket"
                type="button"
              >
                Raise Ticket
              </button>
              <button
                className="avatar-button"
                onClick={() => setMenuOpen((current) => !current)}
                aria-label="Open profile menu"
              >
                <span className="avatar" aria-hidden="true">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="avatar-image" />
                  ) : (
                    <UserIcon />
                  )}
                </span>
              </button>
              {menuOpen && (
                <div className="profile-menu">
                  <div className="profile-meta">
                    <strong>{userInfo.name}</strong>
                  </div>
                  <div className="profile-actions">
                    <ThemeToggle />
                    <button
                      className="menu-link"
                      type="button"
                      onClick={() => window.dispatchEvent(new Event("itportal-tour-replay"))}
                    >
                      Replay Tour
                    </button>
                    <button className="menu-link" onClick={handleLogout}>Logout</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button className="menu-link" onClick={handleLogin}>Login</button>
          )}
        </div>
      </header>
      <CreateTicketModal open={ticketOpen} onClose={() => setTicketOpen(false)} />
      <GlobalSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <main className="content scroll-bounce">
        <div key={location.pathname} className="page-transition">
          <Outlet />
        </div>
      </main>
      <MobileNavBar user={user} onOpenSearch={() => setSearchOpen(true)} />
      <footer ref={footerRef} className={`footer footer-bubble ${footerPop ? "is-pop" : ""}`}>
        <span>{settings.footer_text || "BUILT BY ITD ITOPS © 2026"}</span>
      </footer>
    </div>
  );
}
