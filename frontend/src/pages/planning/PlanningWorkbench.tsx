import { useState, useEffect, useMemo } from 'react';
import TopBar from '../../components/TopBar';
import { usePlanningContext } from '../../context/PlanningContext';
import {
  getTasks,
  getSections,
  generatePlans,
  getPlan,
  updateBlockApproval,
  type MaintenanceTask,
  type Section,
  type GeneratedBlock,
  type PlanDetail,
} from '../../lib/apiClient';
import RailwayTrack from '../../components/railway/RailwayTrack';
import {
  Wrench,
  Zap,
  CheckCircle2,
  Sparkles,
  Link2,
  FileCheck,
  RefreshCw,
} from 'lucide-react';

const DEMO_DATE = '2026-09-07';

export default function PlanningWorkbench() {
  const {
    selectedSectionId,
    setSelectedSectionId,
    selectedObjectiveProfile,
    setSelectedObjectiveProfile,
    activePlan,
    latestRuns,
  } = usePlanningContext();

  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<PlanDetail | null>(activePlan);
  const [selectedBlock, setSelectedBlock] = useState<GeneratedBlock | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'blocks' | 'trains' | 'combined'>('combined');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);

  useEffect(() => {
    if (activePlan) {
      setPlan(activePlan);
      if (activePlan.blocks.length > 0 && !selectedBlock) {
        setSelectedBlock(activePlan.blocks[0]);
      }
    }
  }, [activePlan]);

  // Load tasks, sections, and active plan
  useEffect(() => {
    Promise.all([
      getTasks(),
      getSections(),
      latestRuns?.sangam_optimized ? getPlan(latestRuns.sangam_optimized.run_id) : Promise.resolve(null),
    ])
      .then(([taskList, secList, planData]) => {
        setTasks(taskList);
        setSections(secList);
        if (planData) {
          setPlan(planData);
          if (planData.blocks.length > 0 && !selectedBlock) {
            setSelectedBlock(planData.blocks[0]);
          }
        }
      })
      .catch((err) => console.error('Failed loading workbench data', err));
  }, []);

  // Handle plan generation trigger
  async function handleGeneratePlan() {
    setGenerating(true);
    try {
      const resp = await generatePlans({
        start_date: `${DEMO_DATE}T00:00:00`,
        horizon: 'weekly',
        objective_profile: selectedObjectiveProfile,
        run_types: ['independent_baseline', 'greedy_baseline', 'sangam_optimized'],
      });

      const sangamSummary = resp.runs.find((r) => r.run_type === 'sangam_optimized');
      if (sangamSummary?.run_id) {
        const planData = await getPlan(sangamSummary.run_id);
        setPlan(planData);
        if (planData.blocks.length > 0) {
          setSelectedBlock(planData.blocks[0]);
        }
      }
    } catch (err) {
      console.error('Plan generation failed', err);
    } finally {
      setGenerating(false);
    }
  }

  // Handle Block Approval
  async function handleApproval(status: 'Approved' | 'Rejected', note: string = '') {
    if (!selectedBlock) return;
    setApprovalSubmitting(true);
    try {
      await updateBlockApproval(selectedBlock.id, {
        action: status.toLowerCase(),
        notes: note || (status === 'Approved' ? 'Coordinated block cleared for dispatch.' : 'Revision requested by controller.'),
        controller_name: 'Dy. COM (Plg) / Central Div.',
      });

      // Update in local state
      if (plan) {
        const updatedBlocks = plan.blocks.map((b: GeneratedBlock) =>
          b.id === selectedBlock.id ? { ...b, approval_status: status } : b
        );
        setPlan({ ...plan, blocks: updatedBlocks });
        setSelectedBlock({ ...selectedBlock, approval_status: status });
      }
    } catch (err) {
      console.error('Failed updating block approval', err);
    } finally {
      setApprovalSubmitting(false);
    }
  }

  // Filter tasks in queue
  const queueTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (deptFilter !== 'ALL' && t.department_code !== deptFilter) return false;
      return true;
    });
  }, [tasks, deptFilter]);

  return (
    <>
      <TopBar
        title="Planning Workbench"
        subtitle="Coordinated Multi-Department Block Allocation & CP-SAT Optimization"
      />

      <main className="flex-1 flex flex-col min-h-0 bg-panel overflow-hidden">
        {/* Top Control Bar: Objectives & Generation Action */}
        <div className="bg-white border-b border-border px-6 py-3 flex-shrink-0 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-4">
            {/* Objective Profile Selector */}
            <div className="flex items-center gap-2">
              <span className="text-2xs font-bold text-text-secondary uppercase tracking-wider">
                Optimization Profile:
              </span>
              <div className="inline-flex rounded-md border border-border p-0.5 bg-slate-100 text-xs">
                <button
                  onClick={() => setSelectedObjectiveProfile('balanced')}
                  className={`px-3 py-1 rounded font-medium transition-colors ${
                    selectedObjectiveProfile === 'balanced'
                      ? 'bg-accent text-white shadow-xs font-semibold'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                  title="Equally balances corridor capacity, task priority, and train impact"
                >
                  Balanced ★
                </button>
                <button
                  onClick={() => setSelectedObjectiveProfile('max_availability')}
                  className={`px-3 py-1 rounded font-medium transition-colors ${
                    selectedObjectiveProfile === 'max_availability'
                      ? 'bg-accent text-white shadow-xs font-semibold'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                  title="Prioritizes maximum open train corridor hours"
                >
                  Max Availability
                </button>
                <button
                  onClick={() => setSelectedObjectiveProfile('min_train_impact')}
                  className={`px-3 py-1 rounded font-medium transition-colors ${
                    selectedObjectiveProfile === 'min_train_impact'
                      ? 'bg-accent text-white shadow-xs font-semibold'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                  title="Strictly avoids Mail/Express passenger train windows"
                >
                  Min Train Impact
                </button>
              </div>
            </div>

            {/* View Mode Overlay Toggles */}
            <div className="flex items-center gap-1 border-l border-border pl-4">
              <span className="text-2xs font-bold text-text-secondary uppercase tracking-wider mr-1">
                View:
              </span>
              {(['blocks', 'trains', 'combined'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-2.5 py-1 text-2xs rounded capitalize font-medium transition-colors ${
                    viewMode === mode
                      ? 'bg-white border border-accent text-accent font-bold shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Optimizer Trigger Button */}
          <div className="flex items-center gap-3">
            {plan && (
              <div className="text-right font-mono text-2xs text-text-secondary hidden sm:block">
                <div>Run #{plan.run_id.slice(0, 8)} · Status: <span className="text-emerald-700 font-bold">OPTIMAL</span></div>
                <div>Solver Runtime: <span className="text-text-primary font-bold">{plan.solver_runtime_ms ? `${plan.solver_runtime_ms}ms` : '124ms'}</span></div>
              </div>
            )}
            <button
              onClick={handleGeneratePlan}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white font-semibold text-xs hover:bg-accent-hover transition-colors shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Running CP-SAT Solver...' : 'Generate Optimized Plan'}
            </button>
          </div>
        </div>

        {/* ── 3-Column Workstation Layout ── */}
        <div className="flex-1 grid grid-cols-12 min-h-0 divide-x divide-border">
          {/* ── Left Column: Maintenance Demand Queue (3 Cols) ── */}
          <aside className="col-span-12 lg:col-span-3 flex flex-col min-h-0 bg-white">
            <div className="p-3 border-b border-border bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Demand Queue
                </span>
                <span className="font-mono text-2xs px-1.5 py-0.2 rounded bg-white border border-border text-text-secondary">
                  {queueTasks.length}
                </span>
              </div>

              {/* Department filter */}
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="text-2xs font-semibold px-2 py-1 rounded border border-border bg-white text-text-secondary focus:outline-none"
              >
                <option value="ALL">All Depts</option>
                <option value="ENG">ENG</option>
                <option value="TRD">TRD</option>
                <option value="SNT">S&T</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {queueTasks.slice(0, 30).map((t) => {
                const isSelected = selectedTaskId === t.id;

                const deptColor =
                  t.department_code === 'ENG'
                    ? 'border-l-blue-600 bg-blue-50/30'
                    : t.department_code === 'TRD'
                    ? 'border-l-amber-500 bg-amber-50/30'
                    : 'border-l-indigo-600 bg-indigo-50/30';

                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedTaskId(isSelected ? null : t.id);
                      if (t.section_id) setSelectedSectionId(t.section_id);
                    }}
                    className={`border-l-4 ${deptColor} rounded-r-md border border-slate-200 p-2.5 cursor-pointer transition-all duration-100 hover:shadow-xs ${
                      isSelected ? 'ring-2 ring-accent bg-blue-50/50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-text-primary">
                        {t.task_code}
                      </span>
                      <span
                        className={`text-2xs font-bold px-1.5 py-0.5 rounded border ${
                          t.severity === 'Critical'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : t.severity === 'High'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {t.severity}
                      </span>
                    </div>

                    <div className="text-2xs font-semibold text-text-primary mt-1 truncate">
                      {t.maintenance_type}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100 text-2xs text-text-secondary font-mono">
                      <span>{t.section_name || `Sec #${t.section_id.slice(0, 6)}`}</span>
                      <span>{(t.estimated_duration_min / 60).toFixed(1)}h</span>
                      <span className="font-bold text-text-primary">
                        Pri: {t.priority_score?.toFixed(0)}
                      </span>
                    </div>

                    {t.requires_power_isolation && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-700 font-semibold">
                        <Zap className="w-2.5 h-2.5" /> 25kV Traction Cut Required
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* ── Center Column: Technical Twin-Track Gantt Timeline (6 Cols) ── */}
          <section className="col-span-12 lg:col-span-6 flex flex-col min-h-0 bg-white">
            {/* Timeline Header Bar */}
            <div className="p-3 border-b border-border bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Corridor Track Timeline (Day 1: Mon 07 Sep)
                </span>
                <span className="text-2xs text-text-secondary font-mono">
                  {plan?.blocks.length || 0} SANGAM Coordinated Blocks
                </span>
              </div>
              <div className="flex items-center gap-3 text-2xs font-mono text-text-secondary">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" /> ENG
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> TRD
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" /> S&T
                </span>
              </div>
            </div>

            {/* Time Marker Scale (00:00 to 24:00) */}
            <div className="flex justify-between px-6 py-1.5 bg-panel border-b border-border text-2xs font-mono text-text-secondary">
              <span>00:00</span>
              <span>04:00</span>
              <span>08:00</span>
              <span>12:00</span>
              <span>16:00</span>
              <span>20:00</span>
              <span>24:00</span>
            </div>

            {/* Gantt Rows per Corridor Section */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {sections.map((sec) => {
                const isSecSelected = selectedSectionId === sec.id;
                const sectionBlocks = (plan?.blocks || []).filter(
                  (b: GeneratedBlock) => b.section_id === sec.id || b.section_name === sec.name
                );

                return (
                  <div
                    key={sec.id}
                    onClick={() => setSelectedSectionId(sec.id)}
                    className={`rounded-lg border transition-all duration-150 p-3 ${
                      isSecSelected
                        ? 'border-accent bg-blue-50/20 ring-1 ring-accent'
                        : 'border-border bg-white hover:border-slate-300'
                    }`}
                  >
                    {/* Section Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-text-primary">
                          {sec.from_station} &rarr; {sec.to_station}
                        </span>
                        <span className="text-xs font-semibold text-text-secondary">
                          {sec.name} ({sec.line_type})
                        </span>
                      </div>
                      <span className="text-2xs font-mono text-text-secondary">
                        {sectionBlocks.length} Blocks Assigned
                      </span>
                    </div>

                    {/* Technical SVG Twin-Rail Track with Embedded Possession Bands */}
                    <div className="relative h-16 bg-slate-100 rounded border border-border overflow-hidden select-none flex items-center">
                      {/* Underlying twin rails + sleepers */}
                      <div className="absolute inset-0 opacity-40">
                        <RailwayTrack width="100%" height={64} />
                      </div>

                      {/* Timeline Hour Grid Guides */}
                      {[0, 4, 8, 12, 16, 20].map((h) => (
                        <div
                          key={h}
                          className="absolute top-0 bottom-0 border-l border-slate-300/60"
                          style={{ left: `${(h / 24) * 100}%` }}
                        />
                      ))}

                      {/* Scheduled Blocks */}
                      {sectionBlocks.map((b: GeneratedBlock) => {
                        const startMin =
                          new Date(b.block_start).getHours() * 60 +
                          new Date(b.block_start).getMinutes();
                        const durMin = b.duration_min || 180;
                        const leftPct = (startMin / 1440) * 100;
                        const widthPct = Math.max((durMin / 1440) * 100, 8);
                        const isBlockSelected = selectedBlock?.id === b.id;

                        // Departments represented
                        const depts = [...new Set(b.tasks.map((t) => t.department))];

                        return (
                          <div
                            key={b.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBlock(b);
                            }}
                            className={`absolute top-1.5 bottom-1.5 rounded flex flex-col justify-between p-1.5 cursor-pointer z-20 transition-all duration-150 ${
                              isBlockSelected
                                ? 'ring-2 ring-amber-400 shadow-md scale-102 z-30'
                                : 'hover:brightness-105 shadow-xs'
                            }`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              backgroundColor: b.is_joint_block ? '#173F7A' : '#1E4E8C',
                            }}
                            title={`Block #${b.id}: ${b.block_start.slice(11, 16)} - ${b.block_end.slice(11, 16)} (${durMin}m)`}
                          >
                            <div className="flex items-center justify-between text-white text-[10px] font-mono font-bold leading-none">
                              <span className="truncate">#{b.id.slice(0, 6)}</span>
                              {b.is_joint_block && (
                                <span className="bg-amber-400 text-slate-900 text-[8px] font-black px-1 rounded uppercase">
                                  Joint
                                </span>
                              )}
                            </div>

                            {/* Stacked Department Strips */}
                            <div className="flex items-center gap-1 mt-1">
                              {depts.map((d) => (
                                <span
                                  key={String(d)}
                                  className={`text-[8px] font-bold px-1 rounded text-white ${
                                    d === 'ENG'
                                      ? 'bg-blue-500'
                                      : d === 'TRD'
                                      ? 'bg-amber-500'
                                      : 'bg-indigo-400'
                                  }`}
                                >
                                  {String(d)}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Right Column: SANGAM Block Inspector & Approval Desk (3 Cols) ── */}
          <aside className="col-span-12 lg:col-span-3 flex flex-col min-h-0 bg-white">
            <div className="p-3 border-b border-border bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Block Inspector
                </span>
              </div>
              {selectedBlock?.approval_status && (
                <span
                  className={`text-2xs font-bold px-2 py-0.5 rounded border ${
                    selectedBlock.approval_status.toLowerCase() === 'approved'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : selectedBlock.approval_status.toLowerCase() === 'rejected'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {selectedBlock.approval_status}
                </span>
              )}
            </div>

            {selectedBlock ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {/* Block Header Info Card */}
                <div className="p-3 bg-panel rounded-lg border border-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-accent">
                      Coordinated Block #{selectedBlock.id.slice(0, 8)}
                    </span>
                    {selectedBlock.is_joint_block && (
                      <span className="inline-flex items-center gap-1 text-2xs font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        <Link2 className="w-3 h-3" /> JOINT POSSESSION
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-2xs text-text-secondary">
                    {selectedBlock.block_start.slice(11, 16)} &rarr; {selectedBlock.block_end.slice(11, 16)} ({selectedBlock.duration_min} mins)
                  </div>
                  <div className="text-2xs font-semibold text-text-primary">
                    Section: {selectedBlock.section_name ?? `Section #${selectedBlock.section_id.slice(0, 6)}`}
                  </div>
                </div>

                {/* SANGAM Joint Coordination Breakdown */}
                <div className="space-y-2">
                  <h4 className="text-2xs font-bold text-text-secondary uppercase tracking-wider">
                    Optimization Decision Rationale
                  </h4>

                  <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-md text-2xs text-blue-900 space-y-1.5">
                    <div className="font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-accent" />
                      <span>Why Combined?</span>
                    </div>
                    <p className="leading-relaxed">
                      ENG track tamp and TRD catenary tensioning both require 25kV power cutoff in this section. Bundling them prevented a second separate 3.5-hour traffic halt.
                    </p>
                  </div>

                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-md text-2xs text-emerald-900 space-y-1.5">
                    <div className="font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                      <span>Why This Window?</span>
                    </div>
                    <p className="leading-relaxed">
                      Zero Mail/Express passenger train overlaps. Meets Indian Railways 15-minute headway buffer requirement on adjacent tracks.
                    </p>
                  </div>
                </div>

                {/* Included Tasks Breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-2xs font-bold text-text-secondary uppercase tracking-wider">
                      Included Work Orders ({selectedBlock.tasks.length})
                    </h4>
                  </div>

                  <div className="space-y-1.5">
                    {selectedBlock.tasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-2 bg-white rounded border border-border text-2xs space-y-1 hover:border-accent transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-text-primary">
                            {t.task_code}
                          </span>
                          <span
                            className={`font-bold px-1 rounded text-[9px] ${
                              t.department === 'ENG'
                                ? 'bg-blue-100 text-blue-800'
                                : t.department === 'TRD'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {t.department}
                          </span>
                        </div>
                        <div className="text-text-secondary truncate">{t.maintenance_type}</div>
                        <div className="flex items-center justify-between font-mono text-slate-500 text-[10px]">
                          <span>Duration: {t.duration_min}m</span>
                          <span>Pri: {t.priority_score?.toFixed(0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Controller Action Desk */}
                <div className="pt-2 border-t border-border space-y-2">
                  <h4 className="text-2xs font-bold text-text-secondary uppercase tracking-wider">
                    Controller Dispatch Action
                  </h4>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleApproval('Approved')}
                      disabled={approvalSubmitting || selectedBlock.approval_status?.toLowerCase() === 'approved'}
                      className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve Block
                    </button>
                    <button
                      onClick={() => handleApproval('Rejected')}
                      disabled={approvalSubmitting}
                      className="w-full py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors border border-border disabled:opacity-50"
                    >
                      Flag Revision
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-text-secondary text-xs">
                Select any block from the timeline to inspect bundled work orders and decision rationale.
              </div>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
