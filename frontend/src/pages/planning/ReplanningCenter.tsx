/**
 * ReplanningCenter — What-If simulation and disruption re-planning.
 * Reachable via a button on WeeklyPlan (not a top-level nav item per blueprint).
 *
 * Two panels:
 *  A. Simulate Train Delay  → before/after mini-Gantt + plain-language summary
 *  B. What-If Scenario      → lock window or raise severity → KPI delta table
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import TopBar from '../../components/TopBar';
import Panel from '../../components/ui/Panel';
import Button from '../../components/ui/Button';
import GanttBars, { type GanttLane } from '../../components/GanttBars';
import {
  getLatestRuns,
  getSections,
  getPlan,
  getCorridorWindows,
  simulateDisruption,
  runWhatIf,
  type Section,
  type GeneratedBlock,
  type KpiResult,
  type DisruptionResult,
  type WhatIfResult,
} from '../../lib/apiClient';

// ── helpers ───────────────────────────────────────────────────────────────────

const DEMO_TODAY = '2026-09-07';

function getMonday(iso: string) {
  const d = new Date(iso); const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); return d.toISOString().split('T')[0];
}
function addDays(iso: string, n: number) {
  const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0];
}

const WEEK_START = getMonday(DEMO_TODAY);

const DEPARTMENTS = [
  { code: 'ENG', label: 'Engineering' },
  { code: 'TRD', label: 'Traction' },
  { code: 'SNT', label: 'S&T' },
];

function buildLanes(blocks: GeneratedBlock[], sectionId: string): GanttLane[] {
  const sectionBlocks = blocks.filter((b) => b.section_id === sectionId);
  return DEPARTMENTS.map((dept) => ({
    deptCode:  dept.code,
    deptLabel: dept.label,
    blocks: sectionBlocks.filter((b) => b.tasks.some((t) => t.department === dept.code)),
  }));
}

// ── KPI delta row ─────────────────────────────────────────────────────────────

const KPI_META: { key: keyof KpiResult; label: string; lowerIsBetter: boolean }[] = [
  { key: 'total_block_hours',          label: 'Total Block Hours',       lowerIsBetter: true  },
  { key: 'critical_task_coverage_pct', label: 'Critical Coverage %',    lowerIsBetter: false },
  { key: 'joint_block_utilization_pct',label: 'Joint Block %',          lowerIsBetter: false },
  { key: 'unscheduled_priority_sum',   label: 'Unscheduled Priority',   lowerIsBetter: true  },
  { key: 'train_impact_score',         label: 'Train Impact Score',     lowerIsBetter: true  },
];

function fmt(v: number | undefined, key: keyof KpiResult): string {
  if (v == null) return '—';
  if (key === 'total_block_hours') return `${v.toFixed(1)}h`;
  if (key.endsWith('_pct')) return `${v.toFixed(0)}%`;
  return v.toFixed(1);
}

function DeltaCell({ delta, lowerIsBetter }: { delta: number; lowerIsBetter: boolean }) {
  if (delta === 0) return <span className="text-text-secondary tabular-nums">0</span>;
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  return (
    <span className={`tabular-nums font-semibold ${improved ? 'text-status-good-text' : 'text-status-critical-text'}`}>
      {delta > 0 ? '+' : ''}{delta.toFixed(1)}
    </span>
  );
}

function KpiDeltaTable({ current, scenario, deltas }: {
  current: KpiResult;
  scenario: KpiResult;
  deltas: Record<string, number>;
}) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b-2 border-border">
          <th className="text-left px-3 py-2 text-xs font-semibold text-text-secondary uppercase tracking-wide">Metric</th>
          <th className="text-right px-3 py-2 text-xs font-semibold text-text-secondary uppercase tracking-wide">Current</th>
          <th className="text-right px-3 py-2 text-xs font-semibold text-accent uppercase tracking-wide bg-accent-tint">Scenario</th>
          <th className="text-right px-3 py-2 text-xs font-semibold text-text-secondary uppercase tracking-wide">Delta</th>
        </tr>
      </thead>
      <tbody>
        {KPI_META.map(({ key, label, lowerIsBetter }) => (
          <tr key={key} className="border-b border-border last:border-0">
            <td className="px-3 py-2.5 font-medium text-text-primary">{label}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">{fmt(current[key] as number, key)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-accent bg-accent-tint font-semibold">{fmt(scenario[key] as number, key)}</td>
            <td className="px-3 py-2.5 text-right">
              <DeltaCell delta={deltas[key] ?? 0} lowerIsBetter={lowerIsBetter} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function ReplanningCenter() {
  const [searchParams] = useSearchParams();
  const urlRunId = searchParams.get('sangam');

  const [runId,    setRunId]    = useState<string | null>(urlRunId);
  const [sections, setSections] = useState<Section[]>([]);
  const [origPlan, setOrigPlan] = useState<GeneratedBlock[]>([]);

  // ── Panel A: Disruption ──────────────────────────────────────────────────
  const [dispSection, setDispSection] = useState('');
  const [delayMin,    setDelayMin]    = useState(45);
  const [dispRunning, setDispRunning] = useState(false);
  const [dispResult,  setDispResult]  = useState<DisruptionResult | null>(null);
  const [newPlan,     setNewPlan]     = useState<GeneratedBlock[]>([]);
  const [dispError,   setDispError]   = useState<string | null>(null);

  // ── Panel B: What-If ─────────────────────────────────────────────────────
  const [wiType,     setWiType]     = useState<'lock_window' | 'raise_severity'>('raise_severity');
  const [wiTaskId,   setWiTaskId]   = useState('');
  const [wiSeverity, setWiSeverity] = useState('Critical');
  const [wiWindowId, setWiWindowId] = useState('');
  const [wiRunning,  setWiRunning]  = useState(false);
  const [wiResult,   setWiResult]   = useState<WhatIfResult | null>(null);
  const [wiError,    setWiError]    = useState<string | null>(null);
  const [corridorWindows, setCorridorWindows] = useState<{ id: string; label: string }[]>([]);

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    getSections().then((s) => {
      setSections(s);
      if (s.length > 0 && !dispSection) setDispSection(s[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    async function bootstrap() {
      let id = runId;
      if (!id) {
        const latest = await getLatestRuns().catch(() => null);
        id = latest?.sangam_optimized?.run_id ?? null;
        setRunId(id);
      }
      if (id) {
        const plan = await getPlan(id).catch(() => null);
        if (plan) setOrigPlan(plan.blocks);
      }
    }
    bootstrap();
  }, [runId]);

  // Load corridor windows for what-if lock_window panel
  useEffect(() => {
    if (wiType !== 'lock_window' || !dispSection) return;
    getCorridorWindows(dispSection, `${WEEK_START}T00:00:00`, `${addDays(WEEK_START, 7)}T00:00:00`)
      .then((ws) => setCorridorWindows(ws.map((w) => ({
        id: w.id,
        label: `${w.window_start.slice(5, 16)} → ${w.window_end.slice(11, 16)} (risk ${w.risk_score?.toFixed(2) ?? '—'})`,
      }))))
      .catch(() => {});
  }, [wiType, dispSection]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleSimulate() {
    if (!runId || !dispSection) return;
    setDispRunning(true);
    setDispError(null);
    setDispResult(null);
    setNewPlan([]);
    try {
      const res = await simulateDisruption(runId, dispSection, delayMin);
      setDispResult(res);
      if (res.new_run_id) {
        const newPlanData = await getPlan(res.new_run_id);
        setNewPlan(newPlanData.blocks);
      }
    } catch (e: unknown) {
      setDispError(e instanceof Error ? e.message : 'Simulation failed.');
    } finally {
      setDispRunning(false);
    }
  }

  async function handleWhatIf() {
    if (!runId) return;
    setWiRunning(true);
    setWiError(null);
    setWiResult(null);
    try {
      const change =
        wiType === 'lock_window'
          ? { type: 'lock_window',    window_id: wiWindowId }
          : { type: 'raise_severity', task_id: wiTaskId, new_severity: wiSeverity };
      const res = await runWhatIf(runId, change);
      setWiResult(res);
    } catch (e: unknown) {
      setWiError(e instanceof Error ? e.message : 'What-if scenario failed.');
    } finally {
      setWiRunning(false);
    }
  }

  const rangeStart = `${WEEK_START}T00:00:00`;
  const rangeEnd   = `${addDays(WEEK_START, 7)}T00:00:00`;

  const origLanes  = dispSection ? buildLanes(origPlan, dispSection)  : [];
  const newLanes   = dispSection ? buildLanes(newPlan,  dispSection)  : [];
  const hasOrig    = origLanes.some((l) => l.blocks.length > 0);
  const hasNew     = newLanes.some((l) => l.blocks.length > 0);

  return (
    <>
      <TopBar title="Replanning Center" />
      <main className="flex-1 overflow-y-auto bg-panel p-6 space-y-5">

        {!runId && (
          <div className="flex items-center gap-2 p-3 bg-status-warning-bg border border-status-warning-text/20 rounded-card text-xs text-status-warning-text">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            No optimization run found. Generate a plan first from Block Planning.
          </div>
        )}

        {/* ── Panel A: Simulate Train Delay ──────────────────────────────── */}
        <Panel title="Simulate Train Delay">
          <div className="flex flex-wrap items-end gap-4 mb-5">
            {/* Section */}
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-xs font-medium text-text-secondary">Section</label>
              <select
                value={dispSection}
                onChange={(e) => setDispSection(e.target.value)}
                disabled={dispRunning}
                className="text-sm border border-border rounded-md px-3 py-1.5 bg-white text-text-primary
                           focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
              >
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Delay minutes */}
            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-xs font-medium text-text-secondary">
                Delay: <span className="font-semibold text-text-primary tabular-nums">{delayMin} min</span>
              </label>
              <input
                type="range" min={10} max={120} step={5}
                value={delayMin}
                onChange={(e) => setDelayMin(Number(e.target.value))}
                disabled={dispRunning}
                className="w-full accent-accent"
              />
            </div>

            <Button variant="primary" size="md" onClick={handleSimulate}
              disabled={!runId || !dispSection || dispRunning}>
              {dispRunning && <Loader2 className="w-4 h-4 animate-spin" />}
              {dispRunning ? 'Simulating…' : 'Simulate Disruption'}
            </Button>
          </div>

          {dispError && (
            <p className="mb-4 text-xs text-status-critical-text bg-status-critical-bg rounded px-3 py-2">
              {dispError}
            </p>
          )}

          {/* Plain-language summary */}
          {dispResult && (
            <div className="mb-5 p-3 bg-status-warning-bg border border-status-warning-text/20 rounded-card text-sm text-status-warning-text">
              {dispResult.disruption_summary}
            </div>
          )}

          {/* Before / After Gantt pair */}
          {(hasOrig || hasNew) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                  Before (Original Plan)
                </h4>
                {hasOrig
                  ? <GanttBars lanes={origLanes} rangeStart={rangeStart} rangeEnd={rangeEnd} laneHeight={40} showTicks={false} />
                  : <p className="text-xs text-text-secondary py-4 text-center">No blocks for this section.</p>}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-accent uppercase tracking-wide mb-2">
                  After (Re-planned)
                </h4>
                {hasNew
                  ? <GanttBars lanes={newLanes} rangeStart={rangeStart} rangeEnd={rangeEnd} laneHeight={40} showTicks />
                  : dispResult
                    ? <p className="text-xs text-text-secondary py-4 text-center">
                        {dispResult.changed_count === 0
                          ? 'No blocks changed — original plan remains optimal despite the delay.'
                          : 'Re-plan in progress or no blocks on this section in the new plan.'}
                      </p>
                    : <p className="text-xs text-text-secondary py-4 text-center">Run a simulation to see the re-plan.</p>}
              </div>
            </div>
          )}

          {dispResult && (
            <div className="mt-4 pt-3 border-t border-border grid grid-cols-3 gap-4 text-xs text-center">
              <div>
                <p className="text-2xl font-bold text-text-primary tabular-nums">{dispResult.affected_blocks.length}</p>
                <p className="text-text-secondary mt-0.5">Blocks affected</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary tabular-nums">{dispResult.changed_count}</p>
                <p className="text-text-secondary mt-0.5">Tasks rescheduled</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary tabular-nums">{dispResult.unchanged_count}</p>
                <p className="text-text-secondary mt-0.5">Blocks unchanged</p>
              </div>
            </div>
          )}
        </Panel>

        {/* ── Panel B: What-If Scenario ──────────────────────────────────── */}
        <Panel title="What-If Scenario">
          <div className="flex flex-wrap items-end gap-4 mb-5">
            {/* Change type toggle */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Scenario Type</label>
              <div className="flex items-center gap-0 border border-border rounded-md overflow-hidden text-xs">
                {(['raise_severity', 'lock_window'] as const).map((t) => (
                  <button key={t}
                    onClick={() => setWiType(t)}
                    className={`px-3 py-1.5 font-medium transition-colors
                      ${wiType === t ? 'bg-accent text-white' : 'bg-white text-text-secondary hover:bg-panel'}`}>
                    {t === 'raise_severity' ? 'Raise Task Severity' : 'Lock Window'}
                  </button>
                ))}
              </div>
            </div>

            {wiType === 'raise_severity' ? (
              <>
                <div className="flex flex-col gap-1 min-w-[220px]">
                  <label className="text-xs font-medium text-text-secondary">Task ID or Code</label>
                  <input
                    type="text"
                    value={wiTaskId}
                    onChange={(e) => setWiTaskId(e.target.value)}
                    placeholder="e.g. ENG-3421"
                    className="text-sm border border-border rounded-md px-3 py-1.5 bg-white text-text-primary
                               focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-text-secondary">New Severity</label>
                  <select
                    value={wiSeverity}
                    onChange={(e) => setWiSeverity(e.target.value)}
                    className="text-sm border border-border rounded-md px-3 py-1.5 bg-white text-text-primary
                               focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {['Critical', 'High', 'Medium', 'Low'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-1 min-w-[300px]">
                <label className="text-xs font-medium text-text-secondary">Window to Lock</label>
                <select
                  value={wiWindowId}
                  onChange={(e) => setWiWindowId(e.target.value)}
                  className="text-sm border border-border rounded-md px-3 py-1.5 bg-white text-text-primary
                             focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">Select a window…</option>
                  {corridorWindows.map((w) => (
                    <option key={w.id} value={w.id}>{w.label}</option>
                  ))}
                </select>
              </div>
            )}

            <Button variant="primary" size="md" onClick={handleWhatIf}
              disabled={!runId || wiRunning || (wiType === 'raise_severity' && !wiTaskId) || (wiType === 'lock_window' && !wiWindowId)}>
              {wiRunning && <Loader2 className="w-4 h-4 animate-spin" />}
              {wiRunning ? 'Running…' : 'Run Scenario'}
            </Button>
          </div>

          {wiError && (
            <p className="mb-4 text-xs text-status-critical-text bg-status-critical-bg rounded px-3 py-2">{wiError}</p>
          )}

          {wiResult && (
            <KpiDeltaTable
              current={wiResult.current_kpis}
              scenario={wiResult.scenario_kpis}
              deltas={wiResult.deltas}
            />
          )}

          {!wiResult && !wiRunning && (
            <p className="text-xs text-text-secondary text-center py-6">
              Configure a scenario above and click Run Scenario to see the KPI impact.
            </p>
          )}
        </Panel>
      </main>
    </>
  );
}
