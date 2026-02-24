export type ActionPlanSegment = {
  start_month: number;
  end_month: number;
};

export type ActionPlanInitiative = {
  id: number;
  name: string;
  segments: ActionPlanSegment[];
};

export type QuarterInfo = {
  quarter: 1 | 2 | 3 | 4;
  year: number;
  startMonth: number;
  endMonth: number;
  label: string;
};

export type QuarterSummaryItem = {
  id: number;
  title: string;
  status: "Planned" | "In Progress" | "Done";
  progress: number;
};

export type QuarterSummary = {
  quarter: QuarterInfo["quarter"];
  year: number;
  label: string;
  limit: number;
  items: QuarterSummaryItem[];
};

export function getQuarterInfo(date: Date = new Date()): QuarterInfo {
  const month = date.getMonth() + 1;
  const quarter = (Math.floor((month - 1) / 3) + 1) as QuarterInfo["quarter"];
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const year = date.getFullYear();
  return {
    quarter,
    year,
    startMonth,
    endMonth,
    label: `Q${quarter} ${year}`
  };
}

function getOverlapMonths(
  segStart: number,
  segEnd: number,
  rangeStart: number,
  rangeEnd: number
): { start: number; end: number } | null {
  const start = Math.max(segStart, rangeStart);
  const end = Math.min(segEnd, rangeEnd);
  if (end < start) return null;
  return { start, end };
}

function calculateProgress(overlaps: Array<{ start: number; end: number }>, currentMonth: number): number {
  const totalMonths = overlaps.reduce((sum, seg) => sum + (seg.end - seg.start + 1), 0);
  if (!totalMonths) return 0;
  const elapsedMonths = overlaps.reduce((sum, seg) => {
    if (currentMonth < seg.start) return sum;
    if (currentMonth > seg.end) return sum + (seg.end - seg.start + 1);
    return sum + (currentMonth - seg.start + 1);
  }, 0);
  return Math.min(100, Math.max(0, Math.round((elapsedMonths / totalMonths) * 100)));
}

function determineStatus(overlaps: Array<{ start: number; end: number }>, currentMonth: number): QuarterSummaryItem["status"] {
  if (!overlaps.length) return "Planned";
  const hasCurrent = overlaps.some((seg) => currentMonth >= seg.start && currentMonth <= seg.end);
  if (hasCurrent) return "In Progress";
  const allFuture = overlaps.every((seg) => currentMonth < seg.start);
  if (allFuture) return "Planned";
  return "Done";
}

export function summarizeInitiativesForQuarter(
  initiatives: ActionPlanInitiative[],
  date: Date = new Date(),
  limit = 5
): QuarterSummary {
  const info = getQuarterInfo(date);
  const currentMonth = date.getMonth() + 1;
  const items: QuarterSummaryItem[] = initiatives
    .map((initiative) => {
      const overlaps = (initiative.segments || [])
        .map((segment) => getOverlapMonths(segment.start_month, segment.end_month, info.startMonth, info.endMonth))
        .filter((seg): seg is { start: number; end: number } => !!seg);
      if (!overlaps.length) return null;
      return {
        id: initiative.id,
        title: initiative.name,
        status: determineStatus(overlaps, currentMonth),
        progress: calculateProgress(overlaps, currentMonth)
      };
    })
    .filter((item): item is QuarterSummaryItem => !!item)
    .slice(0, limit);

  return {
    quarter: info.quarter,
    year: info.year,
    label: info.label,
    limit,
    items
  };
}
