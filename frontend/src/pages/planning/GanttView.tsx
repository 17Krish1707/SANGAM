/**
 * GanttView — full-page interactive Gantt with day/week zoom toggle.
 * Reuses WeeklyGantt (which wraps GanttBars).
 * Click a block bar → inline popover with task list.
 */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import TopBar from '../../components/TopBar';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import PlanGenerator, { type PlanRunIds } from '../../components/planning/PlanGenerator';
import RunToggle, { type RunType } from '../../components/planning/RunToggle';
import GanttBars, { type GanttLane } from '../../components/GanttBars';
import { getPlan, type GeneratedBlock, type PlanDetail } from '../../lib/apiClient';

// ── helpers ───────────────────────────────────────────────────────────────────

function addDays(iso: string, n: number) {
  const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0];
}
function getMonday(iso: string) {
  const d = new Date(iso); const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); return d.toISOString().split('T')[0];
}

const OPERATING_TODAY = '2026-09-07';
const WEEK_START = getMonday(OPERATING_TODAY);

const DEPARTMENTS = [
  { code: 'ENG', label: 'Engineering' },
  { code: 'TRD', label: 'Traction' },
  { code: 'SNT', label: 'S&T' },
];

function severityVariant(s: string) {
  if (s === 'Critical' || s === 'High') return 'critical' as const;
  if (s === 'Medium') return 'warning' as const;
  return 'neutral' as const;
}

// ── block popover ─────────────────────────────────────────────────────────────

