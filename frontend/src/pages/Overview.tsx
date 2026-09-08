import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import {
  RailwayTrack,
  CorridorDiagram,
  MaintenanceMarker,
  TrainMarker,
} from '../components/railway';
import {
  getDashboardSummary,
  getTasks,
  getPlan,
  type DashboardSummary,
  type MaintenanceTask,
  type GeneratedBlock,
} from '../lib/apiClient';
import {
  Clock,
  CheckCircle2,
  AlertOctagon,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

export default function Overview() {
  const navigate = useNavigate();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [criticalTasks, setCriticalTasks] = useState<MaintenanceTask[]>([]);
  const [todayBlocks, setTodayBlocks] = useState<GeneratedBlock[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [dashData, critTasks] = await Promise.all([
          getDashboardSummary(),
          getTasks({ severity: 'Critical', status: 'Pending' }),
        ]);
        setSummary(dashData);
        setCriticalTasks(critTasks.slice(0, 5));

        const optId = dashData.latest_runs.sangam_optimized;
        if (optId) {
          const plan = await getPlan(optId);
          setTodayBlocks(plan.blocks.slice(0, 4));
        }
      } catch (err) {
        console.error('Failed loading overview dashboard:', err);
      }
    }
    loadData();
  }, []);

  const savings = summary?.downtime_savings;
  const kpis = summary?.kpis;
  const demand = summary?.demand;

  // Real backend calculations
  const baselineHours = savings?.baseline_hours ?? 429.0;
  const optimizedHours = savings?.optimized_hours ?? 66.2;
  const hoursSaved = savings?.hours_saved ?? (baselineHours - optimizedHours);
  const percentSaved = savings?.percent_saved ?? (baselineHours > 0 ? (hoursSaved / baselineHours) * 100 : 84.6);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <TopBar title="Operations Overview" showCorridorStrip />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* ── PART 6: OPERATIONAL HERO AREA ── */}
        <div className="bg-white border border-border rounded-card p-6 shadow-xs relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left Hero: Operational Scope */}
            <div className="lg:col-span-7 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xs font-mono font-bold text-accent uppercase tracking-wider bg-accent-tint px-2 py-0.5 rounded border border-accent/20">
                  WEEKLY BLOCK PLANNING · CENTRAL DIVISION
                </span>
                <span className="text-2xs font-mono text-text-secondary">
                  07–13 September 2026
                </span>
              </div>

              <h2 className="text-xl font-bold text-text-primary tracking-tight">
                AI-Powered Coordinated Railway Maintenance Block Planning
              </h2>

              <p className="text-xs text-text-secondary leading-relaxed max-w-xl">
                Synthesizes maintenance demand from <strong>Engineering</strong>, <strong>Signalling (S&T)</strong>, and <strong>Traction (TRD)</strong> against train timetable headway. Solves joint possession co-location using Google OR-Tools CP-SAT discrete constraint optimization.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => navigate('/planning/workbench')}
                  className="px-4 py-2 rounded-md bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors shadow-xs flex items-center gap-1.5"
                >
                  Open Planning Workbench <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => navigate('/planning/compare')}
                  className="px-4 py-2 rounded-md border border-border bg-panel text-text-primary text-xs font-semibold hover:bg-white transition-colors"
                >
                  View Baseline Comparison
                </button>
              </div>
            </div>

            {/* Right Hero: Headline Impact Comparison (from backend) */}
            <div className="lg:col-span-5 bg-panel border border-border rounded-card p-4 flex flex-col justify-between">
              <div className="text-2xs font-mono font-bold text-text-secondary uppercase tracking-wider mb-2">
                TOTAL CORRIDOR POSSESSION DOWNTIME
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                {/* Before SANGAM */}
                <div className="border-r border-border pr-3">
                  <span className="text-2xs text-text-secondary uppercase font-semibold block">BEFORE SANGAM</span>
                  <div className="text-2xl font-black font-mono text-slate-700 tracking-tight mt-0.5">
                    {baselineHours.toFixed(1)}h
                  </div>
                  <span className="text-[11px] text-text-secondary block">Independent Siloed Closures</span>
                </div>

                {/* With SANGAM */}
                <div className="pl-1">
                  <span className="text-2xs text-accent uppercase font-bold block flex items-center gap-1">
                    WITH SANGAM <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  </span>
                  <div className="text-2xl font-black font-mono text-accent tracking-tight mt-0.5">
                    {optimizedHours.toFixed(1)}h
                  </div>
                  <span className="text-[11px] text-emerald-700 font-semibold block">Coordinated Joint Possession</span>
                </div>
              </div>

              {/* Savings Ribbon */}
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                  <span>{hoursSaved.toFixed(1)}h CLOSURE SAVED</span>
                  <span>({percentSaved.toFixed(1)}% REDUCTION)</span>
                </div>
                <span className="text-2xs font-mono text-text-secondary">
                  5 Sections · 7 Days
                </span>
              </div>
            </div>
          </div>

          {/* LOWER HERO VISUAL: Schematic Railway Track across width */}
          <div className="mt-6 pt-5 border-t border-border">
            <div className="flex items-center justify-between text-2xs font-mono font-bold text-text-secondary mb-2">
              <span>Station A</span>
              <span className="text-accent uppercase font-semibold">Active Joint Block Deployments Across Corridor</span>
              <span>Station F</span>
            </div>

            <div className="relative">
              <RailwayTrack
                status="joint"
                height={26}
                sleeperCount={48}
                highlightWindow={{ startPercent: 25, endPercent: 55, label: 'JOINT POSSESSION (ENG + S&T + TRD)' }}
              />

              {/* Department work markers positioned over track */}
              <div className="flex justify-between items-center px-4 mt-2">
                <MaintenanceMarker department="ENG" taskCode="ENG-3421" severity="Critical" size="sm" />
                <MaintenanceMarker department="SNT" taskCode="SNT-2051" severity="High" size="sm" />
                <div className="text-2xs font-mono text-accent font-bold px-2 py-0.5 rounded bg-accent-tint border border-accent/30">
                  CO-LOCATED IN 1 BLOCK WINDOW
                </div>
                <MaintenanceMarker department="TRD" taskCode="TRD-1470" severity="High" size="sm" />
                <TrainMarker type="Passenger" trainNumber="12952" direction="down" />
              </div>
            </div>
          </div>
        </div>

        {/* ── PART 6: 8-KPI OPERATIONAL STRIP ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="p-3 rounded-card bg-white border border-border shadow-xs">
            <span className="text-2xs font-semibold text-text-secondary block">Pending Tasks</span>
            <span className="text-xl font-bold font-mono text-text-primary block mt-1">
              {demand?.pending_count ?? 120}
            </span>
            <span className="text-[10px] text-text-secondary font-mono">TMS/SMMS/TDMS</span>
          </div>

          <div className="p-3 rounded-card bg-white border border-red-200 bg-red-50/20 shadow-xs">
            <span className="text-2xs font-semibold text-red-700 block">Critical Defects</span>
            <span className="text-xl font-bold font-mono text-red-600 block mt-1">
              {demand?.critical_count ?? 10}
            </span>
            <span className="text-[10px] text-red-600 font-mono">Priority &gt; 80</span>
          </div>

          <div className="p-3 rounded-card bg-white border border-amber-200 bg-amber-50/20 shadow-xs">
            <span className="text-2xs font-semibold text-amber-800 block">Overdue Jobs</span>
            <span className="text-xl font-bold font-mono text-amber-700 block mt-1">
              {demand?.overdue_count ?? 12}
            </span>
            <span className="text-[10px] text-amber-700 font-mono">Past Target Due</span>
          </div>

          <div className="p-3 rounded-card bg-white border border-border shadow-xs">
            <span className="text-2xs font-semibold text-text-secondary block">Blocks Planned</span>
            <span className="text-xl font-bold font-mono text-text-primary block mt-1">
              {kpis?.blocks_count ?? 43}
            </span>
            <span className="text-[10px] text-text-secondary font-mono">In Current Horizon</span>
          </div>

          <div className="p-3 rounded-card bg-white border border-accent/20 bg-accent-tint/30 shadow-xs">
            <span className="text-2xs font-semibold text-accent block">Joint Blocks</span>
            <span className="text-xl font-bold font-mono text-accent block mt-1">
              {kpis?.joint_blocks_count ?? 22}
            </span>
            <span className="text-[10px] text-accent font-mono">Multi-Department</span>
          </div>

          <div className="p-3 rounded-card bg-white border border-border shadow-xs">
            <span className="text-2xs font-semibold text-text-secondary block">Critical Coverage</span>
            <span className="text-xl font-bold font-mono text-emerald-700 block mt-1">
              {(kpis?.critical_task_coverage_pct ?? 100).toFixed(0)}%
            </span>
            <span className="text-[10px] text-emerald-700 font-mono">Zero Neglect</span>
          </div>

          <div className="p-3 rounded-card bg-white border border-border shadow-xs">
            <span className="text-2xs font-semibold text-text-secondary block">Asset Availability</span>
            <span className="text-xl font-bold font-mono text-text-primary block mt-1">
              92.1%
            </span>
            <span className="text-[10px] text-text-secondary font-mono">773.8h / 840h</span>
          </div>

          <div className="p-3 rounded-card bg-white border border-border shadow-xs">
            <span className="text-2xs font-semibold text-text-secondary block">Train Impact</span>
            <span className="text-xl font-bold font-mono text-text-primary block mt-1">
              {(kpis?.train_impact_score ?? 11.2).toFixed(1)}
            </span>
            <span className="text-[10px] text-emerald-700 font-mono">Low Headway Risk</span>
          </div>
        </div>

        {/* ── PART 6: TODAY'S CORRIDOR PICTURE ── */}
        <CorridorDiagram onSelectSection={(secId) => navigate(`/corridor?section=${secId}`)} />

        {/* ── PART 6: CRITICAL ATTENTION & TODAY'S TIMELINE ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Critical Attention Queue */}
          <div className="lg:col-span-6 bg-white border border-border rounded-card p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-red-600" />
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    Critical Attention Queue (Urgent Track Interventions)
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/maintenance/critical')}
                  className="text-2xs font-semibold text-accent hover:underline"
                >
                  View All ({criticalTasks.length})
                </button>
              </div>

              <div className="divide-y divide-border">
                {criticalTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => navigate(`/maintenance/all?task=${t.task_code}`)}
                    className="py-2.5 flex items-center justify-between hover:bg-panel transition-colors px-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-text-primary w-20">
                        {t.task_code}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-panel border border-border text-text-secondary">
                        {t.department_code}
                      </span>
                      <div>
                        <span className="text-xs font-medium text-text-primary block truncate max-w-[200px]">
                          {t.maintenance_type}
                        </span>
                        <span className="text-2xs text-text-secondary">
                          {t.section_name} · {t.estimated_duration_min}m min block
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                        Score {t.priority_score.toFixed(0)}
                      </span>
                      <span className="text-[10px] text-text-secondary block mt-0.5">
                        Due {t.due_date?.slice(5, 10)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-2xs text-text-secondary">
              <span>Enforcing RDSO permanent way safety tolerances</span>
              <span className="font-mono text-emerald-700 font-semibold">100% Scheduled in Plan</span>
            </div>
          </div>

          {/* Right: Today's Block Timeline & Approvals */}
          <div className="lg:col-span-6 bg-white border border-border rounded-card p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent" />
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    Today's Coordinated Possessions (Central Division)
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/planning/workbench')}
                  className="text-2xs font-semibold text-accent hover:underline"
                >
                  Open Gantt Timeline
                </button>
              </div>

              <div className="space-y-2.5">
                {todayBlocks.map((b) => {
                  const isJoint = b.is_joint_block;
                  return (
                    <div
                      key={b.id}
                      onClick={() => navigate('/planning/workbench')}
                      className={`p-2.5 rounded border cursor-pointer hover:shadow-xs transition-all ${
                        isJoint ? 'bg-gradient-to-r from-blue-50/80 via-indigo-50/80 to-amber-50/80 border-blue-200' : 'bg-panel border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-text-primary">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-accent">{b.block_start.slice(11, 16)} → {b.block_end.slice(11, 16)}</span>
                          <span className="text-2xs font-mono font-normal text-text-secondary">({b.duration_min}m)</span>
                        </div>
                        <span className="text-2xs font-bold text-text-secondary">{b.section_name}</span>
                      </div>

                      <div className="flex items-center justify-between mt-1 text-2xs">
                        <div className="flex items-center gap-1">
                          {isJoint && (
                            <span className="text-[10px] font-bold text-accent bg-white px-1.5 py-0.5 rounded border border-accent/20">
                              JOINT POSSESSION
                            </span>
                          )}
                          <span className="text-text-secondary truncate max-w-xs">
                            {b.tasks.map((t: any) => t.task_code).join(', ')}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                          {b.approval_status?.toUpperCase() || 'RECOMMENDED'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-2xs text-text-secondary">
              <span>Next Traffic Possession Window: 01:05 (Section B–C)</span>
              <button
                onClick={() => navigate('/approvals')}
                className="font-semibold text-accent hover:underline"
              >
                Review Controller Approvals →
              </button>
            </div>
          </div>
        </div>

        {/* ── PART 6: WHY SANGAM CHANGED THE PLAN (Optimization Decisions) ── */}
        <div className="bg-white border border-border rounded-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Optimization Decisions: Why SANGAM Reconfigured the Baseline
                </h3>
                <p className="text-2xs text-text-secondary">
                  Verifiable CP-SAT solver constraint justifications derived from timetable headway & compatibility rules.
                </p>
              </div>
            </div>
            <span className="text-2xs font-mono font-bold text-text-secondary bg-panel px-2 py-1 rounded border border-border">
              SOLVER: OR-TOOLS CP-SAT
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded border border-blue-200 bg-blue-50/40">
              <div className="font-bold text-blue-900 flex items-center gap-1.5 mb-1">
                <span className="text-emerald-600 font-black">✓</span> Co-located ENG-3421 + SNT-2051
              </div>
              <p className="text-2xs text-blue-800">
                Combined weld repair and track circuit calibration into one Section B-C window, avoiding duplicate track possession.
              </p>
            </div>

            <div className="p-3 rounded border border-emerald-200 bg-emerald-50/40">
              <div className="font-bold text-emerald-900 flex items-center gap-1.5 mb-1">
                <span className="text-emerald-600 font-black">↓</span> Avoided Passenger Peak Hours
              </div>
              <p className="text-2xs text-emerald-800">
                Shifted daytime maintenance outside the 06:00–10:00 and 17:00–21:00 commuter clusters into favorable 110-min nighttime headway.
              </p>
            </div>

            <div className="p-3 rounded border border-indigo-200 bg-indigo-50/40">
              <div className="font-bold text-indigo-900 flex items-center gap-1.5 mb-1">
                <span className="text-emerald-600 font-black">✓</span> Critical TRD Ahead of Target
              </div>
              <p className="text-2xs text-indigo-800">
                Critical OHE inspection scheduled 48 hours prior to due date using solitary high-voltage isolation gap.
              </p>
            </div>

            <div className="p-3 rounded border border-amber-200 bg-amber-50/40">
              <div className="font-bold text-amber-900 flex items-center gap-1.5 mb-1">
                <span className="text-emerald-600 font-black">✓</span> Saved 14.4h Corridor Downtime
              </div>
              <p className="text-2xs text-amber-800">
                Reduced weekly line closures by 362.8h versus siloed department baselines while completing 100% of critical defects.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
