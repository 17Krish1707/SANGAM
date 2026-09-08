/**
 * GanttBars — shared timeline bar component used by Overview (mini + weekly)
 * and reused in Phase 11 GanttView.
 *
 * Renders N department lanes, each containing horizontal bars whose
 * position and width are derived from (start - rangeStart) / totalDuration.
 * All layout is pure CSS — no chart library.
 */

import { Link2 } from 'lucide-react';
import type { GeneratedBlock } from '../lib/apiClient';

// ── colour palette per department (muted, enterprise-appropriate) ──────────
export const DEPT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  ENG: { bg: '#DBEAFE', border: '#93C5FD', text: '#1D4ED8' },   // blue tint
  TRD: { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E' },   // amber tint
  SNT: { bg: '#D1FAE5', border: '#6EE7B7', text: '#065F46' },   // green tint
  GEN: { bg: '#EEF1F5', border: '#CBD5E1', text: '#475467' },   // neutral
};

export function deptColor(code: string) {
  return DEPT_COLORS[code] ?? DEPT_COLORS.GEN;
}

export interface GanttLane {
  deptCode: string;
  deptLabel: string;
  blocks: GeneratedBlock[];
}

interface GanttBarsProps {
  lanes: GanttLane[];
  /** ISO string — left edge of the timeline */
  rangeStart: string;
  /** ISO string — right edge of the timeline */
  rangeEnd: string;
  /** Height of each lane row in px */
  laneHeight?: number;
  /** Show hour tick marks on the x-axis */
  showTicks?: boolean;
  /** Called when user clicks a block bar */
  onBlockClick?: (block: GeneratedBlock) => void;
  className?: string;
}

function pct(ts: string, start: number, total: number): number {
  return Math.max(0, Math.min(100, ((new Date(ts).getTime() - start) / total) * 100));
}

function widthPct(block: GeneratedBlock, start: number, total: number): number {
  const left = pct(block.block_start, start, total);
  const right = pct(block.block_end, start, total);
  return Math.max(right - left, 0.5); // minimum visible width
}

/** Generate hour or day tick positions (returns array of { pct, label }) */
function buildTicks(
  rangeStart: number,
  rangeEnd: number,
): { pct: number; label: string }[] {
  const total = rangeEnd - rangeStart;
  const hours = total / (1000 * 60 * 60);
  const ticks: { pct: number; label: string }[] = [];

  if (hours <= 24) {
    // hourly ticks
    const start = new Date(rangeStart);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    while (start.getTime() < rangeEnd) {
      ticks.push({
        pct: ((start.getTime() - rangeStart) / total) * 100,
        label: start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      });
      start.setHours(start.getHours() + 2);
    }
  } else {
    // day ticks
    const start = new Date(rangeStart);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + 1);
    while (start.getTime() < rangeEnd) {
      ticks.push({
        pct: ((start.getTime() - rangeStart) / total) * 100,
        label: start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
      });
      start.setDate(start.getDate() + 1);
    }
  }
  return ticks;
}

export default function GanttBars({
  lanes,
  rangeStart,
  rangeEnd,
  laneHeight = 48,
  showTicks = true,
  onBlockClick,
  className = '',
}: GanttBarsProps) {
  const startMs = new Date(rangeStart).getTime();
  const endMs   = new Date(rangeEnd).getTime();
  const total   = endMs - startMs;

  if (total <= 0) return null;

  const ticks = showTicks ? buildTicks(startMs, endMs) : [];

  return (
    <div className={`select-none ${className}`}>
      {/* lanes */}
      {lanes.map((lane) => {
        const color = deptColor(lane.deptCode);
        return (
          <div key={lane.deptCode} className="flex items-center" style={{ height: laneHeight }}>
            {/* label */}
            <div
              className="flex-shrink-0 w-24 pr-3 text-xs font-medium text-text-secondary text-right"
              title={lane.deptLabel}
            >
              {lane.deptLabel}
            </div>

            {/* track */}
            <div className="flex-1 relative bg-panel rounded" style={{ height: laneHeight - 16 }}>
              {/* vertical tick lines */}
              {ticks.map((t) => (
                <div
                  key={t.pct}
                  className="absolute top-0 bottom-0 border-l border-border"
                  style={{ left: `${t.pct}%` }}
                />
              ))}

              {/* block bars */}
              {lane.blocks.map((block) => {
                const left  = pct(block.block_start, startMs, total);
                const width = widthPct(block, startMs, total);
                return (
                  <div
                    key={block.id}
                    className="absolute top-1 bottom-1 rounded flex items-center overflow-hidden cursor-pointer group"
                    style={{
                      left:    `${left}%`,
                      width:   `${width}%`,
                      backgroundColor: color.bg,
                      border:  `1px solid ${color.border}`,
                    }}
                    title={`${block.section_name ?? ''} | ${block.block_start.slice(11, 16)}–${block.block_end.slice(11, 16)} | ${block.tasks_count} task(s)`}
                    onClick={() => onBlockClick?.(block)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onBlockClick?.(block)}
                  >
                    {/* joint-block indicator */}
                    {block.is_joint_block && (
                      <Link2
                        className="w-2.5 h-2.5 mx-0.5 flex-shrink-0"
                        style={{ color: color.text }}
                        aria-label="Joint block"
                      />
                    )}
                    <span
                      className="text-2xs px-1 truncate leading-none font-medium"
                      style={{ color: color.text }}
                    >
                      {block.section_name ?? block.section_id.slice(0, 6)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* x-axis tick labels */}
      {showTicks && ticks.length > 0 && (
        <div className="flex items-start pl-24">
          <div className="flex-1 relative h-5">
            {ticks.map((t) => (
              <span
                key={t.pct}
                className="absolute text-2xs text-text-secondary -translate-x-1/2"
                style={{ left: `${t.pct}%` }}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
