import { useEffect, useRef, useState } from "react";
import api from "../api";

export interface AnnouncementItem {
  id: string;
  source: "manual" | "uptime_kuma";
  kind?: "information" | "announcement" | "system_maintenance";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  status: "active" | "resolved" | "scheduled" | "expired";
  pinned?: boolean;
  service_name?: string | null;
}

export default function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    const load = () => {
      api.get("/status/summary").catch(() => undefined);
      api
        .get("/announcements")
        .then((res) => {
          if (!active) return;
          const list = Array.isArray(res.data?.announcements) ? res.data.announcements : [];
          setAnnouncements(list as AnnouncementItem[]);
        })
        .catch(() => {
          if (!active) return;
          setAnnouncements([]);
        });
    };

    const connect = () => {
      if (eventSourceRef.current) return;
      const source = new EventSource("/api/announcements/stream");
      eventSourceRef.current = source;
      source.addEventListener("announcements:update", () => {
        load();
      });
      source.onerror = () => {
        source.close();
        eventSourceRef.current = null;
      };
    };

    load();
    connect();
    timer = window.setInterval(load, 60_000);

    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  return announcements;
}
