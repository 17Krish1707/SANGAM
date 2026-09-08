/**
 * WeeklyGantt — 3-lane Gantt spanning Mon–Sun of the selected week.
 * Used on the Overview dashboard (full-width panel).
 * Reused / extended in Phase 11 GanttView.
 */

import GanttBars, { type GanttLane } from './GanttBars';
import type { GeneratedBlock } from '../lib/apiClient';

const DEPARTMENTS = [
  { code: 'ENG', label: 'Engineering' },
  { code: 'TRD', label: 'Traction' },
  { code: 'SNT', label: 'S&T' },
];

interface WeeklyGanttProps {
  blocks: GeneratedBlock[];
  /** Monday ISO date string, e.g. "2026-09-07" */
  weekStart: string;
  onBlockClick?: (block: GeneratedBlock) => void;
  className?: string;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function WeeklyGantt({ blocks, weekStart, onBlockClick, className = '' }: WeeklyGanttProps) {
  const rangeStart = `${weekStart}T00:00:00`;
  const rangeEnd   = `${addDays(weekStart, 7)}T00:00:00`;

  const lanes: GanttLane[] = DEPARTMENTS.map((dept) => ({
    deptCode:  dept.code,
    deptLabel: dept.label,
    blocks: blocks.filter((b) =>
      b.tasks.some((t) => t.department === dept.code)
    ),
  }));

  const hasAnyBlock = lanes.some((l) => l.blocks.length > 0);

  if (!hasAnyBlock) {
    return (
      <div className="flex items-center justify-center h-20 text-sm text-text-secondary">
        No blocks in this week's plan.
      </div>
    );
  }

  return (
    <GanttBars
      lanes={lanes}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      laneHeight={52}
      showTicks
      onBlockClick={onBlockClick}
      className={className}
    />
  );
}
