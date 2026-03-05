import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Step = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
};

type StepGuideProps = {
  title: string;
  subtitle?: string;
  steps: Step[];
  initialStep?: number;
};

export default function StepGuide({ title, subtitle, steps, initialStep = 0 }: StepGuideProps) {
  const [activeStep, setActiveStep] = useState(() =>
    Math.min(Math.max(initialStep, 0), Math.max(steps.length - 1, 0))
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const totalSteps = steps.length;
  const current = steps[activeStep];
  const canPrev = activeStep > 0;
  const canNext = activeStep < totalSteps - 1;
  const progress = useMemo(() => {
    if (!totalSteps) return 0;
    return Math.round(((activeStep + 1) / totalSteps) * 100);
  }, [activeStep, totalSteps]);

  const goToStep = (nextIndex: number) => {
    const safeIndex = Math.min(Math.max(nextIndex, 0), Math.max(totalSteps - 1, 0));
    setActiveStep(safeIndex);
    const nextImage = steps[safeIndex]?.imageUrl;
    setPreviewUrl(nextImage || null);
  };

  return (
    <div className="guide-shell">
      <div className="guide-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
      </div>
      <div className="guide-card">
        <div className="guide-progress">
          <span className="badge">Step {activeStep + 1} of {totalSteps || 1}</span>
          <span className="guide-percent">{progress}%</span>
          <div className="guide-bar">
            <div className="guide-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {current ? (
          <div className="guide-body">
            <div className="guide-copy">
              <h3>{current.title}</h3>
              <p>{current.content}</p>
            </div>
            {current.imageUrl && (
              <button
                type="button"
                className="guide-image"
                onClick={() => setPreviewUrl(current.imageUrl || null)}
                aria-label="View full size image"
              >
                <img src={current.imageUrl} alt={current.title} />
              </button>
            )}
          </div>
        ) : (
          <div className="guide-empty">No steps available.</div>
        )}

        <div className="guide-nav">
          <button
            type="button"
            onClick={() => setActiveStep((prev) => Math.max(prev - 1, 0))}
            disabled={!canPrev}
            aria-label="Previous step"
            className="btn secondary"
          >
            <ChevronLeft size={18} />
            <span className="guide-nav-text">Previous</span>
          </button>
          <div className="guide-dots" role="tablist">
            {steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                aria-label={`Go to step ${index + 1}`}
                onClick={() => setActiveStep(index)}
                className={`guide-dot${index === activeStep ? " active" : ""}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setActiveStep((prev) => Math.min(prev + 1, totalSteps - 1))}
            disabled={!canNext}
            aria-label="Next step"
            className="btn"
          >
            <span className="guide-nav-text">Next</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      {previewUrl && (
        <div className="guide-image-overlay" onClick={() => setPreviewUrl(null)}>
          <div className="guide-image-modal" onClick={(event) => event.stopPropagation()}>
            <img src={previewUrl} alt="Guide step" />
            <div className="guide-image-actions">
              <button
                type="button"
                className="btn ghost icon-btn"
                onClick={() => goToStep(activeStep - 1)}
                disabled={!canPrev}
                aria-label="Previous step"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="btn icon-btn"
                onClick={() => goToStep(activeStep + 1)}
                disabled={!canNext}
                aria-label="Next step"
              >
                <ChevronRight size={18} />
              </button>
              <button
                type="button"
                className="btn ghost icon-btn"
                onClick={() => setPreviewUrl(null)}
                aria-label="Close image"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
