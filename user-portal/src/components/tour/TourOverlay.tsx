import { useEffect, useMemo, useState } from "react";
import { TourStep } from "./tourSteps";

export type TourOverlayProps = {
  step: TourStep;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onSkip: () => void;
  isFirst: boolean;
  isLast: boolean;
};

type Rect = { top: number; left: number; width: number; height: number };

const getRect = (el: Element): Rect => {
  const rect = el.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function TourOverlay({
  step,
  onNext,
  onPrev,
  onClose,
  onSkip,
  isFirst,
  isLast
}: TourOverlayProps) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  useEffect(() => {
    const el = document.querySelector(step.selector);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const rect = getRect(el);
    setTargetRect(rect);
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [step]);

  const tooltipStyle = useMemo(() => {
    if (!targetRect) return { top: "50%", left: "50%" };
    const padding = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const boxWidth = 320;
    const boxHeight = 160;
    const preferred = step.placement || "auto";
    let top = targetRect.top + targetRect.height + padding;
    let left = targetRect.left + targetRect.width / 2 - boxWidth / 2;

    if (preferred === "top") {
      top = targetRect.top - boxHeight - padding;
    } else if (preferred === "left") {
      top = targetRect.top + targetRect.height / 2 - boxHeight / 2;
      left = targetRect.left - boxWidth - padding;
    } else if (preferred === "right") {
      top = targetRect.top + targetRect.height / 2 - boxHeight / 2;
      left = targetRect.left + targetRect.width + padding;
    }

    top = clamp(top, padding, viewportHeight - boxHeight - padding);
    left = clamp(left, padding, viewportWidth - boxWidth - padding);
    return { top, left, width: boxWidth };
  }, [targetRect, step.placement]);

  return (
    <div className="tour-overlay" onKeyDown={(e) => e.key === "Escape" && onClose()} tabIndex={-1}>
      {targetRect && (
        <div
          className="tour-spotlight"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height
          }}
        />
      )}
      <div className="tour-tooltip" style={tooltipStyle} role="dialog" aria-live="polite">
        <div className="tour-tooltip-header">
          <h4>{step.title}</h4>
          <button className="tour-close" onClick={onClose} aria-label="Close tour">
            ×
          </button>
        </div>
        <p>{step.body}</p>
        <div className="tour-actions">
          <button className="btn ghost" onClick={onSkip}>Skip</button>
          <div className="tour-nav">
            <button className="btn ghost" onClick={onPrev} disabled={isFirst}>Back</button>
            <button className="btn" onClick={onNext}>{isLast ? "Done" : "Next"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
