import { NavLink, useLocation } from "react-router-dom";
import useSettings from "../hooks/useSettings";
import { buildNavItems } from "../config/navItems";
import {
  BookIcon,
  FormIcon,
  HomeIcon,
  InfoIcon,
  PolicyIcon,
  StatusIcon,
  UserIcon,
  BriefcaseIcon,
  SearchIcon
} from "./NavIcons";
type MobileNavBarProps = {
  user?: { email?: string } | null;
  onOpenSearch?: () => void;
};

type NavItem = {
  id?: string;
  to: string;
  label: string;
  icon: JSX.Element;
  adminOnly?: boolean;
};

export default function MobileNavBar({ user, onOpenSearch }: MobileNavBarProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const settings = useSettings();
  const isPageEnabled = (key: keyof typeof settings) => settings[key] !== "false";

  if (pathname.startsWith("/login") || pathname.startsWith("/auth/callback")) {
    return null;
  }

  const itemsById: Record<string, NavItem> = {
    home: { to: "/", label: "Home", icon: <HomeIcon /> },
    search: { to: "/search", label: "Search", icon: <SearchIcon /> },
    guides: { to: "/guides", label: "Guides", icon: <BookIcon /> },
    about: { to: "/about", label: "About", icon: <InfoIcon /> },
    policies: { to: "/policies", label: "Policies", icon: <PolicyIcon /> },
    profile: { to: "/profile", label: "Profile", icon: <UserIcon /> },
    services: { to: "/services", label: "Services", icon: <BriefcaseIcon /> },
    status: { to: "/status", label: "Status", icon: <StatusIcon /> }
  };

  const navItems = buildNavItems(settings, null);
  const items = navItems
    .map((item) => ({ id: item.id, item: itemsById[item.id] }))
    .filter((entry) => !!entry.item)
    .map((entry) => ({ ...entry.item, id: entry.id }));

  if (!items.some((item) => item.id === "search") && itemsById.search) {
    items.push({ ...itemsById.search, id: "search" });
  }

  return (
    <nav className="mobile-dock" aria-label="Primary">
      {items.map((item) => (
        item.id === "search" && onOpenSearch ? (
          <button
            key={item.to}
            type="button"
            aria-label={item.label}
            data-tour={`nav-${item.id}`}
            className="mobile-dock-link"
            onClick={onOpenSearch}
          >
            <span className="mobile-dock-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="mobile-dock-indicator" aria-hidden="true" />
          </button>
        ) : (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            aria-label={item.label}
            data-tour={`nav-${item.id}`}
            className={({ isActive }) => `mobile-dock-link ${isActive ? "active" : ""}`}
          >
            <span className="mobile-dock-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="mobile-dock-indicator" aria-hidden="true" />
          </NavLink>
        )
      ))}
    </nav>
  );
}
