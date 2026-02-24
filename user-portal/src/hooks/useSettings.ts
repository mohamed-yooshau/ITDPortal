import { useEffect, useState } from "react";
import api from "../api";

export interface PortalSettings {
  portal_title?: string;
  announcement?: string;
  nav_order_desktop?: string;
  footer_text?: string;
  local_login_enabled?: string;
  page_guides_enabled?: string;
  page_action_plan_enabled?: string;
  page_announcements_enabled?: string;
  page_tickets_enabled?: string;
  page_forms_enabled?: string;
  page_policies_enabled?: string;
  page_profile_enabled?: string;
  page_services_enabled?: string;
  page_status_enabled?: string;
  page_about_enabled?: string;
  home_start_title?: string;
  home_start_items?: string;
  home_operational_title?: string;
  home_operational_body?: string;
}

export default function useSettings() {
  const [settings, setSettings] = useState<PortalSettings>({});

  useEffect(() => {
    let active = true;
    api
      .get("/settings/public")
      .then((res) => {
        if (!active) return;
        setSettings(res.data.settings || {});
      })
      .catch(() => {
        if (!active) return;
        setSettings({});
      });
    return () => {
      active = false;
    };
  }, []);

  return settings;
}
