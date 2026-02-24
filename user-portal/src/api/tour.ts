import api from "../api";
import type { TourStep } from "../components/tour/tourSteps";

export async function fetchTourSteps(): Promise<TourStep[]> {
  try {
    const res = await api.get("/tour");
    const steps = Array.isArray(res.data?.steps) ? res.data.steps : [];
    return steps as TourStep[];
  } catch {
    return [];
  }
}
