import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import WorkflowBar from '../../components/WorkflowBar';
import { PageGuideBanner } from '../../components/ui/PageGuideBanner';
import { usePlanning } from '../../context/PlanningContext';
import {
  triggerOptimization,
  getTasks,
  getAllWindows,
  getResources,
  getAllTrains,
  getSections,
  type MaintenanceTask,
  type CorridorWindowFull,
  type ResourceItem,
  type TimetableTrain,
  type Section,
} from '../../lib/apiClient';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Wrench,
  CheckSquare,
  AlertTriangle,
  Loader2,
  Sliders,
  Layers,
  Train,
  XCircle,
  ExternalLink,
} from 'lucide-react';

export default function CreateBlockPlan() {
  const navigate = useNavigate();
  const { setWorkflowStage, refreshAll } = usePlanning();

  const [step, setStep] = useState<number>(1);
  const [selectedObjectiveProfile, setSelectedObjectiveProfile] = useState<string>('balanced');

  // Step 1: Period & Corridor
  const [startDate, setStartDate] = useState('2026-09-08');
  const [endDate, setEndDate] = useState('2026-09-14');
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);

  // Step 2: Inputs Snapshot
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [windows, setWindows] = useState<CorridorWindowFull[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [trains, setTrains] = useState<TimetableTrain[]>([]);

  // Step 4: Generation Progress
  const [genStep, setGenStep] = useState<number>(0);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    setWorkflowStage(4);
    const loadInputs = async () => {
      try {
        const [secData, tData, wData, rData, trData] = await Promise.all([
          getSections().catch(() => []),
          getTasks().catch(() => []),
          getAllWindows().catch(() => []),
          getResources().catch(() => []),
          getAllTrains().catch(() => []),
        ]);
        setSections(secData);
        setSelectedSectionIds(secData.map((s) => s.id));
        setTasks(tData);
        setWindows(wData);
        setResources(rData);
        setTrains(trData);
      } catch (err) {
        console.error('Error loading planning inputs snapshot:', err);
      }
    };
    loadInputs();
  }, [setWorkflowStage]);

  const handleToggleSection = (secId: string) => {
    if (selectedSectionIds.includes(secId)) {
      if (selectedSectionIds.length === 1) return; // Keep at least 1
      setSelectedSectionIds(selectedSectionIds.filter((id) => id !== secId));
    } else {
      setSelectedSectionIds([...selectedSectionIds, secId]);
    }
  };

  const readyTasks = tasks.filter((t) => t.status === 'Pending' || t.status === 'New' || t.status === 'PENDING' || !t.status);
  const activeWindows = windows.filter((w) => w.is_available);
  const totalWindowHours = (activeWindows.reduce((acc, w) => acc + w.duration_min, 0) / 60).toFixed(1);
  const availableResources = resources.filter((r) => r.is_available);

  // Readiness evaluation
  const hasSections = sections.length > 0;
  const hasTrains = trains.length > 0;
  const hasTasks = tasks.length > 0;
  const hasWindows = activeWindows.length > 0;
  const hasResources = availableResources.length > 0;
  const isReadyToOptimize = hasSections && hasTasks && hasWindows && hasResources;

  const handleStartGeneration = async () => {
    setStep(4);
    setGenError(null);
    setGenStep(1);

    const stepTimer = (targetStep: number, ms: number) =>
      new Promise((resolve) => {
        setTimeout(() => {
          setGenStep(targetStep);
          resolve(true);
        }, ms);
      });

    try {
      await stepTimer(2, 600);
      await stepTimer(3, 700);

      // Call optimization engine
      await triggerOptimization({
        start_date: `${startDate}T00:00:00`,
        end_date: `${endDate}T23:59:59`,
        section_ids: selectedSectionIds,
        objective_profile: selectedObjectiveProfile as any,
        run_types: ['sangam_optimized', 'greedy_baseline', 'independent_baseline'],
      });

      await stepTimer(4, 700);
      await stepTimer(5, 600);

      await refreshAll();
      setWorkflowStage(5);

      setTimeout(() => {
        navigate('/planning/proposed');
      }, 800);
    } catch (err: any) {
      console.error('Plan generation failed:', err);
      setGenError(err?.message || 'Optimization solver failed. Please verify candidate windows and task constraints.');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F6F8FB] text-[#172033]">
      <TopBar title="Create Block Plan" subtitle="Coordinated Multi-Department Corridor Possession Synthesis" />
      <WorkflowBar activeStage={4} />

      <main className="p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Page Guide Banner */}
        <PageGuideBanner
          pageTitle="Create Block Plan"
          purpose="Synthesize optimal, conflict-free joint possession blocks using ready maintenance requests, available corridor windows, crews, and safety rules. The CP-SAT solver evaluates all combinations to minimize train disruption and maximize work completion."
          inputs={['Ready Maintenance Tasks', 'Available Candidate Windows', 'Active Crew & Machinery Pool', 'Planning Horizon Dates']}
          outputs={['Proposed Coordinated Block Plan', 'Joint Department Possessions', 'Baseline Plan Comparisons']}
          nextStep={{ label: 'Inspect Proposed Block Schedule', to: '/planning/proposed' }}
        />

        {/* Wizard Stepper */}
        <div className="bg-white rounded-lg border border-[#D9E1EA] p-5 shadow-xs">
          <div className="flex items-center justify-between max-w-xl mx-auto">
            {[
              { num: 1, label: 'Planning Period' },
              { num: 2, label: 'Review Inputs' },
              { num: 3, label: 'Objective Priority' },
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                    step === s.num
                      ? 'bg-[#173F7A] text-white'
                      : step > s.num
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className={`text-xs font-semibold ${step === s.num ? 'text-[#173F7A]' : 'text-[#667085]'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── STEP 1: PLANNING PERIOD & CORRIDOR ── */}
        {step === 1 && (
          <div className="space-y-6 bg-white border border-[#D9E1EA] p-6 rounded-xl shadow-xs">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#172033]">Step 1: Set Planning Horizon & Track Sections</h2>
              <p className="text-xs text-[#667085]">Specify dates and choose corridor sections for this block plan run.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#172033] mb-1">Planning Start Date *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg p-2.5 text-[#172033] text-xs font-mono focus:outline-none focus:border-[#173F7A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#172033] mb-1">Planning End Date *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg p-2.5 text-[#172033] text-xs font-mono focus:outline-none focus:border-[#173F7A]"
                />
              </div>
            </div>

            {/* Sections Selector */}
            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-2">
                Included Corridor Sections ({selectedSectionIds.length} of {sections.length} selected)
              </label>

              {sections.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {sections.map((sec) => {
                    const isSelected = selectedSectionIds.includes(sec.id);
                    return (
                      <div
                        key={sec.id}
                        onClick={() => handleToggleSection(sec.id)}
                        className={`p-3 rounded-lg border text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#EBF2FA] border-[#173F7A] text-[#173F7A] font-bold shadow-xs'
                            : 'bg-[#F8FAFC] border-[#D9E1EA] text-[#667085] hover:border-slate-400'
                        }`}
                      >
                        <span className="truncate">{sec.name}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#173F7A] flex-shrink-0 ml-1" />}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
                  <span>No railway corridor sections configured yet.</span>
                  <button
                    onClick={() => navigate('/corridor-data')}
                    className="text-[#173F7A] font-bold hover:underline flex items-center gap-1"
                  >
                    Go to Corridor Setup <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-[#D9E1EA]">
              <button
                onClick={() => setStep(2)}
                className="px-5 py-2.5 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded-lg font-bold text-xs flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <span>Continue to Review Inputs</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: REVIEW PLANNING INPUTS READINESS SCREEN ── */}
        {step === 2 && (
          <div className="space-y-6 bg-white border border-[#D9E1EA] p-6 rounded-xl shadow-xs">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#172033]">Step 2: Planning Inputs Readiness</h2>
              <p className="text-xs text-[#667085]">
                Verify that all prerequisites exist before running the CP-SAT optimization engine.
              </p>
            </div>

            {/* Structured Readiness Table */}
            <div className="border border-[#D9E1EA] rounded-lg overflow-hidden">
              <div className="bg-[#F8FAFC] px-4 py-2.5 border-b border-[#D9E1EA] text-[11px] font-mono uppercase font-bold text-[#667085]">
                Prerequisite Validation Matrix
              </div>

              <div className="divide-y divide-[#D9E1EA] text-xs">
                {/* 1. Corridor Sections */}
                <div className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <Layers className="w-4 h-4 text-[#173F7A]" />
                    <div>
                      <span className="font-semibold text-[#172033]">Corridor Sections</span>
                      <span className="text-[11px] text-[#667085] ml-2">({sections.length} configured)</span>
                    </div>
                  </div>
                  {hasSections ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold font-mono text-[11px]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {sections.length} Ready
                    </span>
                  ) : (
                    <button
                      onClick={() => navigate('/corridor-data')}
                      className="text-xs text-red-600 font-bold flex items-center gap-1 hover:underline"
                    >
                      <XCircle className="w-4 h-4 text-red-600" /> Missing: Go to Corridor Setup
                    </button>
                  )}
                </div>

                {/* 2. Train Movements */}
                <div className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <Train className="w-4 h-4 text-[#173F7A]" />
                    <div>
                      <span className="font-semibold text-[#172033]">Train Movements</span>
                      <span className="text-[11px] text-[#667085] ml-2">({trains.length} scheduled)</span>
                    </div>
                  </div>
                  {hasTrains ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold font-mono text-[11px]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {trains.length} Ready
                    </span>
                  ) : (
                    <button
                      onClick={() => navigate('/corridor-data')}
                      className="text-xs text-amber-700 font-bold flex items-center gap-1 hover:underline"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> No trains: Add in Train Data
                    </button>
                  )}
                </div>

                {/* 3. Maintenance Tasks */}
                <div className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <Wrench className="w-4 h-4 text-[#173F7A]" />
                    <div>
                      <span className="font-semibold text-[#172033]">Maintenance Tasks</span>
                      <span className="text-[11px] text-[#667085] ml-2">({tasks.length} total, {readyTasks.length} ready)</span>
                    </div>
                  </div>
                  {readyTasks.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold font-mono text-[11px]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {readyTasks.length} Ready
                    </span>
                  ) : (
                    <button
                      onClick={() => navigate('/maintenance')}
                      className="text-xs text-red-600 font-bold flex items-center gap-1 hover:underline"
                    >
                      <XCircle className="w-4 h-4 text-red-600" /> Missing: Go to Maintenance Work
                    </button>
                  )}
                </div>

                {/* 4. Resources */}
                <div className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <CheckSquare className="w-4 h-4 text-[#173F7A]" />
                    <div>
                      <span className="font-semibold text-[#172033]">Resources (Crews & Machines)</span>
                      <span className="text-[11px] text-[#667085] ml-2">({availableResources.length} available of {resources.length})</span>
                    </div>
                  </div>
                  {hasResources ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold font-mono text-[11px]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {availableResources.length} Available
                    </span>
                  ) : (
                    <button
                      onClick={() => navigate('/resources')}
                      className="text-xs text-red-600 font-bold flex items-center gap-1 hover:underline"
                    >
                      <XCircle className="w-4 h-4 text-red-600" /> Missing: Go to Resources
                    </button>
                  )}
                </div>

                {/* 5. Candidate Windows */}
                <div className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-[#173F7A]" />
                    <div>
                      <span className="font-semibold text-[#172033]">Candidate Corridor Windows</span>
                      <span className="text-[11px] text-[#667085] ml-2">({activeWindows.length} available, {totalWindowHours} hrs capacity)</span>
                    </div>
                  </div>
                  {hasWindows ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold font-mono text-[11px]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {activeWindows.length} Windows Ready
                    </span>
                  ) : (
                    <button
                      onClick={() => navigate('/corridor-data')}
                      className="text-xs text-red-600 font-bold flex items-center gap-1 hover:underline"
                    >
                      <XCircle className="w-4 h-4 text-red-600" /> Missing: Add Train Movements
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Active Rules Snapshot */}
            <div className="p-4 bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg space-y-2 text-xs">
              <div className="font-semibold text-[#172033] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#173F7A]" />
                Active Railway Operating Constraints
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[#667085]">
                <div>Passenger Buffer: <strong className="text-[#172033]">10–15 min</strong></div>
                <div>Min Block Length: <strong className="text-[#172033]">30–60 min</strong></div>
                <div>Power Isolation: <strong className="text-[#172033]">25kV AC Protocol</strong></div>
                <div>Joint Packaging: <strong className="text-[#172033]">Enabled (ENG/TRD/S&T)</strong></div>
              </div>
            </div>

            {!isReadyToOptimize && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  Please resolve the missing prerequisites marked above before running optimization.
                </span>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-[#D9E1EA]">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!isReadyToOptimize}
                className={`px-5 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors shadow-xs ${
                  isReadyToOptimize
                    ? 'bg-[#173F7A] hover:bg-[#1E4E8C] text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>Continue to Planning Priority</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: PLANNING PRIORITY ── */}
        {step === 3 && (
          <div className="space-y-6 bg-white border border-[#D9E1EA] p-6 rounded-xl shadow-xs">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#172033]">Step 3: Choose Optimization Objective Priority</h2>
              <p className="text-xs text-[#667085]">Select the strategic balancing profile for SANGAM's mathematical scheduler.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Balanced */}
              <div
                onClick={() => setSelectedObjectiveProfile('balanced')}
                className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2.5 ${
                  selectedObjectiveProfile === 'balanced'
                    ? 'bg-[#EBF2FA] border-[#173F7A] ring-2 ring-[#173F7A]/20'
                    : 'bg-[#F8FAFC] border-[#D9E1EA] hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#172033]">Balanced Plan</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-[#173F7A]">Recommended</span>
                </div>
                <p className="text-xs text-[#667085] leading-relaxed">
                  Best equilibrium between clearing critical maintenance backlog and preserving high-speed train punctuality. Maximizes multi-department joint blocks.
                </p>
                <div className="text-[11px] text-[#667085] pt-2 border-t border-slate-200">
                  Target: Joint blocks combining compatible demands.
                </div>
              </div>

              {/* Min Train Impact */}
              <div
                onClick={() => setSelectedObjectiveProfile('min_train_impact')}
                className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2.5 ${
                  selectedObjectiveProfile === 'min_train_impact'
                    ? 'bg-[#EBF2FA] border-[#173F7A] ring-2 ring-[#173F7A]/20'
                    : 'bg-[#F8FAFC] border-[#D9E1EA] hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#172033]">Punctuality First</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Traffic Safe</span>
                </div>
                <p className="text-xs text-[#667085] leading-relaxed">
                  Strict protection for mail/express paths. Schedulers only occupy low-density night windows or shadow slots behind slow freight paths.
                </p>
                <div className="text-[11px] text-[#667085] pt-2 border-t border-slate-200">
                  Target: 0% passenger delay impact.
                </div>
              </div>

              {/* Max Availability */}
              <div
                onClick={() => setSelectedObjectiveProfile('max_availability')}
                className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2.5 ${
                  selectedObjectiveProfile === 'max_availability'
                    ? 'bg-[#EBF2FA] border-[#173F7A] ring-2 ring-[#173F7A]/20'
                    : 'bg-[#F8FAFC] border-[#D9E1EA] hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#172033]">Max Work Clearance</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Aggressive</span>
                </div>
                <p className="text-xs text-[#667085] leading-relaxed">
                  Aggressive maintenance clearing. Takes longer continuous block possessions to complete overdue track renewals and bridge rehabilitation.
                </p>
                <div className="text-[11px] text-[#667085] pt-2 border-t border-slate-200">
                  Target: 100% critical task clearance.
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-[#D9E1EA]">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                onClick={handleStartGeneration}
                className="px-6 py-2.5 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded-lg font-bold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                title="Uses ready maintenance work, available corridor windows, resources and planning rules to create a proposed block schedule."
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Proposed Plan</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: GENERATING PLAN PROGRESS ── */}
        {step === 4 && (
          <div className="space-y-6 bg-white border border-[#D9E1EA] p-8 rounded-xl text-center max-w-xl mx-auto shadow-sm">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 text-[#173F7A] flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#172033]">Synthesizing Coordinated Block Plan</h2>
              <p className="text-xs text-[#667085] mt-1">
                Evaluating multi-departmental constraints, candidate windows, and timetable paths...
              </p>
            </div>

            {/* Progress Stage Steps */}
            <div className="space-y-2.5 text-left bg-[#F8FAFC] p-4 rounded-lg border border-[#D9E1EA] text-xs">
              {[
                { stepNum: 1, text: 'Analyzing maintenance demand, severity scores, and deadlines...' },
                { stepNum: 2, text: 'Mapping corridor timetable paths and identifying clear slots...' },
                { stepNum: 3, text: 'Checking heavy machinery and multi-gang crew availability...' },
                { stepNum: 4, text: 'Coordinating joint work across P-Way, Signal, and TRD...' },
                { stepNum: 5, text: 'Finalizing conflict-free block schedule...' },
              ].map((st) => {
                const isCurrent = genStep === st.stepNum;
                const isPassed = genStep > st.stepNum;
                return (
                  <div key={st.stepNum} className="flex items-center gap-2.5">
                    {isPassed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="w-4 h-4 text-[#173F7A] animate-spin flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-300 flex-shrink-0" />
                    )}
                    <span className={isPassed ? 'text-slate-700 font-medium' : isCurrent ? 'text-[#173F7A] font-bold' : 'text-slate-400'}>
                      {st.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {genError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs text-left">
                {genError}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
