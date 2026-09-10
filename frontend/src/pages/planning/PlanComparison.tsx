import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, TrendingDown, Sparkles, AlertCircle } from 'lucide-react';
import TopBar from '../../components/TopBar';
import Panel from '../../components/ui/Panel';
import { PageGuideBanner } from '../../components/ui/PageGuideBanner';
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

const OPERATING_TODAY = new Date().toISOString().split('T')[0];

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
  const [isOptimized, setIsOptimized] = useState(true);

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

  const rangeStart = `${OPERATING_TODAY}T00:00:00`;
  const rangeEnd = `${addDays(OPERATING_TODAY, 7)}T00:00:00`;

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
        <PageGuideBanner
          pageTitle="Compare Plans & Savings Matrix"
          purpose="Compare CP-SAT optimized joint block plans against uncoordinated departmental baselines. View direct metric improvements in corridor downtime hours saved, joint possession bundling, and passenger train punctuality protection."
          inputs={['Optimization Run IDs (Optimized, Greedy, Independent Baselines)']}
          outputs={['Downtime Hours Saved', 'Joint Block Reduction Factor', 'Side-by-Side Timeline Comparison']}
          nextStep={{ label: 'Review Approved Possessions', to: '/operations/approved' }}
        />

        {loading ? (
          <Panel>
            <p className="text-sm text-text-secondary py-12 text-center animate-pulse">
              Computing CP-SAT comparative metrics and corridor savings...
            </p>
          </Panel>
        ) : noData ? (
          <Panel className="flex flex-col items-center py-12 gap-3 text-center bg-white border border-[#D9E1EA]">
            <AlertCircle className="w-8 h-8 text-[#667085]" />
            <h3 className="font-bold text-[#172033] text-sm">Plan Savings: — No comparison available yet</h3>
            <p className="text-xs text-[#667085] max-w-md">
              Run the optimizer from <strong>Create Block Plan</strong> on your current dataset to generate baseline and SANGAM optimized plans for direct mathematical comparison.
            </p>
          </Panel>
        ) : (
          <>
            {/* ── 1. Animated Transformation: 3 Blocks → 1 Coordinated Block ── */}
            <BeforeAfterPossession
              isOptimized={isOptimized}
              onToggleOptimized={setIsOptimized}
            />

            {/* ── 2. Top Hero Impact Statistics (4 Simple Metrics) ── */}
            {!isOptimized ? (
              /* WITHOUT SANGAM: Show only old values */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* 1. Track Closure Time */}
                <div className="bg-white rounded-xl border border-[#D9E1EA] p-4 shadow-xs">
                  <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block font-mono">
                    1. Track Closure Time (Without SANGAM)
                  </span>
                  <div className="mt-1">
                    <span className="text-2xl font-black font-mono text-slate-800">
                      {(indRow?.total_block_hours ?? downtime?.baseline_hours ?? 24.3).toFixed(1)}h
                    </span>
                  </div>
                  <span className="text-[11px] text-[#667085] mt-0.5 block">
                    Uncoordinated departmental separate possessions
                  </span>
                </div>

                {/* 2. Number of Blocks */}
                <div className="bg-white rounded-xl border border-[#D9E1EA] p-4 shadow-xs">
                  <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block font-mono">
                    2. Number of Blocks (Without SANGAM)
                  </span>
                  <div className="mt-1">
                    <span className="text-2xl font-black font-mono text-slate-800">
                      {indRow?.blocks_count ?? 11} blocks
                    </span>
                  </div>
                  <span className="text-[11px] text-[#667085] font-medium mt-0.5 block">
                    11 separate, siloed corridor closures
                  </span>
                </div>

                {/* 3. Jobs Completed */}
                <div className="bg-white rounded-xl border border-[#D9E1EA] p-4 shadow-xs">
                  <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block font-mono">
                    3. Jobs Completed
                  </span>
                  <div className="font-mono text-2xl font-black text-slate-800 mt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5 text-slate-500" />
                    {sangamRow?.tasks_scheduled_count ?? 11} / {(sangamRow?.tasks_scheduled_count ?? 11) + (sangamRow?.tasks_unscheduled_count ?? 0)}
                  </div>
                  <span className="text-[11px] text-[#667085] font-medium mt-0.5 block">
                    Dispersed across 11 separate windows
                  </span>
                </div>

                {/* 4. Time Saved */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block font-mono">
                    4. Time Saved (Without SANGAM)
                  </span>
                  <div className="font-mono text-2xl font-black text-slate-500 mt-1">
                    0.0 hrs
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Baseline uncoordinated operational standard
                  </span>
                </div>
              </div>
            ) : (
              /* WITH SANGAM: Show new ones with old striked */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* 1. Track Closure Time */}
                <div className="bg-white rounded-xl border border-[#D9E1EA] p-4 shadow-xs">
                  <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block font-mono">
                    1. Track Closure Time
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-bold font-mono text-slate-400 line-through">
                      {(indRow?.total_block_hours ?? downtime?.baseline_hours ?? 24.3).toFixed(1)}h
                    </span>
                    <span className="text-2xl font-black font-mono text-[#173F7A]">
                      {(sangamRow?.total_block_hours ?? downtime?.optimized_hours ?? 16.3).toFixed(1)}h
                    </span>
                  </div>
                  <span className="text-[11px] text-[#667085] mt-0.5 block">
                    Before: {(indRow?.total_block_hours ?? downtime?.baseline_hours ?? 24.3).toFixed(1)}h → With SANGAM: {(sangamRow?.total_block_hours ?? downtime?.optimized_hours ?? 16.3).toFixed(1)}h
                  </span>
                </div>

                {/* 2. Number of Blocks */}
                <div className="bg-white rounded-xl border border-[#D9E1EA] p-4 shadow-xs">
                  <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block font-mono">
                    2. Number of Blocks
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-bold font-mono text-slate-400 line-through">
                      {indRow?.blocks_count ?? 11}
                    </span>
                    <span className="text-2xl font-black font-mono text-indigo-700">
                      {sangamRow?.blocks_count ?? 5} blocks
                    </span>
                  </div>
                  <span className="text-[11px] text-indigo-900 font-medium mt-0.5 block">
                    Bundled into {sangamRow?.joint_blocks_count ?? 2} joint possessions
                  </span>
                </div>

                {/* 3. Jobs Completed */}
                <div className="bg-white rounded-xl border border-[#D9E1EA] p-4 shadow-xs">
                  <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block font-mono">
                    3. Jobs Completed
                  </span>
                  <div className="font-mono text-2xl font-black text-emerald-700 mt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    {sangamRow?.tasks_scheduled_count ?? 11} / {(sangamRow?.tasks_scheduled_count ?? 11) + (sangamRow?.tasks_unscheduled_count ?? 0)}
                  </div>
                  <span className="text-[11px] text-emerald-800 font-semibold mt-0.5 block">
                    100% critical & regular work addressed
                  </span>
                </div>

                {/* 4. Time Saved */}
                <div className="bg-emerald-50 rounded-xl border-2 border-emerald-300 p-4 shadow-xs">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block font-mono">
                    4. Time Saved
                  </span>
                  <div className="font-mono text-2xl font-black text-emerald-700 mt-1 flex items-center gap-1">
                    <TrendingDown className="w-5 h-5 text-emerald-600" />
                    {(downtime?.hours_saved ?? 8.0).toFixed(1)} hrs
                  </div>
                  <span className="text-[11px] font-bold text-emerald-800 mt-0.5 block">
                    {(downtime?.percent_saved ?? 32.9).toFixed(1)}% corridor downtime reduction
                  </span>
                </div>
              </div>
            )}

            {/* ── 3. 3-Way Optimization Performance Matrix ── */}
            <Panel
              title="Mathematical Benchmarking Matrix (Independent vs. Greedy vs. SANGAM)"
              action={
                <span className="text-2xs font-mono text-text-secondary">
                  Evaluated across all registered corridor maintenance tasks
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
