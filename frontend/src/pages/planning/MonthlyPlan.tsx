/**
 * MonthlyPlan — capacity rollup view.
 * One row per week within the horizon: block-hours per department + high-risk section count.
 * Data driven from the sangam_optimized plan (falls back to latest).
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import Panel from '../../components/ui/Panel';
import PlanGenerator, { type PlanRunIds } from '../../components/planning/PlanGenerator';
import { getPlan, getTasks, type GeneratedBlock } from '../../lib/apiClient';

// ── helpers ───────────────────────────────────────────────────────────────────

function addDays(iso: string, n: number) {
  const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0];
}
function getMonday(iso: string) {
  const d = new Date(iso); const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); return d.toISOString().split('T')[0];
}

const DEMO_TODAY = '2026-09-07';
const DEPTS = ['ENG', 'TRD', 'SNT'] as const;
type Dept = typeof DEPTS[number];

const DEPT_LABEL: Record<Dept, string> = { ENG: 'Engineering', TRD: 'Traction', SNT: 'S&T' };
const DEPT_BAR_CLS: Record<Dept, string> = {
  ENG: 'bg-blue-300',
  TRD: 'bg-amber-300',
  SNT: 'bg-green-300',
};

interface WeekRow {
  weekLabel: string;
  startIso:  string;
  endIso:    string;
  hours:     Record<Dept, number>;
  totalHours: number;
  highRiskSections: number;
}

function buildWeekRows(blocks: GeneratedBlock[], monthStart: string): WeekRow[] {
  const rows: WeekRow[] = [];
  let start = getMonday(monthStart);

  for (let w = 0; w < 4; w++) {
    const end = addDays(start, 7);
    const weekBlocks = blocks.filter(
      (b) => b.block_start >= `${start}T00:00:00` && b.block_start < `${end}T00:00:00`
    );

    const hours: Record<Dept, number> = { ENG: 0, TRD: 0, SNT: 0 };
    for (const b of weekBlocks) {
      const dur = (new Date(b.block_end).getTime() - new Date(b.block_start).getTime()) / 3_600_000;
      for (const t of b.tasks) {
        const d = t.department as Dept;
        if (d in hours) hours[d] += dur / Math.max(b.tasks.length, 1); // spread hours proportionally
      }
    }
    DEPTS.forEach((d) => { hours[d] = Math.round(hours[d] * 10) / 10; });

    // high-risk sections = distinct sections in this week with ≥2 blocks
    const sectionCounts: Record<string, number> = {};
    for (const b of weekBlocks) {
      sectionCounts[b.section_id] = (sectionCounts[b.section_id] ?? 0) + 1;
    }
    const highRiskSections = Object.values(sectionCounts).filter((c) => c >= 2).length;

    const startFmt = new Date(start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const endFmt   = new Date(addDays(end, -1)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

    rows.push({
      weekLabel: `${startFmt} – ${endFmt}`,
      startIso: start,
      endIso: end,
      hours,
      totalHours: Math.round((hours.ENG + hours.TRD + hours.SNT) * 10) / 10,
      highRiskSections,
    });

    start = end;
  }
  return rows;
}

// max hours across all weeks for bar scaling
function maxHours(rows: WeekRow[]) {
  return Math.max(...rows.map((r) => r.totalHours), 1);
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function MonthlyPlan() {
  const [searchParams, setSearchParams] = useSearchParams();
  const runId = searchParams.get('sangam');

  const [rows,    setRows]    = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [noRun,   setNoRun]   = useState(false);
  const [overdueCount, setOverdueCount] = useState<number | null>(null);

  useEffect(() => {
    if (!runId) { setNoRun(true); return; }
    setLoading(true); setNoRun(false);
    getPlan(runId)
      .then((plan) => setRows(buildWeekRows(plan.blocks, DEMO_TODAY)))
      .catch(() => setNoRun(true))
      .finally(() => setLoading(false));
  }, [runId]);

  useEffect(() => {
    getTasks({ overdue_only: true })
      .then((t) => setOverdueCount(t.length))
      .catch(() => {});
  }, []);

  function handleGenerated(ids: PlanRunIds) {
    const p = new URLSearchParams();
    if (ids.sangam_optimized)     p.set('sangam',  ids.sangam_optimized);
    if (ids.independent_baseline) p.set('ind',     ids.independent_baseline);
    if (ids.greedy_baseline)      p.set('greedy',  ids.greedy_baseline);
    setSearchParams(p);
  }

  const maxH = maxHours(rows);

  return (
    <>
      <TopBar title="Monthly Plan" />
      <main className="flex-1 overflow-y-auto bg-panel p-6">
        <PlanGenerator onComplete={handleGenerated} />

        {/* Summary badges */}
        <div className="flex flex-wrap gap-3 mb-5">
          {DEPTS.map((d) => (
            <div key={d} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded-sm ${DEPT_BAR_CLS[d]}`} />
              <span className="text-xs text-text-secondary">{DEPT_LABEL[d]}</span>
            </div>
          ))}
          {overdueCount != null && (
            <div className="ml-auto text-xs text-status-warning-text bg-status-warning-bg px-2 py-1 rounded-md border border-status-warning-text/20">
              {overdueCount} overdue task{overdueCount !== 1 ? 's' : ''} in backlog
            </div>
          )}
        </div>

        {loading ? (
          <Panel><p className="text-sm text-text-secondary py-8 text-center">Loading…</p></Panel>
        ) : noRun ? (
          <Panel className="py-10 text-center">
            <p className="text-sm text-text-secondary">No plan available. Generate a monthly plan above.</p>
          </Panel>
        ) : (
          <Panel className="overflow-hidden p-0">
            {/* Header row */}
            <div className="grid grid-cols-[200px_1fr_80px_100px] px-5 py-2.5 bg-panel border-b border-border text-xs font-semibold text-text-secondary uppercase tracking-wide">
              <span>Week</span>
              <span>Block Hours by Department</span>
              <span className="text-right">Total h</span>
              <span className="text-right">High-Risk §</span>
            </div>

            {rows.map((row) => (
              <div
                key={row.startIso}
                className="grid grid-cols-[200px_1fr_80px_100px] items-center px-5 py-3.5 border-b border-border last:border-0 hover:bg-panel/50 transition-colors"
              >
                {/* Week label */}
                <span className="text-xs font-medium text-text-primary tabular-nums">
                  {row.weekLabel}
                </span>

                {/* Stacked bar */}
                <div className="flex items-center gap-2 pr-6">
                  <div className="flex-1 h-5 bg-panel rounded overflow-hidden flex">
                    {DEPTS.map((d) => {
                      const w = row.hours[d] === 0 ? 0 : (row.hours[d] / maxH) * 100 / 3;
                      if (w === 0) return null;
                      return (
                        <div
                          key={d}
                          className={`h-full ${DEPT_BAR_CLS[d]}`}
                          style={{ width: `${w}%` }}
                          title={`${DEPT_LABEL[d]}: ${row.hours[d]}h`}
                        />
                      );
                    })}
                  </div>
                  {/* per-dept values */}
                  <div className="flex gap-3 text-2xs text-text-secondary tabular-nums flex-shrink-0">
                    {DEPTS.map((d) => (
                      <span key={d}>{row.hours[d]}h</span>
                    ))}
                  </div>
                </div>

                {/* Total hours */}
                <span className="text-right text-sm font-semibold text-text-primary tabular-nums">
                  {row.totalHours}h
                </span>

                {/* High-risk section count */}
                <span className={`text-right text-sm tabular-nums font-semibold
                  ${row.highRiskSections > 0 ? 'text-status-warning-text' : 'text-text-secondary'}`}>
                  {row.highRiskSections}
                </span>
              </div>
            ))}

            {/* Footer totals */}
            {rows.length > 0 && (
              <div className="grid grid-cols-[200px_1fr_80px_100px] px-5 py-3 border-t-2 border-border bg-panel text-xs font-semibold text-text-secondary">
                <span>Total</span>
                <span />
                <span className="text-right text-text-primary tabular-nums">
                  {rows.reduce((s, r) => s + r.totalHours, 0).toFixed(1)}h
                </span>
                <span />
              </div>
            )}
          </Panel>
        )}
      </main>
    </>
  );
}
