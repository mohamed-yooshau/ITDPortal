import { buildNavItems } from "../../config/navItems";
import type { PortalSettings } from "../../hooks/useSettings";

export type TourStep = {
  selector: string;
  title: string;
  body: string;
  route?: string;
  placement?: "top" | "bottom" | "left" | "right" | "auto";
};

export function buildTourSteps(settings: PortalSettings, role?: string | null): TourStep[] {
  const steps: TourStep[] = [];
  const navItems = buildNavItems(settings, role).filter((item) => item.id !== "home");

  steps.push({
    selector: '[data-tour="nav-home"]',
    title: "Welcome to ITD Portal",
    body: "This is your Home. Quick links and announcements appear here.",
    route: "/",
    placement: "bottom"
  });

  navItems.forEach((item) => {
    if (item.id === "guides") {
      steps.push({
        selector: '[data-tour="nav-guides"]',
        title: "Browse Guides",
        body: "Tap here to browse step-by-step Guides.",
        route: item.to
      });
    } else if (item.id === "policies") {
      steps.push({
        selector: '[data-tour="nav-policies"]',
        title: "Policies & Procedures",
        body: "Access policies and procedures in one place.",
        route: item.to
      });
    } else if (item.id === "services") {
      steps.push({
        selector: '[data-tour="nav-services"]',
        title: "Self Services",
        body: "Use self-service tools like IP check and speed test.",
        route: item.to
      });
    } else if (item.id === "status") {
      steps.push({
        selector: '[data-tour="nav-status"]',
        title: "Service Status",
        body: "Check live service availability here.",
        route: item.to
      });
    } else if (item.id === "about") {
      steps.push({
        selector: '[data-tour="nav-about"]',
        title: "About ITD",
        body: "Browse internal guides, policies, and tools.",
        route: item.to
      });
    } else if (item.id === "profile") {
      steps.push({
        selector: '[data-tour="nav-profile"]',
        title: "Your Profile",
        body: "Your profile has your details and tools.",
        route: item.to
      });
    }
  });

  steps.push({
    selector: '[data-tour="raise-ticket"]',
    title: "Raise a Ticket",
    body: "Use this button to raise a Helpdesk ticket.",
    route: "/",
    placement: "left"
  });

  return steps;
}
