import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, TrendingDown, Sparkles, AlertCircle } from 'lucide-react';
import TopBar from '../../components/TopBar';
import Panel from '../../components/ui/Panel';
import BeforeAfterPossession from '../../components/railway/BeforeAfterPossession';
import GanttBars, { type GanttLane } from '../../components/GanttBars';
import {
  getLatestRuns,
  comparePlans,
  compareDowntime,
  getPlan,
  type ComparePlanRow,
  type DowntimeSaved,
  type PlanDetail,
  type GeneratedBlock,
} from '../../lib/apiClient';

const DEMO_TODAY = '2026-09-07';

function addDays(iso: string, n: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

const DEPARTMENTS = [
  { code: 'ENG', label: 'Engineering' },
  { code: 'TRD', label: 'Traction' },
  { code: 'SNT', label: 'S&T' },
];

interface KpiRow {
  label: string;
  description: string;
  key: keyof ComparePlanRow;
  format: (v: number) => string;
  lowerIsBetter: boolean;
}

const KPI_ROWS: KpiRow[] = [
  {
    label: 'Total Block Closure Hours',
    description: 'Sum of all corridor possession hours across all 5 sections',
    key: 'total_block_hours',
    format: (v) => `${v.toFixed(1)}h`,
    lowerIsBetter: true,
  },
  {
    label: 'Critical Task Coverage',
    description: 'Percentage of emergency & high severity defects addressed',
    key: 'critical_tasks_completed_pct',
    format: (v) => `${v.toFixed(0)}%`,
    lowerIsBetter: false,
  },
  {
    label: 'Joint Coordinated Blocks',
    description: 'Shared possessions merging 2 or 3 departments into 1 cut',
    key: 'joint_blocks_count',
    format: (v) => `${v}`,
    lowerIsBetter: false,
  },
  {
    label: 'Unscheduled Priority Sum',
    description: 'Remaining priority burden of deferred work orders',
    key: 'unscheduled_priority_sum',
    format: (v) => v.toFixed(1),
    lowerIsBetter: true,
  },
  {
    label: 'Train Impact Score',
    description: 'Normalized delay propagation penalty on train paths',
    key: 'train_impact_score',
    format: (v) => v.toFixed(1),
    lowerIsBetter: true,
  },
];

function bestIdx(row: KpiRow, values: (number | null)[]): number {
  const valid = values.map((v, i) => (v != null ? { v, i } : null)).filter(Boolean);
  if (valid.length === 0) return -1;
  if (row.lowerIsBetter) {
    return valid.reduce((min, cur) => (cur!.v < min!.v ? cur : min))!.i;
  } else {
    return valid.reduce((max, cur) => (cur!.v > max!.v ? cur : max))!.i;
  }
}

export default function PlanComparison() {
  const [searchParams] = useSearchParams();

  const runIds = {
    ind: searchParams.get('ind'),
    greedy: searchParams.get('greedy'),
    sangam: searchParams.get('sangam'),
  };

  const [comparison, setComparison] = useState<ComparePlanRow[]>([]);
  const [downtime, setDowntime] = useState<DowntimeSaved | null>(null);
  const [indPlan, setIndPlan] = useState<PlanDetail | null>(null);
  const [sangamPlan, setSangamPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [noData, setNoData] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setNoData(false);

      try {
        let ids = runIds;
        if (!ids.sangam && !ids.ind && !ids.greedy) {
          const latest = await getLatestRuns();
          ids = {
            sangam: latest.sangam_optimized?.run_id ?? null,
            ind: latest.independent_baseline?.run_id ?? null,
            greedy: latest.greedy_baseline?.run_id ?? null,
          };
        }

        if (!ids.sangam || !ids.ind) {
          setNoData(true);
          setLoading(false);
          return;
        }

        const validIds = [ids.ind, ids.greedy, ids.sangam].filter(Boolean) as string[];
        const [cmp, dt, indP, sangP] = await Promise.all([
          comparePlans(validIds),
          compareDowntime(ids.ind!, ids.sangam!),
          getPlan(ids.ind!),
          getPlan(ids.sangam!),
        ]);

        setComparison(cmp);
        setDowntime(dt);
        setIndPlan(indP);
        setSangamPlan(sangP);

        // Pick top joint block section
        const sectionCounts: Record<string, number> = {};
        for (const b of sangP.blocks.filter((b) => b.is_joint_block)) {
          sectionCounts[b.section_id] = (sectionCounts[b.section_id] ?? 0) + 1;
        }
        const topSection = Object.entries(sectionCounts).sort((a, b) => b[1] - a[1])[0];
        setSelectedSection(topSection?.[0] ?? sangP.blocks[0]?.section_id ?? null);
      } catch (err) {
        console.error(err);
        setNoData(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [runIds.sangam, runIds.ind, runIds.greedy]);

  const indBlocks = (indPlan?.blocks ?? []).filter((b) => b.section_id === selectedSection);
  const sangamBlocks = (sangamPlan?.blocks ?? []).filter((b) => b.section_id === selectedSection);

  const rangeStart = `${DEMO_TODAY}T00:00:00`;
  const rangeEnd = `${addDays(DEMO_TODAY, 7)}T00:00:00`;

  function buildLanes(blocks: GeneratedBlock[]): GanttLane[] {
    return DEPARTMENTS.map((dept) => ({
      deptCode: dept.code,
      deptLabel: dept.label,
      blocks: blocks.filter((b) => b.tasks.some((t) => t.department === dept.code)),
    }));
  }

  const indLanes = buildLanes(indBlocks);
  const sangamLanes = buildLanes(sangamBlocks);

  const indRow = comparison.find((r) => r.run_type === 'independent_baseline');
  const greedyRow = comparison.find((r) => r.run_type === 'greedy_baseline');
  const sangamRow = comparison.find((r) => r.run_type === 'sangam_optimized');

  return (
    <>
      <TopBar
        title="Plan Comparison & Impact Matrix"
        subtitle="Before vs. After Mathematical Benchmarking: Independent Baseline vs. SANGAM CP-SAT"
      />

      <main className="flex-1 overflow-y-auto bg-panel p-6 space-y-6">
        {loading ? (
          <Panel>
            <p className="text-sm text-text-secondary py-12 text-center animate-pulse">
              Computing CP-SAT comparative metrics and corridor savings...
            </p>
          </Panel>
        ) : noData ? (
          <Panel className="flex flex-col items-center py-12 gap-3 text-center">
            <AlertCircle className="w-8 h-8 text-text-secondary" />
            <p className="text-sm text-text-secondary">
              No optimization run history found. Run the optimizer from the Planning Workbench first.
            </p>
          </Panel>
        ) : (
          <>
            {/* ── 1. Animated Transformation: 3 Blocks → 1 Coordinated Block ── */}
            <BeforeAfterPossession />

            {/* ── 2. Top Hero Impact Statistics ── */}
            {downtime && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-border p-4 shadow-xs">
                  <span className="text-2xs font-bold text-text-secondary uppercase tracking-wider block">
                    Independent Baseline
                  </span>
                  <div className="font-mono text-2xl font-bold text-slate-700 mt-1">
                    {downtime.baseline_hours.toFixed(1)} hrs
                  </div>
                  <span className="text-2xs text-text-secondary mt-0.5 block">
                    Siloed departmental requests
                  </span>
                </div>

                <div className="bg-white rounded-lg border border-border p-4 shadow-xs">
                  <span className="text-2xs font-bold text-text-secondary uppercase tracking-wider block">
                    SANGAM Coordinated
                  </span>
                  <div className="font-mono text-2xl font-bold text-accent mt-1">
                    {downtime.optimized_hours.toFixed(1)} hrs
                  </div>
                  <span className="text-2xs text-text-secondary mt-0.5 block">
                    Joint possession scheduling
                  </span>
                </div>

                <div className="bg-emerald-50 rounded-lg border-2 border-emerald-200 p-4 shadow-xs">
                  <span className="text-2xs font-bold text-emerald-800 uppercase tracking-wider block">
                    Total Hours Saved
                  </span>
                  <div className="font-mono text-2xl font-black text-emerald-700 mt-1 flex items-center gap-1">
                    <TrendingDown className="w-5 h-5" />
                    {downtime.hours_saved.toFixed(1)} hrs
                  </div>
                  <span className="text-2xs font-bold text-emerald-800 mt-0.5 block">
                    Corridor closure time reclaimed
                  </span>
                </div>

                <div className="bg-blue-50 rounded-lg border-2 border-blue-200 p-4 shadow-xs">
                  <span className="text-2xs font-bold text-blue-800 uppercase tracking-wider block">
                    Relative Reduction
                  </span>
                  <div className="font-mono text-2xl font-black text-blue-700 mt-1">
                    {downtime.percent_saved.toFixed(1)}%
                  </div>
                  <span className="text-2xs font-bold text-blue-800 mt-0.5 block">
                    Direct track efficiency gain
                  </span>
                </div>
              </div>
            )}

            {/* ── 3. 3-Way Optimization Performance Matrix ── */}
            <Panel
              title="Mathematical Benchmarking Matrix (Independent vs. Greedy vs. SANGAM)"
              action={
                <span className="text-2xs font-mono text-text-secondary">
                  Evaluated across identical 120-task demand backlog
                </span>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-border bg-panel">
                      <th className="text-left py-3 px-4 font-bold text-text-secondary uppercase tracking-wide">
                        Metric & Description
                      </th>
                      <th className="text-center py-3 px-4 font-bold text-slate-700 uppercase tracking-wide">
                        1. Independent Baseline<br />
                        <span className="text-[10px] font-normal lowercase text-text-secondary">
                          (current siloed practice)
                        </span>
                      </th>
                      <th className="text-center py-3 px-4 font-bold text-slate-700 uppercase tracking-wide">
                        2. Greedy Heuristic<br />
                        <span className="text-[10px] font-normal lowercase text-text-secondary">
                          (first-fit rule based)
                        </span>
                      </th>
                      <th className="text-center py-3 px-4 font-bold text-accent uppercase tracking-wide bg-blue-50/80 border-l border-r border-blue-200">
                        3. SANGAM CP-SAT ★<br />
                        <span className="text-[10px] font-normal lowercase text-accent font-semibold">
                          (coordinated joint solver)
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {KPI_ROWS.map((kpi) => {
                      const vInd = indRow?.[kpi.key] as number | undefined;
                      const vGreedy = greedyRow?.[kpi.key] as number | undefined;
                      const vSangam = sangamRow?.[kpi.key] as number | undefined;
                      const values = [vInd ?? null, vGreedy ?? null, vSangam ?? null];
                      const best = bestIdx(kpi, values);

                      return (
                        <tr key={kpi.key} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-text-primary text-xs">{kpi.label}</div>
                            <div className="text-2xs text-text-secondary">{kpi.description}</div>
                          </td>

                          {/* Independent */}
                          <td className="py-3 px-4 text-center font-mono font-semibold text-text-secondary">
                            {vInd != null ? kpi.format(vInd) : '—'}
                          </td>

                          {/* Greedy */}
                          <td className="py-3 px-4 text-center font-mono font-semibold text-text-secondary">
                            {vGreedy != null ? kpi.format(vGreedy) : '—'}
                          </td>

                          {/* SANGAM */}
                          <td className="py-3 px-4 text-center font-mono font-bold text-accent bg-blue-50/50 border-l border-r border-blue-200">
                            <div className="inline-flex items-center gap-1.5 justify-center">
                              <span className="text-sm">{vSangam != null ? kpi.format(vSangam) : '—'}</span>
                              {best === 2 && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            {/* ── 4. Detailed Schedule Comparison (Gantt Rows) ── */}
            <Panel
              title={
                <div className="flex items-center justify-between w-full">
                  <span>Weekly Block Gantt Comparison (Section Level)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xs text-text-secondary font-medium">Select Section:</span>
                    <select
                      value={selectedSection ?? ''}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      className="text-xs border border-border rounded px-2 py-1 bg-white font-medium text-text-primary focus:outline-none"
                    >
                      {(sangamPlan?.blocks ?? []).map((b) => (
                        <option key={b.section_id} value={b.section_id}>
                          {b.section_name ?? `Section #${b.section_id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              }
            >
              <div className="space-y-6">
                {/* Independent */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 uppercase tracking-wide">
                      Independent Scheduling (Siloed Department Blocks)
                    </span>
                    <span className="font-mono text-2xs text-text-secondary">
                      {indBlocks.length} Separate Possessions
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-border">
                    <GanttBars
                      lanes={indLanes}
                      rangeStart={rangeStart}
                      rangeEnd={rangeEnd}
                      laneHeight={40}
                      showTicks={false}
                    />
                  </div>
                </div>

                {/* SANGAM */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-accent uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                      SANGAM Coordinated Optimization (Joint Possessions)
                    </span>
                    <span className="font-mono text-2xs text-emerald-700 font-bold">
                      {sangamBlocks.length} Consolidated Blocks ({sangamBlocks.filter((b) => b.is_joint_block).length} Joint)
                    </span>
                  </div>
                  <div className="bg-blue-50/30 p-2 rounded border border-blue-200">
                    <GanttBars
                      lanes={sangamLanes}
                      rangeStart={rangeStart}
                      rangeEnd={rangeEnd}
                      laneHeight={40}
                      showTicks
                    />
                  </div>
                </div>
              </div>
            </Panel>
          </>
        )}
      </main>
    </>
  );
}
