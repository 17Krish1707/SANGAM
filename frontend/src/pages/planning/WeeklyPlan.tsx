/**
 * WeeklyPlan — day-by-day expandable block list (Mon–Sun).
 * Run IDs travel via URL search params: ?sangam=<id>&ind=<id>&greedy=<id>
 * PlanGenerator's onComplete handler navigates here with those params set.
 */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import TopBar from '../../components/TopBar';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import PlanGenerator, { type PlanRunIds } from '../../components/planning/PlanGenerator';
import RunToggle, { type RunType } from '../../components/planning/RunToggle';
import { getPlan, type GeneratedBlock, type PlanDetail } from '../../lib/apiClient';

// ── helpers ───────────────────────────────────────────────────────────────────

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function getMonday(iso: string): string {
  const d = new Date(iso);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

const DEMO_TODAY  = '2026-09-07';
const WEEK_START  = getMonday(DEMO_TODAY);
const DAY_LABELS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function buildWeekDays(monday: string): { label: string; iso: string }[] {
  return DAY_LABELS.map((label, i) => ({ label, iso: addDays(monday, i) }));
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
function fmtTime(iso: string) { return iso.slice(11, 16); }

function severityVariant(s: string) {
  if (s === 'Critical' || s === 'High') return 'critical' as const;
  if (s === 'Medium') return 'warning' as const;
  return 'neutral' as const;
}

const DEPT_TAG_CLS: Record<string, string> = {
  ENG: 'bg-blue-50  text-blue-700  border-blue-200',
  TRD: 'bg-amber-50 text-amber-700 border-amber-200',
  SNT: 'bg-green-50 text-green-700 border-green-200',
};
function DeptTag({ code }: { code: string }) {
  const cls = DEPT_TAG_CLS[code] ?? 'bg-panel text-text-secondary border-border';
  return (
    <span className={`inline-block px-1.5 py-0.5 text-2xs font-semibold rounded border ${cls}`}>
      {code}
    </span>
  );
}

// ── day row ───────────────────────────────────────────────────────────────────

function DayRow({ label, iso, blocks }: { label: string; iso: string; blocks: GeneratedBlock[] }) {
  const [expanded, setExpanded] = useState(blocks.length > 0);

  useEffect(() => setExpanded(blocks.length > 0), [blocks.length]);

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-panel transition-colors text-left"
      >
        {expanded
          ? <ChevronDown  className="w-4 h-4 text-text-secondary flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-text-secondary flex-shrink-0" />}
        <span className="text-sm font-semibold text-text-primary w-10">{label}</span>
        <span className="text-xs text-text-secondary tabular-nums">{fmt(iso)}</span>
        <span className="ml-auto text-xs text-text-secondary tabular-nums">
          {blocks.length === 0 ? 'No blocks' : `${blocks.length} block${blocks.length > 1 ? 's' : ''}`}
        </span>
      </button>

      {expanded && blocks.length > 0 && (
        <div className="px-5 pb-4 space-y-2">
          {blocks.map((b) => (
            <BlockCard key={b.id} block={b} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── block card ────────────────────────────────────────────────────────────────

function BlockCard({ block }: { block: GeneratedBlock }) {
  const [open, setOpen] = useState(false);

  // unique departments in this block
  const depts = [...new Set(block.tasks.map((t) => t.department))];

  return (
    <div className="bg-panel border border-border rounded-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white transition-colors"
      >
        {/* time */}
        <span className="text-xs tabular-nums font-medium text-text-primary w-28 flex-shrink-0">
          {fmtTime(block.block_start)}–{fmtTime(block.block_end)}
        </span>

        {/* section */}
        <span className="text-xs text-text-secondary truncate flex-1">
          {block.section_name ?? block.section_id.slice(0, 8)}
        </span>

        {/* dept tags */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {depts.map((d) => <DeptTag key={d} code={d} />)}
        </div>

        {/* joint indicator */}
        {block.is_joint_block && (
          <span title="Joint block">
            <Link2 className="w-3.5 h-3.5 text-accent flex-shrink-0" aria-label="Joint block" />
          </span>
        )}

        {/* task count */}
        <span className="text-xs text-text-secondary tabular-nums flex-shrink-0 w-16 text-right">
          {block.tasks_count} task{block.tasks_count !== 1 ? 's' : ''}
        </span>

        {open
          ? <ChevronDown  className="w-3.5 h-3.5 text-text-secondary flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-text-secondary flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-border pt-2">
          {block.tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 text-xs">
              <span className="font-medium text-text-primary w-24 flex-shrink-0 tabular-nums">{t.task_code}</span>
              <span className="text-text-secondary flex-1 truncate">{t.maintenance_type}</span>
              <DeptTag code={t.department} />
              <StatusBadge variant={severityVariant(t.severity)} label={t.severity} />
              <span className="tabular-nums text-text-secondary flex-shrink-0">{t.duration_min}m</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function WeeklyPlan() {
  const [searchParams, setSearchParams] = useSearchParams();

  const runIds: Record<RunType, string | null> = {
    sangam_optimized:     searchParams.get('sangam'),
    independent_baseline: searchParams.get('ind'),
    greedy_baseline:      searchParams.get('greedy'),
  };

  const defaultRun: RunType =
    runIds.sangam_optimized     ? 'sangam_optimized'
    : runIds.independent_baseline ? 'independent_baseline'
    : runIds.greedy_baseline      ? 'greedy_baseline'
    : 'sangam_optimized';

  const [activeRun, setActiveRun] = useState<RunType>(defaultRun);
  const [plan, setPlan]           = useState<PlanDetail | null>(null);
  const [loading, setLoading]     = useState(false);
  const [noRun, setNoRun]         = useState(false);

  const activeRunId = runIds[activeRun];

  const load = useCallback(() => {
    if (!activeRunId) { setNoRun(true); setPlan(null); return; }
    setLoading(true);
    setNoRun(false);
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

  const weekDays = buildWeekDays(WEEK_START);
  const blocksByDay: Record<string, GeneratedBlock[]> = {};
  for (const d of weekDays) blocksByDay[d.iso] = [];
  if (plan) {
    for (const b of plan.blocks) {
      const day = b.block_start.split('T')[0];
      if (blocksByDay[day]) blocksByDay[day].push(b);
    }
  }

  return (
    <>
      <TopBar title="Weekly Plan" />
      <main className="flex-1 overflow-y-auto bg-panel p-6">
        <PlanGenerator onComplete={handleGenerated} />

        {/* Run toggle */}
        {Object.values(runIds).some(Boolean) && (
          <div className="flex items-center justify-between mb-4">
            <RunToggle runIds={runIds} selected={activeRun} onChange={setActiveRun} />
            <div className="flex items-center gap-3">
              <Link
                to={`/planning/replan?${searchParams.toString()}`}
                className="text-xs text-text-secondary hover:text-text-primary font-medium border border-border rounded-md px-3 py-1.5 hover:bg-panel transition-colors"
              >
                Replanning Center
              </Link>
              <Link to="/reports" className="text-xs text-accent hover:text-accent-hover font-medium">
                Compare to baseline →
              </Link>
            </div>
          </div>
        )}

        {/* Day list */}
        {loading ? (
          <Panel><p className="text-sm text-text-secondary py-6 text-center">Loading plan…</p></Panel>
        ) : noRun ? (
          <Panel className="flex flex-col items-center py-10 gap-3">
            <p className="text-sm text-text-secondary">No plan available. Use the generator above to create one.</p>
          </Panel>
        ) : (
          <Panel className="overflow-hidden p-0">
            {weekDays.map((d) => (
              <DayRow key={d.iso} label={d.label} iso={d.iso} blocks={blocksByDay[d.iso] ?? []} />
            ))}
          </Panel>
        )}
      </main>
    </>
  );
}
