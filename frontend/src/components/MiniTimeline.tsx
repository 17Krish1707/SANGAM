/**
 * MiniTimeline — today's block plan, 3 department lanes.
 * Shows blocks from the latest sangam_optimized run for TODAY only.
 * Wraps GanttBars with a fixed 00:00–24:00 time range for the current day.
 */

import GanttBars, { type GanttLane } from './GanttBars';
import type { GeneratedBlock } from '../lib/apiClient';

const DEPARTMENTS = [
  { code: 'ENG', label: 'Engineering' },
  { code: 'TRD', label: 'Traction' },
  { code: 'SNT', label: 'S&T' },
];

interface MiniTimelineProps {
  blocks: GeneratedBlock[];
  /** ISO date string for today, e.g. "2026-09-07" */
  today: string;
  onBlockClick?: (block: GeneratedBlock) => void;
}

export default function MiniTimeline({ blocks, today, onBlockClick }: MiniTimelineProps) {
  const rangeStart = `${today}T00:00:00`;
  const rangeEnd   = `${today}T23:59:59`;

  // Filter to today's blocks only
  const todayBlocks = blocks.filter((b) => b.block_start.startsWith(today));

  // Build one lane per department
  const lanes: GanttLane[] = DEPARTMENTS.map((dept) => ({
    deptCode:  dept.code,
    deptLabel: dept.label,
    blocks: todayBlocks.filter((b) =>
      b.tasks.some((t) => t.department === dept.code)
    ),
  }));

  const hasAnyBlock = lanes.some((l) => l.blocks.length > 0);

  if (!hasAnyBlock) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-text-secondary">
        No blocks scheduled for today.
      </div>
    );
  }

  return (
    <GanttBars
      lanes={lanes}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      laneHeight={44}
      showTicks
      onBlockClick={onBlockClick}
    />
  );
}