function BlockPopover({ block, onClose }: { block: GeneratedBlock; onClose: () => void }) {
  return (
    <div
      className="absolute z-50 bg-white border border-border rounded-card shadow-overlay w-72 p-4"
      style={{ top: 8, right: 8 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {block.section_name ?? block.section_id.slice(0, 8)}
          </p>
          <p className="text-xs text-text-secondary tabular-nums mt-0.5">
            {block.block_start.slice(11, 16)}–{block.block_end.slice(11, 16)}
            {' · '}{block.duration_min}m
            {block.is_joint_block && (
              <span className="ml-2 inline-flex items-center gap-0.5 text-accent">
                <Link2 className="w-3 h-3" /> Joint
              </span>
            )}
          </p>
        </div>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary text-xs">✕</button>
      </div>
      <div className="space-y-1.5 mt-2 max-h-48 overflow-y-auto">
        {block.tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-2 text-xs">
            <span className="font-medium text-text-primary w-24 flex-shrink-0 tabular-nums">{t.task_code}</span>
            <span className="text-text-secondary flex-1 truncate">{t.maintenance_type}</span>
            <StatusBadge variant={severityVariant(t.severity)} label={t.severity} />
            <span className="tabular-nums text-text-secondary">{t.priority_score?.toFixed(0)}</span>
          </div>
        ))}
        {block.tasks.length === 0 && <p className="text-xs text-text-secondary">No tasks.</p>}
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

type Zoom = 'week' | 'day';

export default function GanttView() {
  const [searchParams, setSearchParams] = useSearchParams();

  const runIds: Record<RunType, string | null> = {
    sangam_optimized:     searchParams.get('sangam'),
    independent_baseline: searchParams.get('ind'),
    greedy_baseline:      searchParams.get('greedy'),
  };

  const defaultRun: RunType =
    runIds.sangam_optimized     ? 'sangam_optimized'
    : runIds.independent_baseline ? 'independent_baseline'
    : 'sangam_optimized';

  const [activeRun, setActiveRun] = useState<RunType>(defaultRun);
  const [plan, setPlan]           = useState<PlanDetail | null>(null);
  const [loading, setLoading]     = useState(false);
  const [noRun, setNoRun]         = useState(false);
  const [zoom, setZoom]           = useState<Zoom>('week');
  const [zoomDay, setZoomDay]     = useState(OPERATING_TODAY);
  const [activeBlock, setActiveBlock] = useState<GeneratedBlock | null>(null);

  const activeRunId = runIds[activeRun];

  const load = useCallback(() => {
    if (!activeRunId) { setNoRun(true); setPlan(null); return; }
    setLoading(true); setNoRun(false);
    getPlan(activeRunId)
      .then(setPlan)
      .catch(() => setNoRun(true))
      .finally(() => setLoading(false));
  }, [activeRunId]);

  useEffect(() => { load(); }, [load]);

  function handleGenerated(ids: PlanRunIds) {
    const p = new URLSearchParams();
    if (ids.sangam_optimized)     p.set('sangam',  ids.sangam_optimized);
    if (ids.independent_baseline) p.set('ind',     ids.independent_baseline);
    if (ids.greedy_baseline)      p.set('greedy',  ids.greedy_baseline);
    setSearchParams(p);
    setActiveRun('sangam_optimized');
  }

  // derive range from zoom
  const rangeStart = zoom === 'week'
    ? `${WEEK_START}T00:00:00`
    : `${zoomDay}T00:00:00`;
  const rangeEnd = zoom === 'week'
    ? `${addDays(WEEK_START, 7)}T00:00:00`
    : `${zoomDay}T23:59:59`;

  const blocks = plan?.blocks ?? [];
  const visibleBlocks = blocks.filter(
    (b) => b.block_start >= rangeStart && b.block_start <= rangeEnd
  );

  const lanes: GanttLane[] = DEPARTMENTS.map((dept) => ({
    deptCode:  dept.code,
    deptLabel: dept.label,
    blocks: visibleBlocks.filter((b) => b.tasks.some((t) => t.department === dept.code)),
  }));

  // day labels for zoom day selector
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(WEEK_START, i);
    const label = new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
    return { iso, label };
  });

  return (
    <>
      <TopBar title="Gantt View" />
      <main className="flex-1 overflow-y-auto bg-panel p-6" onClick={() => setActiveBlock(null)}>
        <PlanGenerator onComplete={handleGenerated} />

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {Object.values(runIds).some(Boolean) && (
            <RunToggle runIds={runIds} selected={activeRun} onChange={setActiveRun} />
          )}

          {/* Zoom toggle */}
          <div className="flex items-center gap-0 border border-border rounded-md overflow-hidden text-xs ml-auto">
            {(['week', 'day'] as Zoom[]).map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-3 py-1.5 font-medium capitalize transition-colors
                  ${zoom === z ? 'bg-accent text-white' : 'bg-white text-text-secondary hover:bg-panel'}`}
              >
                {z}
              </button>
            ))}
          </div>

          {/* Day selector (only when zoomed to day) */}
          {zoom === 'day' && (
            <div className="flex items-center gap-1 flex-wrap">
              {weekDays.map((d) => (
                <button
                  key={d.iso}
                  onClick={() => setZoomDay(d.iso)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors
                    ${zoomDay === d.iso
                      ? 'bg-accent text-white border-accent'
                      : 'bg-white text-text-secondary border-border hover:bg-panel'}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Gantt panel */}
        {loading ? (
          <Panel><p className="text-sm text-text-secondary py-10 text-center">Loading…</p></Panel>
        ) : noRun ? (
          <Panel className="flex flex-col items-center py-10 gap-3">
            <p className="text-sm text-text-secondary">No plan found. Generate one above.</p>
          </Panel>
        ) : (
          <Panel className="relative overflow-visible">
            {lanes.some((l) => l.blocks.length > 0) ? (
              <GanttBars
                lanes={lanes}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                laneHeight={64}
                showTicks
                onBlockClick={(b) => setActiveBlock((prev) => prev?.id === b.id ? null : b)}
              />
            ) : (
              <p className="text-sm text-text-secondary py-8 text-center">
                No blocks in this {zoom === 'week' ? 'week' : 'day'}.
              </p>
            )}

            {/* Block popover — absolutely positioned inside Panel */}
            {activeBlock && (
              <BlockPopover block={activeBlock} onClose={() => setActiveBlock(null)} />
            )}

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-border flex items-center gap-5 text-xs text-text-secondary">
              <span className="flex items-center gap-1">
                <Link2 className="w-3 h-3 text-accent" /> Joint block (multi-dept)
              </span>
              <span>Click a bar to see task details</span>
              {plan && (
                <span className="ml-auto tabular-nums">
                  {plan.total_blocks} block{plan.total_blocks !== 1 ? 's' : ''} total
                </span>
              )}
            </div>
          </Panel>
        )}
      </main>
    </>
  );
}
