import { useEffect, useMemo, useState } from "react";
import type { AnnouncementItem } from "../hooks/useAnnouncements";

interface AnnouncementBarProps {
  announcements: AnnouncementItem[];
}

export default function AnnouncementBar({ announcements }: AnnouncementBarProps) {
  const critical = useMemo(
    () =>
      announcements
        .filter((item) => item.severity === "critical" || item.source === "uptime_kuma")
        .map((item) => {
          const text = String(item.message || item.title || "").trim();
          if (!text) return "";
          return text;
        })
        .filter(Boolean),
    [announcements]
  );
  const cleaned = useMemo(
    () =>
      announcements
        .filter((item) => item.severity !== "critical" && item.source !== "uptime_kuma")
        .map((item) => {
          const text = String(item.message || item.title || "").trim();
          if (!text) return "";
          const typeLabel =
            item.kind === "information"
              ? "Information"
              : item.kind === "system_maintenance"
              ? "System Maintenance"
              : "Announcement";
          return item.source === "uptime_kuma" ? `System: ${text}` : `${typeLabel}: ${text}`;
        })
        .filter(Boolean),
    [announcements]
  );
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const visibleMs = 4000;
  const fadeMs = 1000;
  const gapMs = 0;

  useEffect(() => {
    if (cleaned.length <= 1) return;
    let timer = window.setTimeout(() => {
      setVisible(false);
      timer = window.setTimeout(() => {
        setIndex((current) => (current + 1) % cleaned.length);
        window.requestAnimationFrame(() => {
          setVisible(true);
        });
      }, fadeMs + gapMs);
    }, visibleMs);
    return () => window.clearTimeout(timer);
  }, [cleaned.length, index, visibleMs, fadeMs, gapMs]);

  useEffect(() => {
    setIndex(0);
    setVisible(true);
  }, [cleaned.join("|")]);

  if (cleaned.length === 0 && critical.length === 0) return null;

  return (
    <div
      className="announcement-bar"
      role="status"
      aria-live="polite"
      style={{
        ["--fade-duration" as string]: `${fadeMs}ms`,
      }}
    >
      {critical.length > 0 && (
        <div className="announcement-critical">
          {critical.join(" • ")}
        </div>
      )}
      {cleaned.length > 0 && (
        <div className="announcement-inner">
          {cleaned.length === 1 ? (
            <span className="announcement-text single">{cleaned[0]}</span>
          ) : (
            <span
              key={`${index}-current`}
              className={`announcement-text ${visible ? "fade-in" : "fade-out"}`}
            >
              {cleaned[index]}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
