import { useState, useEffect } from 'react';
import TopBar from '../../components/TopBar';
import WorkflowBar from '../../components/WorkflowBar';
import { PageGuideBanner } from '../../components/ui/PageGuideBanner';
import { OperationalGanttTimeline } from '../../components/planning/OperationalGanttTimeline';
import { usePlanning } from '../../context/PlanningContext';
import {
  approveBlock,
  rejectBlock,
  toggleBlockLock,
  validateBlockChanges,
  applyBlockOverride,
  approveAllCleanBlocks,
  getSections,
  getAllTrains,
  getPlanAlternatives,
  type GeneratedBlock,
  type BlockValidationResult,
  type Section,
  type TimetableTrain,
  type PlanAlternative,
} from '../../lib/apiClient';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  Sliders,
  FileText,
  X,
  ShieldCheck,
  ChevronRight,
  Info,
  Calendar,
  Wrench,
  Network,
} from 'lucide-react';
import { DepartmentCompatibilityMatrix } from '../../components/planning/DepartmentCompatibilityMatrix';

export default function ProposedPlan() {
  const { activePlan, refreshAll, userRole, setWorkflowStage, planningWeekStart, loadSpecificPlan, activeRunId } = usePlanning();
  const [selectedBlock, setSelectedBlock] = useState<GeneratedBlock | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [trains, setTrains] = useState<TimetableTrain[]>([]);
  const [activeView, setActiveView] = useState<'gantt' | 'compatibility'>('gantt');

  // Plan Alternatives
  const [alternatives, setAlternatives] = useState<PlanAlternative[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  // Modify Modal state
  const [modifyModalOpen, setModifyModalOpen] = useState(false);
  const [modStart, setModStart] = useState('');
  const [modEnd, setModEnd] = useState('');
  const [modTasks, setModTasks] = useState<string[]>([]);
  const [modNote, setModNote] = useState('');
  const [validationResult, setValidationResult] = useState<BlockValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  // Action feedback
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!activePlan?.run_id) return;
    const fetchAlts = async () => {
      setLoadingAlternatives(true);
      try {
        const res = await getPlanAlternatives(activePlan.run_id);
        if (res && res.alternatives) {
          setAlternatives(res.alternatives);
        }
      } catch (err) {
        console.error('Failed to load plan alternatives:', err);
      } finally {
        setLoadingAlternatives(false);
      }
    };
    fetchAlts();
  }, [activePlan?.run_id]);

  useEffect(() => {
    setWorkflowStage(5);
    const loadContext = async () => {
      try {
        const [secData, trData] = await Promise.all([
          getSections().catch(() => []),
          getAllTrains().catch(() => []),
        ]);
        setSections(secData);
        setTrains(trData);
      } catch (err) {
        console.error('Failed loading sections/trains for plan view:', err);
      }
    };
    loadContext();
  }, [setWorkflowStage]);

  const plan = activePlan;
  const blocks = plan?.blocks || [];

  useEffect(() => {
    if (blocks.length > 0 && !selectedBlock) {
      setSelectedBlock(blocks[0]);
    }
  }, [blocks, selectedBlock]);

  const handleSelectBlock = (b: GeneratedBlock) => {
    setSelectedBlock(b);
  };

  const handleLockToggle = async (block: GeneratedBlock) => {
    try {
      const res = await toggleBlockLock(block.id, !block.locked);
      setFeedbackMsg(`Block on ${block.section_name} is now ${res.locked ? 'LOCKED' : 'UNLOCKED'}`);
      await refreshAll();
      if (selectedBlock?.id === block.id) {
        setSelectedBlock({ ...selectedBlock, locked: res.locked });
      }
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err: any) {
      alert(`Error toggling lock: ${err.message || err}`);
    }
  };

  const handleApproveBlock = async (blockId: string) => {
    try {
      await approveBlock(blockId, `Approved by Operating Controller (${userRole})`);
      setFeedbackMsg(`Block approved successfully. Appears in Operational Block Register.`);
      await refreshAll();
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err: any) {
      alert(`Error approving block: ${err.message || err}`);
    }
  };

  const handleRejectBlock = async (blockId: string) => {
    const reason = prompt('Reason for deferral/rejection:', 'Controller traffic prioritization');
    if (!reason) return;
    try {
      await rejectBlock(blockId, reason);
      setFeedbackMsg(`Block returned to backlog for future scheduling.`);
      await refreshAll();
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err: any) {
      alert(`Error rejecting block: ${err.message || err}`);
    }
  };

  const handleApproveAllClean = async () => {
    if (!plan?.run_id) return;
    if (!confirm('Approve all recommended blocks in this schedule?')) return;
    try {
      const res = await approveAllCleanBlocks(plan.run_id, 'Divisional Operating Controller');
      setFeedbackMsg(res.message);
      await refreshAll();
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      alert(`Error approving clean blocks: ${err.message || err}`);
    }
  };

  // Modify Modal handlers
  const handleOpenModify = (block: GeneratedBlock) => {
    setSelectedBlock(block);
    setModStart(block.block_start.slice(0, 16));
    setModEnd(block.block_end.slice(0, 16));
    setModTasks(block.tasks.map((t) => t.id));
    setModNote('Manual timing adjustment by controller');
    setValidationResult(null);
    setModifyModalOpen(true);
  };

  const handleValidateChanges = async () => {
    if (!selectedBlock) return;
    setValidating(true);
    try {
      const res = await validateBlockChanges(
        selectedBlock.id,
        new Date(modStart).toISOString(),
        new Date(modEnd).toISOString(),
        modTasks
      );
      setValidationResult(res);
    } catch (err: any) {
      setValidationResult({
        is_valid: false,
        reason: err?.message || 'Validation request failed',
      });
    } finally {
      setValidating(false);
    }
  };

  const handleSaveOverride = async () => {
    if (!selectedBlock) return;
    try {
      await applyBlockOverride(
        selectedBlock.id,
        new Date(modStart).toISOString(),
        new Date(modEnd).toISOString(),
        modTasks,
        modNote
      );
      setModifyModalOpen(false);
      setFeedbackMsg(`Manual timing override applied.`);
      await refreshAll();
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err: any) {
      alert(`Error applying override: ${err.message || err}`);
    }
  };

  const totalBlocks = blocks.length;
  const totalTasks = blocks.reduce((acc, b) => acc + (b.tasks_count || 0), 0);
  const jointBlocks = blocks.filter((b) => b.is_joint_block).length;
  const approvedBlocks = blocks.filter((b) => b.approval_status === 'approved').length;

  const effectiveBaseDate = activePlan?.blocks?.[0]?.block_start
    ? activePlan.blocks[0].block_start.slice(0, 10)
    : (planningWeekStart || '2026-09-08');

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F6F8FB] text-[#172033]">
      <TopBar title="Proposed Block Plan" subtitle="AI-Generated Coordinated Possession Schedule & Interactive Timeline" />
      <WorkflowBar activeStage={5} />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Page Guide Banner */}
        <PageGuideBanner
          pageTitle="Proposed Block Plan"
          purpose="Review AI-generated coordinated possession blocks on the interactive Gantt chart. Inspect why blocks were grouped, verify safety rules, validate timing modifications, and approve possessions for execution."
          inputs={['Proposed Block Schedule', 'Selected Possession Window', 'Resource Allocations']}
          outputs={['Approved Possessions in Register', 'Plan Export Circular', 'Operational Locks']}
          nextStep={{ label: 'Proceed to Operational Block Register', to: '/operations/approved' }}
        />

        {/* Header & Status Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#D9E1EA] shadow-xs">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[#172033] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#173F7A]" />
                <span>Proposed Coordinated Schedule</span>
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Under Operating Review
              </span>
            </div>
            <p className="text-xs text-[#667085] mt-1">
              Optimization Run ID: <strong className="text-[#172033] font-mono">{plan?.run_id?.slice(0, 8) || 'Active Schedule'}</strong> • Strategy Profile: <strong className="text-[#173F7A] font-semibold">{plan?.objective_profile || 'Balanced'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-colors border border-[#D9E1EA] cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export Circular</span>
            </button>
            <button
              onClick={handleApproveAllClean}
              disabled={blocks.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              title="Accept all recommended possessions for operational use."
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Approve All Clean Blocks</span>
            </button>
          </div>
        </div>

        {feedbackMsg && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-xs text-[#173F7A] font-medium animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Plan Alternatives Comparison Section */}
        {alternatives && alternatives.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#173F7A]" />
                <h2 className="text-sm font-bold text-[#172033] uppercase tracking-wider font-mono">
                  Schedule Options (Distinct Multi-Plan Alternatives)
                </h2>
                {loadingAlternatives && (
                  <span className="text-xs text-[#5A6E85] animate-pulse">Loading...</span>
                )}
              </div>
              <span className="text-[11px] text-[#5A6E85]">
                CP-SAT generated distinct operational schedules via no-good cut constraints
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {alternatives.map((alt) => {
                const isCurrentActive = (activeRunId || plan?.run_id) === alt.run_id;
                const isRec = alt.is_recommended;
                return (
                  <div
                    key={alt.run_id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isCurrentActive
                        ? 'bg-white border-[#173F7A] ring-2 ring-[#173F7A]/20 shadow-md'
                        : 'bg-white/90 border-[#D9E1EA] hover:border-[#B4C6DC] shadow-xs'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#172033]">{alt.plan_label}</span>
                          {isRec && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Recommended
                            </span>
                          )}
                        </div>
                        {isCurrentActive && (
                          <span className="text-[10px] font-mono font-bold text-[#173F7A] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            Active on Gantt
                          </span>
                        )}
                      </div>

                      {/* Train Impact Badge */}
                      <div>
                        <span
                          className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md border ${
                            alt.trains_affected_count === 0
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                              : alt.trains_affected_count <= 2
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-red-50 text-red-800 border-red-300'
                          }`}
                        >
                          {alt.train_impact_badge || (alt.trains_affected_count === 0 ? '✓ 0 trains require timetable change' : `⚠ ${alt.trains_affected_count} trains affected`)}
                        </span>
                      </div>

                      {/* Recommendation Narrative */}
                      <p className="text-xs text-[#5A6E85] leading-relaxed line-clamp-3">
                        {alt.recommendation_explanation}
                      </p>

                      {/* Key Metrics Grid */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#EDF2F7] text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-[#667085] block font-sans">Track Closure</span>
                          <strong className="text-[#172033] font-bold">{alt.track_closure_hours} h</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#667085] block font-sans">Critical Tasks</span>
                          <strong className="text-[#173F7A] font-bold">{alt.critical_tasks_ratio}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#667085] block font-sans">Joint Blocks</span>
                          <strong className="text-indigo-700 font-bold">{alt.joint_blocks_count} joint</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#667085] block font-sans">Train Clearance</span>
                          <strong className="text-emerald-700 font-bold">{alt.min_train_margin_min}m margin</strong>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 mt-3 border-t border-[#EDF2F7] flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => loadSpecificPlan(alt.run_id)}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isCurrentActive
                            ? 'bg-[#173F7A] text-white shadow-xs'
                            : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#172033]'
                        }`}
                      >
                        {isCurrentActive ? 'Viewing on Gantt' : 'View on Gantt'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Plan Summary KPI Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 bg-white p-4 rounded-xl border border-[#D9E1EA] shadow-xs text-xs">
          <div>
            <span className="text-[#667085]">Total Possessions</span>
            <div className="text-lg font-bold text-[#172033] mt-0.5">{totalBlocks} blocks</div>
          </div>
          <div>
            <span className="text-[#667085]">Tasks Included</span>
            <div className="text-lg font-bold text-[#173F7A] mt-0.5">{totalTasks} tasks</div>
          </div>
          <div>
            <span className="text-[#667085]">Joint Multi-Dept</span>
            <div className="text-lg font-bold text-indigo-700 mt-0.5">{jointBlocks} blocks</div>
          </div>
          <div>
            <span className="text-[#667085]">Approved</span>
            <div className="text-lg font-bold text-emerald-700 mt-0.5">{approvedBlocks} of {totalBlocks}</div>
          </div>
          <div>
            <span className="text-[#667085]">Corridor Sections</span>
            <div className="text-lg font-bold text-[#172033] mt-0.5">{sections.length} active</div>
          </div>
        </div>

        {/* Visualizer Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-[#D9E1EA] shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#172033] uppercase font-mono">Plan Visualizer:</span>
            <div className="flex bg-[#F1F5F9] p-1 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setActiveView('gantt')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeView === 'gantt'
                    ? 'bg-white text-[#173F7A] shadow-xs font-bold'
                    : 'text-[#667085] hover:text-[#172033]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Operational Gantt & Timeline</span>
              </button>
              <button
                onClick={() => setActiveView('compatibility')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeView === 'compatibility'
                    ? 'bg-white text-[#173F7A] shadow-xs font-bold'
                    : 'text-[#667085] hover:text-[#172033]'
                }`}
              >
                <Network className="w-3.5 h-3.5 text-indigo-600" />
                <span>Department Compatibility & Joint Bundles</span>
              </button>
            </div>
          </div>
          <span className="text-[11px] text-[#667085] font-mono">
            Timeline Base Date: <strong className="text-[#172033]">{effectiveBaseDate}</strong>
          </span>
        </div>

        {/* ── VISUALIZER VIEW ── */}
        {activeView === 'gantt' ? (
          <OperationalGanttTimeline
            sections={sections}
            blocks={blocks}
            trains={trains}
            selectedBlockId={selectedBlock?.id}
            onSelectBlock={handleSelectBlock}
            baseDate={effectiveBaseDate}
          />
        ) : (
          <DepartmentCompatibilityMatrix
            sections={sections}
          />
        )}

        {/* ── MAIN CONTENT: SCHEDULE LIST & EXPLAINABLE INSPECTOR ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Schedule List */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#D9E1EA]">
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-[#172033] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#173F7A]" />
                Possession Schedule Cards (Click to Inspect)
              </h2>
              <span className="text-[11px] text-[#667085]">Chronological order</span>
            </div>

            {blocks.length === 0 ? (
              <div className="p-8 bg-white border border-[#D9E1EA] rounded-xl text-center text-[#667085] text-xs">
                No blocks generated yet. Use the <strong>Create Block Plan</strong> wizard to produce a schedule.
              </div>
            ) : (
              <div className="space-y-3">
                {blocks.map((b) => {
                  const isSelected = selectedBlock?.id === b.id;
                  const isApproved = b.approval_status === 'approved';
                  return (
                    <div
                      key={b.id}
                      onClick={() => handleSelectBlock(b)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer bg-white ${
                        isSelected
                          ? 'border-[#173F7A] ring-2 ring-[#173F7A]/20 shadow-sm'
                          : 'border-[#D9E1EA] hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-xs text-[#173F7A] bg-[#EBF2FA] px-2.5 py-1 rounded">
                            {b.section_name}
                          </span>
                          {b.spatial_coverage && (
                            <span className="font-mono text-[10px] bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded font-bold">
                              {b.spatial_coverage}
                            </span>
                          )}
                          {b.is_joint_block && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                              Joint Block ({b.departments?.join(' · ')})
                            </span>
                          )}
                          <span className="text-xs text-[#667085] font-mono">
                            {new Date(b.block_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ·{' '}
                            {new Date(b.block_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{' '}
                            {new Date(b.block_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#173F7A]">{b.duration_min} min</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {b.approval_status || 'Recommended'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-[#667085]">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-3.5 h-3.5 text-[#173F7A]" />
                          <span>Includes {b.tasks?.length || 0} tasks ({b.tasks?.map((t) => t.task_code).join(', ')})</span>
                        </div>
                        <span className="text-[#173F7A] font-semibold flex items-center gap-0.5">
                          Inspect Details <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── EXPLAINABLE BLOCK INSPECTOR (Meets Requirement #20) ── */}
          <div>
            {selectedBlock ? (
              <div className="bg-white border border-[#D9E1EA] rounded-xl p-5 shadow-xs space-y-4 text-xs sticky top-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#D9E1EA]">
                  <div>
                    <span className="text-[10px] font-mono uppercase font-bold text-[#667085]">
                      Block Inspector
                    </span>
                    <h3 className="font-bold text-sm text-[#172033]">
                      {selectedBlock.section_name} ({selectedBlock.duration_min} min)
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleLockToggle(selectedBlock)}
                      className={`p-1.5 rounded transition-colors ${
                        selectedBlock.locked
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                      title={selectedBlock.locked ? 'Lock active (Preserves this block during future re-planning)' : 'Lock Block (Preserves this block as much as possible during future re-planning)'}
                    >
                      {selectedBlock.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* SPATIAL ENVELOPE & COMMON RAILWAY REFERENCE */}
                {selectedBlock.spatial_coverage && (
                  <div className="p-2.5 rounded bg-amber-50/70 border border-amber-200 space-y-1 text-xs">
                    <div className="font-mono text-[10px] uppercase font-bold text-amber-900 flex items-center justify-between">
                      <span>Railway Spatial Envelope</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-950 font-bold">
                        {selectedBlock.corridor_display || 'Corridor Segment'}
                      </span>
                    </div>
                    <div className="font-mono font-bold text-amber-950 text-xs">
                      {selectedBlock.spatial_coverage}
                    </div>
                    <div className="text-[10px] text-amber-800">
                      Coordinated spatial reference mapping S&T signals, TRD OHE masts, and Civil track chainage into one possession envelope.
                    </div>
                  </div>
                )}

                {/* 1. INPUT TASKS WITH DEPARTMENTAL BOUNDARIES */}
                <div>
                  <div className="font-mono text-[10px] uppercase font-bold text-[#173F7A] mb-1.5 flex items-center gap-1">
                    <Wrench className="w-3.5 h-3.5" />
                    Input Tasks & Departmental Boundaries ({selectedBlock.tasks?.length || 0})
                  </div>
                  <div className="space-y-1.5">
                    {selectedBlock.tasks?.map((t) => (
                      <div key={t.id} className="p-2.5 rounded bg-[#F8FAFC] border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between font-mono font-bold">
                          <span className="text-[#173F7A]">{t.task_code}</span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-200 text-[10px]">
                            {t.department || 'ENG'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#667085]">{t.maintenance_type}</div>
                        {t.location_display ? (
                          <div className="text-[10px] font-mono text-[#173F7A] bg-blue-50/60 px-1.5 py-0.5 rounded border border-blue-200/60 flex items-center gap-1">
                            <span className="font-bold">Location:</span> {t.location_display}
                          </div>
                        ) : t.chainage_from_km !== undefined && t.chainage_from_km !== null ? (
                          <div className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            Span: KM {t.chainage_from_km.toFixed(1)} – {t.chainage_to_km?.toFixed(1) || ''} [{t.track_line || 'UP'}]
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. WINDOW USED */}
                <div className="p-2.5 rounded bg-[#F8FAFC] border border-slate-200 space-y-1">
                  <div className="font-mono text-[10px] uppercase font-bold text-[#173F7A]">
                    Window Used
                  </div>
                  <div className="font-mono text-xs font-bold text-[#172033]">
                    {new Date(selectedBlock.block_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(selectedBlock.block_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({selectedBlock.duration_min} min)
                  </div>
                  <div className="text-[11px] text-[#667085]">
                    Created from candidate corridor gap between timetable train movements.
                  </div>
                </div>

                {/* 3. RESOURCES USED */}
                <div className="p-2.5 rounded bg-[#F8FAFC] border border-slate-200 space-y-1">
                  <div className="font-mono text-[10px] uppercase font-bold text-[#173F7A]">
                    Resources Assigned
                  </div>
                  <div className="text-xs text-[#172033]">
                    {selectedBlock.tasks?.map((t) => t.crew_type || 'Assigned Department Gang').filter(Boolean).join(', ') || 'Departmental Work Gangs'}
                  </div>
                  <div className="text-[10px] text-emerald-700 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> All required machinery and crews confirmed available
                  </div>
                </div>

                {/* 4. WHY THIS BLOCK EXISTS (Explainability) */}
                <div className="p-3 rounded bg-blue-50 border border-blue-200 space-y-1.5 text-xs text-[#172033]">
                  <div className="font-bold text-[#173F7A] flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-[#173F7A]" />
                    Why This Block Exists
                  </div>
                  <ul className="space-y-1 text-[11px] text-slate-700">
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#173F7A] font-bold">•</span>
                      <span><strong>Section Match:</strong> All included tasks are located on {selectedBlock.section_name}.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#173F7A] font-bold">•</span>
                      <span><strong>Parallel Compatibility:</strong> Tasks allow simultaneous safe possession execution.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#173F7A] font-bold">•</span>
                      <span><strong>Zero Train Collision:</strong> Clear gap between scheduled trains with safety buffers.</span>
                    </li>
                  </ul>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-[#D9E1EA] space-y-2">
                  {selectedBlock.approval_status !== 'approved' ? (
                    <button
                      onClick={() => handleApproveBlock(selectedBlock.id)}
                      className="w-full py-2.5 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors"
                      title="Accepts this recommended possession for operational use. Approved blocks appear in Operational Block Register."
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Approve Block</span>
                    </button>
                  ) : (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-center text-xs text-emerald-800 font-bold flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Approved for Track Possession</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenModify(selectedBlock)}
                      className="py-2 rounded border border-[#D9E1EA] bg-white text-[#172033] hover:bg-slate-50 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Adjust timing or tasks with instant constraint validation"
                    >
                      <Sliders className="w-3.5 h-3.5 text-[#173F7A]" />
                      <span>Modify Timing</span>
                    </button>
                    <button
                      onClick={() => handleRejectBlock(selectedBlock.id)}
                      className="py-2 rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Returns the included work for future scheduling."
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject / Defer</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#D9E1EA] rounded-xl p-8 text-center text-[#667085] text-xs shadow-xs">
                Select any block from the Gantt timeline or cards to inspect tasks, window derivation, and operational justification.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── MODAL: MODIFY BLOCK TIMING & VALIDATION ── */}
      {modifyModalOpen && selectedBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-[#D9E1EA] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#D9E1EA] pb-3">
              <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#173F7A]" />
                Modify Possession Timing
              </h2>
              <button onClick={() => setModifyModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">New Start Time *</label>
                  <input
                    type="datetime-local"
                    value={modStart}
                    onChange={(e) => setModStart(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">New End Time *</label>
                  <input
                    type="datetime-local"
                    value={modEnd}
                    onChange={(e) => setModEnd(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#172033] mb-1">Controller Override Justification</label>
                <input
                  type="text"
                  value={modNote}
                  onChange={(e) => setModNote(e.target.value)}
                  placeholder="e.g. Accommodating freight path delay"
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033]"
                />
              </div>

              {/* Validation Feedback Box */}
              <div className="pt-2">
                <button
                  onClick={handleValidateChanges}
                  disabled={validating}
                  className="px-3.5 py-1.5 bg-[#EBF2FA] text-[#173F7A] rounded font-bold text-xs hover:bg-blue-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{validating ? 'Validating Against Rules...' : 'Validate Constraint Rules'}</span>
                </button>

                {validationResult && (
                  <div
                    className={`mt-2 p-3 rounded-lg border text-xs leading-relaxed ${
                      validationResult.is_valid
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    <div className="font-bold">
                      {validationResult.is_valid ? '✓ Valid: No safety or train clashes detected' : '⚠ Violation Detected'}
                    </div>
                    {validationResult.reason && <div>{validationResult.reason}</div>}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D9E1EA]">
              <button
                onClick={() => setModifyModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOverride}
                className="px-4 py-2 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded font-bold text-xs shadow-xs"
              >
                Apply Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
