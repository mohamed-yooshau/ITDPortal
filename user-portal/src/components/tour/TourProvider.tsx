import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { PortalSettings } from "../../hooks/useSettings";
import { buildTourSteps, TourStep } from "./tourSteps";
import TourOverlay from "./TourOverlay";
import { fetchUserExists } from "../../api/userExists";
import { fetchTourSteps } from "../../api/tour";

const TOUR_VERSION = "v1";
const TOUR_SEEN_KEY = "itportal_tour_seen";
const TOUR_VERSION_KEY = "itportal_tour_version";
const TOUR_EXISTS_CACHE = "itportal_tour_exists_checked";
const TOUR_EXISTS_VALUE = "itportal_tour_exists_value";

type TourContextValue = {
  startTour: (force?: boolean) => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used within TourProvider");
  }
  return ctx;
}

type TourProviderProps = {
  children: React.ReactNode;
  user: { email: string } | null;
  settings: PortalSettings;
};

const waitForElement = (selector: string, timeout = 2500): Promise<Element | null> => {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector(selector));
    }, timeout);
  });
};

export default function TourProvider({ children, user, settings }: TourProviderProps) {
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [checkedExists, setCheckedExists] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const pendingNavigation = useRef(false);

  const generateSteps = useCallback(() => buildTourSteps(settings, null), [settings]);

  const shouldAutoShow = useCallback(async () => {
    if (!user) return false;
    const seenKey = `${TOUR_SEEN_KEY}:${user.email}`;
    const versionKey = `${TOUR_VERSION_KEY}:${user.email}`;
    const cacheKey = `${TOUR_EXISTS_CACHE}:${user.email}`;
    const valueKey = `${TOUR_EXISTS_VALUE}:${user.email}`;
    if (!sessionStorage.getItem(cacheKey)) {
      const exists = await fetchUserExists();
      sessionStorage.setItem(cacheKey, "true");
      sessionStorage.setItem(valueKey, exists ? "true" : "false");
    }
    const existsValue = sessionStorage.getItem(valueKey) !== "false";
    if (existsValue) return false;
    const seen = localStorage.getItem(seenKey);
    const version = localStorage.getItem(versionKey);
    return !(seen && version === TOUR_VERSION);
  }, [user]);

  const startTour = useCallback(
    async (force = false) => {
      if (!user) return;
      const valueKey = `${TOUR_EXISTS_VALUE}:${user.email}`;
      const existsValue = sessionStorage.getItem(valueKey);
      if (!force && existsValue !== "false") return;
      const manual = await fetchTourSteps();
      const generated = manual.length ? manual : generateSteps();
      if (!generated.length) return;
      setSteps(generated);
      setActiveIndex(0);
      setOpen(true);
    },
    [generateSteps, user]
  );

  useEffect(() => {
    let active = true;
    if (!user || checkedExists) return;
    shouldAutoShow().then((show) => {
      if (!active) return;
      setCheckedExists(true);
      if (show) {
        startTour();
      }
    });
    return () => {
      active = false;
    };
  }, [user, checkedExists, shouldAutoShow, startTour]);

  useEffect(() => {
    if (!user) return;
    setCheckedExists(false);
  }, [user?.email]);

  useEffect(() => {
    const handleReplay = () => startTour(true);
    window.addEventListener("itportal-tour-replay", handleReplay);
    return () => window.removeEventListener("itportal-tour-replay", handleReplay);
  }, [startTour]);

  const currentStep = steps[activeIndex];

  useEffect(() => {
    if (!open || !currentStep) return;
    const ensureStep = async () => {
      if (currentStep.route && location.pathname !== currentStep.route) {
        if (!pendingNavigation.current) {
          pendingNavigation.current = true;
          navigate(currentStep.route, { replace: false });
        }
        return;
      }
      pendingNavigation.current = false;
      await waitForElement(currentStep.selector);
    };
    ensureStep();
  }, [open, currentStep, location.pathname, navigate]);

  const advance = useCallback(
    async (direction: 1 | -1) => {
      if (!steps.length) return;
      let idx = activeIndex + direction;
      while (idx >= 0 && idx < steps.length) {
        const step = steps[idx];
        if (step.route && step.route !== location.pathname) {
          setActiveIndex(idx);
          return;
        }
        const found = await waitForElement(step.selector, 800);
        if (found) {
          setActiveIndex(idx);
          return;
        }
        idx += direction;
      }
      if (idx >= steps.length && direction === 1) {
        finishTour();
      }
    },
    [steps, activeIndex, location.pathname]
  );

  const finishTour = useCallback(() => {
    if (user?.email) {
      localStorage.setItem(`${TOUR_SEEN_KEY}:${user.email}`, "true");
      localStorage.setItem(`${TOUR_VERSION_KEY}:${user.email}`, TOUR_VERSION);
    }
    setOpen(false);
  }, [user?.email]);

  const skipTour = useCallback(() => {
    if (user?.email) {
      localStorage.setItem(`${TOUR_SEEN_KEY}:${user.email}`, "true");
      localStorage.setItem(`${TOUR_VERSION_KEY}:${user.email}`, TOUR_VERSION);
    }
    setOpen(false);
  }, [user?.email]);

  const value = useMemo(() => ({ startTour }), [startTour]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {open && currentStep && (
        <TourOverlay
          step={currentStep}
          onNext={() => advance(1)}
          onPrev={() => advance(-1)}
          onClose={finishTour}
          onSkip={skipTour}
          isFirst={activeIndex === 0}
          isLast={activeIndex === steps.length - 1}
        />
      )}
    </TourContext.Provider>
  );
}
