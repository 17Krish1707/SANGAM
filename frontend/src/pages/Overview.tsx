import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import WorkflowBar from '../components/WorkflowBar';
import { PageGuideBanner } from '../components/ui/PageGuideBanner';
import { usePlanning } from '../context/PlanningContext';
import {
  getDashboardSummary,
  getTasks,
  getPlan,
  getResources,
  getAllTrains,
  getAllWindows,
  getSections,
  type MaintenanceTask,
  type GeneratedBlock,
  type ResourceItem,
  type TimetableTrain,
  type CorridorWindowFull,
  type Section,
} from '../lib/apiClient';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  Train,
  Wrench,
  X,
  ExternalLink,
  Layers,
  Sparkles,
  Check,
  RefreshCw,
  Zap,
} from 'lucide-react';

export default function Overview() {
  const navigate = useNavigate();
  const { userRole, setWorkflowStage } = usePlanning();

  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [blocks, setBlocks] = useState<GeneratedBlock[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [trains, setTrains] = useState<TimetableTrain[]>([]);
  const [windows, setAllWindows] = useState<CorridorWindowFull[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  // Section inspector drawer
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [sectionDrawerOpen, setSectionDrawerOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dashData, allTasks, resList, trainList, winList, secList] = await Promise.all([
        getDashboardSummary().catch(() => ({ latest_runs: {} })),
        getTasks().catch(() => []),
        getResources().catch(() => []),
        getAllTrains().catch(() => []),
        getAllWindows().catch(() => []),
        getSections().catch(() => []),
      ]);
      setTasks(allTasks);
      setResources(resList);
      setTrains(trainList);
      setAllWindows(winList);
      setSections(secList);

      const optId = (dashData.latest_runs as any)?.sangam_optimized;
      if (optId) {
        const plan = await getPlan(optId).catch(() => ({ blocks: [] }));
        setBlocks(plan.blocks || []);
      }
    } catch (err) {
      console.error('Failed loading overview dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Total corridor stats linking with Train & Corridor Data
  const totalLengthKm = sections.reduce((acc, s) => acc + (s.length_km || 0), 0);
  const passengerTrains = trains.filter((t) => t.train_type === 'Passenger');
  const freightTrains = trains.filter((t) => t.train_type === 'Goods');
  const availableWindows = windows.filter((w) => w.is_available);
  const restrictedWindows = windows.filter((w) => !w.is_available);

  const pendingTasks = tasks.filter((t) => t.status === 'Pending' || t.status === 'New' || t.status === 'Ready for Planning');
  const criticalTasks = pendingTasks.filter((t) => t.severity === 'Critical');
  const overdueTasks = pendingTasks.filter((t) => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return d < new Date() || d < new Date('2026-09-09T00:00:00');
  });

  const unavailableResources = resources.filter((r) => !r.is_available);
  const approvedBlocks = blocks.filter((b) => b.approval_status === 'approved');
  const pendingApprovalBlocks = blocks.filter((b) => b.approval_status === 'recommended' || !b.approval_status);

  // Next block info
  const nextBlock = blocks[0];
  const nextBlockTimeStr = nextBlock
    ? `${new Date(nextBlock.block_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · ${nextBlock.section_name?.split(' ')[1] || 'B-C'} · ${new Date(nextBlock.block_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${new Date(nextBlock.block_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'No blocks scheduled yet';

  const planStatus = blocks.length === 0
    ? 'Not Generated'
    : approvedBlocks.length === blocks.length
    ? 'Approved'
    : 'Under Review';

  const isDatabaseEmpty = sections.length === 0 && tasks.length === 0 && trains.length === 0;

  const handleContinuePlanning = () => {
    if (sections.length === 0 || trains.length === 0) {
      setWorkflowStage(2);
      navigate('/corridor-data');
    } else if (tasks.length === 0) {
      setWorkflowStage(1);
      navigate('/maintenance');
    } else if (resources.length === 0) {
      setWorkflowStage(3);
      navigate('/resources');
    } else if (blocks.length === 0) {
      setWorkflowStage(4);
      navigate('/planning/create');
    } else if (pendingApprovalBlocks.length > 0) {
      setWorkflowStage(6);
      navigate('/operations/approved');
    } else {
      setWorkflowStage(5);
      navigate('/planning/proposed');
    }
  };

  const activeSection = sections.find((s) => s.id === selectedSectionId || s.name === selectedSectionId);

  const handleOpenSection = (secId: string) => {
    setSelectedSectionId(secId);
    setSectionDrawerOpen(true);
  };

  const sectionTasks = tasks.filter(
    (t) => activeSection && (t.section_id === activeSection.id || t.section_name === activeSection.name)
  );
  const sectionTrains = trains.filter(
    (tr) => activeSection && (tr.section_id === activeSection.id || tr.section_name === activeSection.name)
  );
  const sectionWindows = windows.filter(
    (w) => activeSection && (w.section_id === activeSection.id || w.section_name === activeSection.name)
  );
  const sectionBlocks = blocks.filter(
    (b) => activeSection && (b.section_id === activeSection.id || b.section_name === activeSection.name)
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F6F8FB] text-[#172033]">
      <TopBar title="Operations Overview" subtitle="Indian Railways Joint Corridor Planning Workstation" />
      <WorkflowBar activeStage={1} />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Page Guide Banner */}
        <PageGuideBanner
          pageTitle="Operations Overview"
          purpose="Provides an executive control-room snapshot of active corridor infrastructure, maintenance demands, available candidate windows, and generated block possession status. Use this page to monitor readiness and navigate directly to planning stages."
          inputs={['Corridor Sections', 'Timetable Train Movements', 'Department Maintenance Demands', 'Crews & Machinery']}
          outputs={['Real-time Readiness Status', 'Section Defect Density', 'Next Scheduled Possession', 'Actionable Control Alerts']}
          nextStep={{ label: isDatabaseEmpty ? 'Step 1: Set up Corridor & Trains' : 'Proceed to Maintenance Demands', to: isDatabaseEmpty ? '/corridor-data' : '/maintenance' }}
        />

        {/* ── EMPTY OPERATIONAL EXPERIENCE / FIRST-TIME SETUP FLOW ── */}
        {isDatabaseEmpty && !loading ? (
          <div className="bg-white rounded-xl border border-[#D9E1EA] p-8 shadow-xs space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 text-[#173F7A] font-mono text-xs font-bold mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  EMPTY OPERATIONAL STATE
                </div>
                <h1 className="text-2xl font-black text-[#172033] tracking-tight">
                  Welcome to SANGAM
                </h1>
                <p className="text-sm text-[#667085] mt-1 max-w-2xl">
                  No planning data has been added yet. SANGAM optimizes joint possessions from first principles using your manual or timetable inputs.
                  Follow the operational setup flow below to create your corridor, timetable, resources, and maintenance jobs.
                </p>
              </div>

              <button
                onClick={() => navigate('/corridor-data')}
                className="px-5 py-2.5 rounded-lg bg-[#173F7A] text-white font-bold text-xs hover:bg-[#1E4E8C] transition-colors flex items-center gap-2 shadow-xs cursor-pointer flex-shrink-0"
              >
                <span>Start Planning Setup</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Checklist Flow */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-[#173F7A]">
                First-Time Setup Flow
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Step 1 */}
                <div
                  onClick={() => navigate('/corridor-data')}
                  className="p-4 rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] hover:border-[#173F7A] hover:bg-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
                    <span className="text-[#173F7A]">STEP 1 & 2</span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">Pending</span>
                  </div>
                  <div className="font-bold text-sm text-[#172033] group-hover:text-[#173F7A]">
                    Corridor & Train Timetable
                  </div>
                  <div className="text-xs text-[#667085] mt-1 leading-relaxed">
                    Add stations, sections (e.g. A-B, B-C), and passenger/freight train runs to calculate candidate corridor gaps.
                  </div>
                </div>

                {/* Step 2 */}
                <div
                  onClick={() => navigate('/resources')}
                  className="p-4 rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] hover:border-[#173F7A] hover:bg-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
                    <span className="text-[#173F7A]">STEP 3</span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">Pending</span>
                  </div>
                  <div className="font-bold text-sm text-[#172033] group-hover:text-[#173F7A]">
                    Crews & Machinery
                  </div>
                  <div className="text-xs text-[#667085] mt-1 leading-relaxed">
                    Register departmental work crews and heavy equipment (Tower Wagons, Tampers) available for possessions.
                  </div>
                </div>

                {/* Step 3 */}
                <div
                  onClick={() => navigate('/maintenance')}
                  className="p-4 rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] hover:border-[#173F7A] hover:bg-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
                    <span className="text-[#173F7A]">STEP 4</span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">Pending</span>
                  </div>
                  <div className="font-bold text-sm text-[#172033] group-hover:text-[#173F7A]">
                    Maintenance Demands
                  </div>
                  <div className="text-xs text-[#667085] mt-1 leading-relaxed">
                    Enter Engineering, TRD, and S&T work orders with durations, power cut needs, and parallel compatibility.
                  </div>
                </div>
              </div>

              {/* Step 5 & 6 */}
              <div className="p-4 rounded-lg border border-dashed border-[#D9E1EA] bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                    5
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#172033]">
                      Step 5 & 6: Review Candidate Windows & Generate First Plan
                    </div>
                    <div className="text-[11px] text-[#667085]">
                      Once inputs are entered, SANGAM's CP-SAT engine bundles compatible work into joint blocks with zero train clash.
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/planning/create')}
                  className="px-4 py-2 rounded border border-[#D9E1EA] bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex-shrink-0"
                >
                  Check Readiness
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Top Header Greeting (When data exists or loaded) ── */}
        {!isDatabaseEmpty && (
          <div className="bg-white rounded-lg border border-[#D9E1EA] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#667085]">
                Control Room Briefing
              </div>
              <h1 className="text-2xl font-black text-[#172033] tracking-tight mt-0.5">
                Good day, {userRole}
              </h1>
              <div className="flex items-center gap-4 mt-2 text-xs text-[#667085] font-medium flex-wrap">
                <span>
                  <strong className="text-[#172033]">Active Corridor:</strong> {sections[0]?.corridor_name || 'Operational Sections'}
                </span>
                <span>•</span>
                <span>
                  <strong className="text-[#172033]">Sections:</strong> {sections.length} defined ({totalLengthKm} km)
                </span>
                <span>•</span>
                <span>
                  <strong className="text-[#172033]">Train Traffic:</strong> {trains.length} movements ({passengerTrains.length} Pax / {freightTrains.length} Freight)
                </span>
                <span>•</span>
                <span>
                  <strong className="text-[#172033]">Candidate Windows:</strong> {windows.length} windows ({availableWindows.length} available)
                </span>
                <span>•</span>
                <span>
                  <strong className="text-[#172033]">Total Tasks:</strong> {tasks.length} demands ({criticalTasks.length} critical)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-[#D9E1EA] bg-white text-xs font-semibold text-[#172033] hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
                title="Refresh live data from server"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#173F7A] ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Live Data</span>
              </button>
              <button
                onClick={handleContinuePlanning}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#173F7A] text-white font-bold text-xs hover:bg-[#1E4E8C] transition-all shadow-xs cursor-pointer"
              >
                <span>Continue Planning Workflow</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── 4 Primary Metric Cards Linking Directly to Live Data ── */}
        {!isDatabaseEmpty && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Corridor & Train Movements */}
            <div
              onClick={() => navigate('/corridor-data')}
              className="bg-white rounded-lg border border-[#D9E1EA] p-5 shadow-xs hover:border-[#173F7A] transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between text-xs text-[#667085] font-medium">
                <span>Corridor & Trains</span>
                <Train className="w-4 h-4 text-[#173F7A]" />
              </div>
              <div className="text-3xl font-black text-[#172033] mt-2 tabular-nums">
                {trains.length}
              </div>
              <div className="text-[11px] text-[#667085] mt-1 flex items-center justify-between">
                <span>{sections.length} sections · {passengerTrains.length} Pax / {freightTrains.length} Freight</span>
                <span className="text-[#173F7A] font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  Timetable <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* Card 2: Candidate Block Windows */}
            <div
              onClick={() => navigate('/corridor-data')}
              className="bg-white rounded-lg border border-[#D9E1EA] p-5 shadow-xs hover:border-[#173F7A] transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between text-xs text-emerald-700 font-medium">
                <span>Candidate Windows</span>
                <Clock className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-emerald-700 mt-2 tabular-nums">
                {windows.length}
              </div>
              <div className="text-[11px] text-[#667085] mt-1 flex items-center justify-between">
                <span>{availableWindows.length} available · {restrictedWindows.length} restricted</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  Windows <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* Card 3: Maintenance Demands */}
            <div
              onClick={() => navigate('/maintenance')}
              className="bg-white rounded-lg border border-[#D9E1EA] p-5 shadow-xs hover:border-[#173F7A] transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between text-xs text-[#667085] font-medium">
                <span>Pending Maintenance</span>
                <Wrench className="w-4 h-4 text-[#667085]" />
              </div>
              <div className="text-3xl font-black text-[#172033] mt-2 tabular-nums">
                {pendingTasks.length}
              </div>
              <div className="text-[11px] text-[#667085] mt-1 flex items-center justify-between">
                <span>{criticalTasks.length} critical · {overdueTasks.length} overdue</span>
                <span className="text-[#173F7A] font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  Demands <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* Card 4: Plan Status */}
            <div
              onClick={() => navigate(blocks.length > 0 ? '/planning/proposed' : '/planning/create')}
              className="bg-white rounded-lg border border-[#D9E1EA] p-5 shadow-xs hover:border-[#173F7A] transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between text-xs text-[#667085] font-medium">
                <span>Plan & Possessions</span>
                <Layers className="w-4 h-4 text-[#173F7A]" />
              </div>
              <div className="text-2xl font-black text-[#172033] mt-2 flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    planStatus === 'Approved'
                      ? 'bg-emerald-500'
                      : planStatus === 'Under Review'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-slate-400'
                  }`}
                />
                <span>{planStatus}</span>
              </div>
              <div className="text-[11px] text-[#667085] mt-1 flex items-center justify-between">
                <span className="truncate max-w-[150px]" title={`Next possession: ${nextBlockTimeStr}`}>
                  {blocks.length > 0 ? `${blocks.length} blocks · ${approvedBlocks.length} approved` : nextBlockTimeStr}
                </span>
                <span className="text-[#173F7A] font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform flex-shrink-0">
                  Review <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Actionable Attention Required & Current Planning Status ── */}
        {!isDatabaseEmpty && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-lg border border-[#D9E1EA] p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#D9E1EA]">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-[#172033]">
                    Operational Alerts & Attention Required
                  </h2>
                </div>
                <span className="text-[11px] text-[#667085]">Click any item to resolve</span>
              </div>

              <div className="divide-y divide-[#D9E1EA] mt-1">
                {criticalTasks.length > 0 ? (
                  <div
                    onClick={() => navigate('/maintenance')}
                    className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 rounded transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-[#172033]">
                          {criticalTasks.length} critical maintenance defect{criticalTasks.length > 1 ? 's' : ''} require corridor possession
                        </div>
                        <div className="text-[11px] text-[#667085] mt-0.5">
                          High safety priority work must be given block precedence
                        </div>
                      </div>
                    </div>
                    <button className="text-xs font-bold text-[#173F7A] hover:underline flex items-center gap-1 flex-shrink-0 ml-4">
                      Schedule <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="py-3 px-2 flex items-center gap-3 text-xs text-[#667085]">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Zero critical defects outstanding. All safety demands in regular cycle.</span>
                  </div>
                )}

                {unavailableResources.length > 0 && (
                  <div
                    onClick={() => navigate('/resources')}
                    className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 rounded transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-[#172033]">
                          {unavailableResources.length} resource{unavailableResources.length > 1 ? 's' : ''} currently marked unavailable
                        </div>
                        <div className="text-[11px] text-[#667085] mt-0.5">
                          Optimizer will not allocate these crews/equipment during their outage
                        </div>
                      </div>
                    </div>
                    <button className="text-xs font-bold text-[#173F7A] hover:underline flex items-center gap-1 flex-shrink-0 ml-4">
                      Manage Resources <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {pendingApprovalBlocks.length > 0 && (
                  <div
                    onClick={() => navigate('/operations/approved')}
                    className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 rounded transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-[#172033]">
                          {pendingApprovalBlocks.length} proposed joint block{pendingApprovalBlocks.length > 1 ? 's' : ''} awaiting approval
                        </div>
                        <div className="text-[11px] text-[#667085] mt-0.5">
                          Review recommended schedule and approve for operational execution
                        </div>
                      </div>
                    </div>
                    <button className="text-xs font-bold text-[#173F7A] hover:underline flex items-center gap-1 flex-shrink-0 ml-4">
                      Review & Approve <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Current Planning Status Checklist (1 col) */}
            <div className="bg-white rounded-lg border border-[#D9E1EA] p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold font-mono uppercase tracking-wider text-[#172033] pb-3 border-b border-[#D9E1EA]">
                  Planning Prerequisites
                </div>

                <div className="space-y-2.5 mt-3 text-xs">
                  <div
                    onClick={() => navigate('/corridor-data')}
                    className="flex items-center justify-between p-2 rounded bg-[#F8FAFC] hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <span className="font-medium text-[#172033]">1. Corridor Sections</span>
                    <span className={`inline-flex items-center gap-1 font-bold font-mono text-[11px] ${
                      sections.length > 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {sections.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {sections.length > 0 ? `${sections.length} Sections (${totalLengthKm} km)` : 'Not Added'}
                    </span>
                  </div>

                  <div
                    onClick={() => navigate('/corridor-data')}
                    className="flex items-center justify-between p-2 rounded bg-[#F8FAFC] hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <span className="font-medium text-[#172033]">2. Train Movements</span>
                    <span className={`inline-flex items-center gap-1 font-bold font-mono text-[11px] ${
                      trains.length > 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {trains.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {trains.length > 0 ? `${trains.length} Trains (${passengerTrains.length} Pax / ${freightTrains.length} Freight)` : 'Not Added'}
                    </span>
                  </div>

                  <div
                    onClick={() => navigate('/corridor-data')}
                    className="flex items-center justify-between p-2 rounded bg-[#F8FAFC] hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <span className="font-medium text-[#172033]">3. Candidate Windows</span>
                    <span className={`inline-flex items-center gap-1 font-bold font-mono text-[11px] ${
                      windows.length > 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {windows.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {windows.length > 0 ? `${windows.length} Windows (${availableWindows.length} Open)` : 'Not Computed'}
                    </span>
                  </div>

                  <div
                    onClick={() => navigate('/maintenance')}
                    className="flex items-center justify-between p-2 rounded bg-[#F8FAFC] hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <span className="font-medium text-[#172033]">4. Maintenance Demands</span>
                    <span className={`inline-flex items-center gap-1 font-bold font-mono text-[11px] ${
                      tasks.length > 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {tasks.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {tasks.length > 0 ? `${tasks.length} Demands (${criticalTasks.length} Critical)` : 'Not Added'}
                    </span>
                  </div>

                  <div
                    onClick={() => navigate('/resources')}
                    className="flex items-center justify-between p-2 rounded bg-[#F8FAFC] hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <span className="font-medium text-[#172033]">5. Resources (Crews/Equip)</span>
                    <span className={`inline-flex items-center gap-1 font-bold font-mono text-[11px] ${
                      resources.length > 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {resources.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {resources.length > 0 ? `${resources.length} Registered (${unavailableResources.length} Outage)` : 'Not Added'}
                    </span>
                  </div>

                  <div
                    onClick={() => navigate(blocks.length > 0 ? '/planning/proposed' : '/planning/create')}
                    className="flex items-center justify-between p-2 rounded bg-[#F8FAFC] hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <span className="font-medium text-[#172033]">6. Proposed Schedule</span>
                    <span className={`inline-flex items-center gap-1 font-bold font-mono text-[11px] ${
                      blocks.length > 0 ? 'text-emerald-700' : 'text-slate-500'
                    }`}>
                      {blocks.length > 0 ? `${blocks.length} Blocks (${approvedBlocks.length} Approved)` : 'Pending Generation'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#D9E1EA]">
                <button
                  onClick={handleContinuePlanning}
                  className="w-full py-2.5 rounded bg-[#173F7A] text-white font-bold text-xs hover:bg-[#1E4E8C] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Continue Planning Workflow</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Dynamic Railway Corridor Schematic ── */}
        <div className="bg-white rounded-lg border border-[#D9E1EA] p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#D9E1EA]">
            <div>
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-[#172033]">
                Corridor Section Infrastructure & Active Demands
              </h2>
              <p className="text-[11px] text-[#667085] mt-0.5">
                Click any section card to inspect its train timetable movements, available candidate windows, pending maintenance, and possessions
              </p>
            </div>
            <button
              onClick={() => navigate('/corridor-data')}
              className="text-xs font-semibold text-[#173F7A] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              Manage Corridor & Sections
            </button>
          </div>

          {/* Dynamic Track Grid */}
          {sections.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {sections.map((sec) => {
                const secTasks = tasks.filter(
                  (t) => t.section_id === sec.id || t.section_name === sec.name || t.section_name?.includes(sec.name)
                );
                const secTrains = trains.filter(
                  (t) => t.section_id === sec.id || t.section_name === sec.name || t.section_name?.includes(sec.name)
                );
                const secWindows = windows.filter(
                  (w) => w.section_id === sec.id || w.section_name === sec.name || w.section_name?.includes(sec.name)
                );
                const secAvailableWindows = secWindows.filter((w) => w.is_available);
                const secCrit = secTasks.filter((t) => t.severity === 'Critical');

                return (
                  <div
                    key={sec.id}
                    onClick={() => handleOpenSection(sec.id)}
                    className="border border-[#D9E1EA] rounded-lg p-3.5 hover:border-[#173F7A] hover:bg-slate-50 transition-all cursor-pointer text-left bg-[#F8FAFC] relative group shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-[#173F7A] bg-[#EBF2FA] px-2 py-0.5 rounded">
                        {sec.name}
                      </span>
                      {secCrit.length > 0 && (
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title={`${secCrit.length} critical defect(s)`} />
                      )}
                    </div>
                    <div className="text-sm font-bold text-[#172033] mt-2">
                      {sec.from_station} → {sec.to_station}
                    </div>
                    <div className="text-[11px] text-[#667085] mt-1 space-y-0.5 font-mono">
                      <div>Distance: <strong className="text-[#172033]">{sec.length_km || 25} km</strong></div>
                      <div>Track: <strong className="text-[#172033] capitalize">{sec.line_type || 'Double'} line</strong></div>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
                      <Zap className="w-3 h-3 text-emerald-600" />
                      <span>{sec.is_electrified ? '25 kV AC OHE' : 'Non-electrified'}</span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200 grid grid-cols-3 gap-1 text-center font-mono">
                      <div className="bg-white p-1 rounded border border-slate-100">
                        <div className="text-slate-400 text-[9px] uppercase font-sans">Trains</div>
                        <div className="font-bold text-xs text-[#172033]">{secTrains.length}</div>
                      </div>
                      <div className="bg-white p-1 rounded border border-slate-100">
                        <div className="text-slate-400 text-[9px] uppercase font-sans">Windows</div>
                        <div className="font-bold text-xs text-emerald-700">{secWindows.length}</div>
                      </div>
                      <div className="bg-white p-1 rounded border border-slate-100">
                        <div className="text-slate-400 text-[9px] uppercase font-sans">Tasks</div>
                        <div className="font-bold text-xs text-[#173F7A]">{secTasks.length}</div>
                      </div>
                    </div>

                    <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                      <span>{secAvailableWindows.length} avail windows</span>
                      <span className="text-[#173F7A] font-semibold group-hover:underline flex items-center gap-0.5">
                        Inspect <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center bg-[#F8FAFC] rounded-lg border border-dashed border-[#D9E1EA]">
              <div className="text-xs font-semibold text-[#172033]">No railway corridor sections configured yet</div>
              <div className="text-xs text-[#667085] mt-1">
                Configure your corridor and sections (e.g. Test Corridor with Stations A, B, C) in Train & Corridor Data.
              </div>
              <button
                onClick={() => navigate('/corridor-data')}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#173F7A] text-white text-xs font-bold hover:bg-[#1E4E8C] transition-colors cursor-pointer"
              >
                Go to Corridor Setup <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* ── Slide-over Section Inspector Drawer ── */}
      {sectionDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-[#D9E1EA] animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-[#D9E1EA] flex items-center justify-between bg-[#F8FAFC]">
              <div>
                <div className="text-2xs font-mono font-bold uppercase tracking-wider text-[#667085]">
                  Section Master Inspector
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-mono font-bold text-[#173F7A] bg-[#EBF2FA] px-2 py-0.5 rounded border border-[#173F7A]/20">
                    {activeSection?.name || selectedSectionId}
                  </span>
                  <span className="text-2xs text-[#667085]">
                    {activeSection?.from_station} → {activeSection?.to_station} ({activeSection?.length_km || 25} km)
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSectionDrawerOpen(false)}
                className="p-1 rounded hover:bg-slate-200 text-[#667085] hover:text-[#172033] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* 1. Scheduled Trains on this section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-[#172033] uppercase tracking-wider font-mono text-2xs flex items-center gap-1.5">
                    <Train className="w-3.5 h-3.5 text-[#173F7A]" />
                    <span>Scheduled Train Movements ({sectionTrains.length})</span>
                  </h4>
                  <button
                    onClick={() => {
                      setSectionDrawerOpen(false);
                      navigate('/corridor-data');
                    }}
                    className="text-[#173F7A] hover:underline flex items-center gap-1 font-semibold text-2xs cursor-pointer"
                  >
                    Manage Trains <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {sectionTrains.slice(0, 6).map((tr) => (
                    <div key={tr.id} className="p-2.5 rounded border border-[#D9E1EA] bg-[#F8FAFC] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#172033] flex items-center gap-2">
                          <span className="font-mono text-[#173F7A]">{tr.train_number}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            tr.train_type === 'Passenger' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {tr.train_type}
                          </span>
                        </div>
                        <div className="text-[#667085] text-[11px] mt-0.5 font-mono">
                          {new Date(tr.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(tr.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({tr.transit_min || 30} min)
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">
                        P{tr.priority}
                      </span>
                    </div>
                  ))}
                  {sectionTrains.length === 0 && (
                    <div className="text-slate-500 py-2 text-center bg-slate-50 rounded border border-dashed border-slate-200">
                      No trains scheduled on this section.
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Candidate Windows on this section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-[#172033] uppercase tracking-wider font-mono text-2xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Candidate Windows ({sectionWindows.length})</span>
                  </h4>
                  <button
                    onClick={() => {
                      setSectionDrawerOpen(false);
                      navigate('/corridor-data');
                    }}
                    className="text-[#173F7A] hover:underline flex items-center gap-1 font-semibold text-2xs cursor-pointer"
                  >
                    Manage Windows <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {sectionWindows.slice(0, 5).map((w) => (
                    <div key={w.id} className="p-2 rounded border border-[#D9E1EA] bg-[#F8FAFC] flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-[#172033]">
                          {new Date(w.window_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(w.window_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[#667085] text-[10px] ml-2 font-mono">({w.duration_min} min)</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        w.is_available ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {w.is_available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                  ))}
                  {sectionWindows.length === 0 && (
                    <div className="text-slate-500 py-2 text-center bg-slate-50 rounded border border-dashed border-slate-200">
                      No candidate windows computed yet.
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Tasks on this section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-[#172033] uppercase tracking-wider font-mono text-2xs flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-[#667085]" />
                    <span>Pending Maintenance ({sectionTasks.length})</span>
                  </h4>
                  <button
                    onClick={() => {
                      setSectionDrawerOpen(false);
                      navigate('/maintenance');
                    }}
                    className="text-[#173F7A] hover:underline flex items-center gap-1 font-semibold text-2xs cursor-pointer"
                  >
                    View All <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {sectionTasks.slice(0, 5).map((t) => (
                    <div key={t.id} className="p-2.5 rounded border border-[#D9E1EA] bg-[#F8FAFC] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#172033] flex items-center gap-1.5">
                          <span className="px-1.5 py-0.2 rounded bg-slate-200 text-[10px] font-mono">{t.department_code || 'ENG'}</span>
                          <span>{t.task_code}</span>
                        </div>
                        <div className="text-[#667085] text-[11px] mt-0.5 truncate max-w-xs">{t.maintenance_type}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.severity === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {t.severity}
                      </span>
                    </div>
                  ))}
                  {sectionTasks.length === 0 && (
                    <div className="text-slate-500 py-2 text-center bg-slate-50 rounded border border-dashed border-slate-200">
                      No pending tasks on this section.
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Planned Blocks on this section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-[#172033] uppercase tracking-wider font-mono text-2xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#173F7A]" />
                    <span>Proposed Blocks ({sectionBlocks.length})</span>
                  </h4>
                  <button
                    onClick={() => {
                      setSectionDrawerOpen(false);
                      navigate('/planning/proposed');
                    }}
                    className="text-[#173F7A] hover:underline flex items-center gap-1 font-semibold text-2xs cursor-pointer"
                  >
                    View Plan <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {sectionBlocks.slice(0, 3).map((b) => (
                    <div key={b.id} className="p-2.5 rounded border border-[#D9E1EA] bg-emerald-50/50 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#172033] font-mono">
                          {new Date(b.block_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(b.block_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-[11px] text-[#667085]">{b.is_joint_block ? 'Joint Multi-Department Possession' : 'Single Department'}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        {b.approval_status || 'Recommended'}
                      </span>
                    </div>
                  ))}
                  {sectionBlocks.length === 0 && (
                    <div className="text-slate-500 py-2 text-center bg-slate-50 rounded border border-dashed border-slate-200">
                      No blocks scheduled on this section yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#D9E1EA] bg-[#F8FAFC] flex justify-end">
              <button
                onClick={() => setSectionDrawerOpen(false)}
                className="px-4 py-1.5 rounded border border-[#D9E1EA] bg-white text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
