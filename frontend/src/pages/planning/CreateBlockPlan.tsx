import { useState, useEffect, useMemo } from 'react';
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
  getCorridorInfrastructure,
  getCorridorCoordinationAnalysis,
  type MaintenanceTask,
  type CorridorWindowFull,
  type ResourceItem,
  type TimetableTrain,
  type Section,
  type CorridorInfrastructureData,
  type CorridorCoordinationResponse,
} from '../../lib/apiClient';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Wrench,
  AlertTriangle,
  Loader2,
  Layers,
  Train,
  Zap,
  Radio,
  GitMerge,
  ShieldAlert,
  ShieldCheck,
  Check,
  Info,
} from 'lucide-react';

export default function CreateBlockPlan() {
  const navigate = useNavigate();
  const { setWorkflowStage, refreshAll, planningWeekStart, planningWeekEnd } = usePlanning();

  // Wizard state: 1: Corridor & Period, 2: Infrastructure, 3: Maintenance Tasks, 4: Coordination Analysis, 5: Strategy & Generate, 6: Generating
  const [step, setStep] = useState<number>(1);
  const [selectedObjectiveProfile, setSelectedObjectiveProfile] = useState<string>('balanced');

  // Step 1: Period & Corridor
  const [startDate, setStartDate] = useState(planningWeekStart || '2026-09-08');
  const [endDate, setEndDate] = useState(planningWeekEnd || '2026-09-14');
  const [sections, setSections] = useState<Section[]>([]);
  const [fromStation, setFromStation] = useState<string>('');
  const [toStation, setToStation] = useState<string>('');
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);

  // Step 2: Infrastructure Data
  const [infraData, setInfraData] = useState<CorridorInfrastructureData | null>(null);
  const [loadingInfra, setLoadingInfra] = useState<boolean>(false);
  const [selectedInfraDept, setSelectedInfraDept] = useState<'all' | 'ENG' | 'SNT' | 'TRD'>('all');

  // Step 3 & 4: Maintenance Tasks & Coordination Analysis
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [windows, setWindows] = useState<CorridorWindowFull[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [trains, setTrains] = useState<TimetableTrain[]>([]);
  const [coordinationData, setCoordinationData] = useState<CorridorCoordinationResponse | null>(null);
  const [loadingCoordination, setLoadingCoordination] = useState<boolean>(false);
  const [taskFilterDept, setTaskFilterDept] = useState<string>('ALL');

  // Step 6: Generation Progress
  const [genStep, setGenStep] = useState<number>(0);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    if (planningWeekStart && planningWeekEnd) {
      setStartDate(planningWeekStart);
      setEndDate(planningWeekEnd);
    }
  }, [planningWeekStart, planningWeekEnd]);

  // Initial Load
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
        setTasks(tData);
        setWindows(wData);
        setResources(rData);
        setTrains(trData);

        if (secData.length > 0) {
          // Initialize stations from existing sections
          setFromStation(secData[0].from_station);
          setToStation(secData[secData.length - 1].to_station);
          setSelectedSectionIds(secData.map((s) => s.id));
        }
      } catch (err) {
        console.error('Error loading planning inputs snapshot:', err);
      }
    };
    loadInputs();
  }, [setWorkflowStage]);

  // Distinct stations list for dropdowns
  const availableStations = useMemo(() => {
    const stSet = new Set<string>();
    sections.forEach((s) => {
      if (s.from_station) stSet.add(s.from_station);
      if (s.to_station) stSet.add(s.to_station);
    });
    return Array.from(stSet);
  }, [sections]);

  // Load Corridor Infrastructure whenever From/To changes or on Step 2 entry
  useEffect(() => {
    const fetchInfra = async () => {
      if (!fromStation || !toStation) return;
      setLoadingInfra(true);
      try {
        const data = await getCorridorInfrastructure(fromStation, toStation);
        setInfraData(data);
      } catch (err) {
        console.error('Error loading corridor infrastructure:', err);
      } finally {
        setLoadingInfra(false);
      }
    };
    fetchInfra();
  }, [fromStation, toStation]);

  // Load Coordination Analysis whenever sections or Step 4 is reached
  useEffect(() => {
    const fetchCoordination = async () => {
      if (selectedSectionIds.length === 0) return;
      setLoadingCoordination(true);
      try {
        const data = await getCorridorCoordinationAnalysis(selectedSectionIds);
        setCoordinationData(data);
      } catch (err) {
        console.error('Error loading coordination analysis:', err);
      } finally {
        setLoadingCoordination(false);
      }
    };
    if (step >= 3) {
      fetchCoordination();
    }
  }, [selectedSectionIds, step]);

  const handleToggleSection = (secId: string) => {
    if (selectedSectionIds.includes(secId)) {
      if (selectedSectionIds.length === 1) return; // Keep at least 1
      setSelectedSectionIds(selectedSectionIds.filter((id) => id !== secId));
    } else {
      setSelectedSectionIds([...selectedSectionIds, secId]);
    }
  };

  // Filter tasks belonging to selected corridor sections
  const corridorTasks = useMemo(() => {
    return tasks.filter((t) => selectedSectionIds.includes(t.section_id));
  }, [tasks, selectedSectionIds]);

  const filteredTasks = useMemo(() => {
    if (taskFilterDept === 'ALL') return corridorTasks;
    return corridorTasks.filter(
      (t) => (t.department_code || '').toUpperCase() === taskFilterDept.toUpperCase()
    );
  }, [corridorTasks, taskFilterDept]);

  const readyTasks = corridorTasks.filter(
    (t) => t.status === 'Pending' || t.status === 'New' || t.status === 'PENDING' || t.status === 'Ready for Planning' || !t.status
  );
  const activeWindows = windows.filter((w) => w.is_available);
  const availableResources = resources.filter((r) => r.is_available);

  // Validation
  const isStep1Complete = Boolean(
    startDate &&
    endDate &&
    new Date(endDate) >= new Date(startDate) &&
    selectedSectionIds.length > 0 &&
    fromStation &&
    toStation
  );

  const isStep2Complete = Boolean(infraData && infraData.configured_lines.length > 0);
  const isStep3Complete = Boolean(corridorTasks.length > 0);
  const isStep4Complete = Boolean(coordinationData !== null);
  const isStep5Complete = Boolean(selectedObjectiveProfile);

  const handleStartGeneration = async () => {
    setStep(6);
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

  const stepsList = [
    { num: 1, label: 'Corridor & Dates', isComplete: isStep1Complete },
    { num: 2, label: 'Railway Infrastructure', isComplete: isStep2Complete },
    { num: 3, label: 'Corridor Tasks', isComplete: isStep3Complete },
    { num: 4, label: 'Coordination Analysis', isComplete: isStep4Complete },
    { num: 5, label: 'Optimization Objective', isComplete: isStep5Complete },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F6F8FB] text-[#172033]">
      <TopBar title="Create Block Plan" subtitle="Coordinated Multi-Department Corridor Possession Synthesis" />
      <WorkflowBar activeStage={4} />

      <main className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Page Guide Banner */}
        <PageGuideBanner
          pageTitle="Create Block Plan — Multi-Department Controller Workflow"
          purpose="Select the operational corridor context, inspect internal railway infrastructure across P-Way, S&T, and 25kV TRD, verify pending departmental maintenance tasks, evaluate pair-by-pair joint work possibilities, and run mathematical CP-SAT optimization."
          inputs={['Corridor Station Range', 'Departmental Infrastructure', 'Pending Maintenance Demands', 'Train Paths & Windows']}
          outputs={['Multi-Department Possessions', 'Joint Track/OHE Possessions', 'Delay Minimization Schedule']}
          nextStep={{ label: 'Inspect Proposed Block Schedule', to: '/planning/proposed' }}
        />

        {/* 5-Step Stepper Bar */}
        <div className="bg-white rounded-xl border border-[#D9E1EA] p-4 shadow-xs">
          <div className="flex items-center justify-between max-w-4xl mx-auto overflow-x-auto pb-1">
            {stepsList.map((s, idx) => {
              const isCurrent = step === s.num;
              const isDone = s.isComplete && step > s.num;

              return (
                <div key={s.num} className="flex items-center gap-3">
                  <div
                    onClick={() => {
                      if (s.num <= step || s.isComplete) {
                        setStep(s.num);
                      }
                    }}
                    className={`flex items-center gap-2 cursor-pointer transition-all ${
                      isCurrent
                        ? 'text-[#173F7A] font-bold'
                        : isDone
                        ? 'text-emerald-700 font-semibold'
                        : 'text-slate-400 font-medium'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                        isCurrent
                          ? 'bg-[#173F7A] text-white ring-2 ring-[#173F7A]/30 ring-offset-1'
                          : isDone
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isDone ? <Check className="w-4 h-4 text-emerald-700" /> : s.num}
                    </div>
                    <span className="text-xs whitespace-nowrap">{s.label}</span>
                  </div>
                  {idx < stepsList.length - 1 && (
                    <div className="w-8 h-0.5 bg-slate-200 hidden sm:block" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 1: SELECT CORRIDOR (STATION RANGE & HORIZON)
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-6 bg-white border border-[#D9E1EA] p-6 rounded-xl shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#173F7A] text-white text-xs font-mono">STEP 1</span>
                  Select Corridor Context & Planning Period
                </h2>
                <p className="text-xs text-[#667085] mt-1">
                  Station A → Station B represents the <strong>Corridor Context</strong> containing multiple internal railway entities (UP line, DOWN line, signals, OHE masts). It is not treated as a single monolithic block.
                </p>
              </div>
              <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-blue-50 text-[#173F7A] rounded border border-blue-200">
                Corridor Definition
              </span>
            </div>

            {/* Station Range Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[#F8FAFC] border border-[#D9E1EA] rounded-xl">
              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1.5 flex items-center gap-1.5">
                  <Train className="w-3.5 h-3.5 text-[#173F7A]" />
                  From Station (Origin Boundary)
                </label>
                <select
                  value={fromStation}
                  onChange={(e) => setFromStation(e.target.value)}
                  className="w-full bg-white border border-[#D9E1EA] rounded-lg p-2.5 text-[#172033] text-xs font-semibold focus:outline-none focus:border-[#173F7A]"
                >
                  {availableStations.map((st) => (
                    <option key={`from-${st}`} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-[#667085] mt-1 block">Corridor boundary start limit</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1.5 flex items-center gap-1.5">
                  <Train className="w-3.5 h-3.5 text-[#173F7A]" />
                  To Station (Destination Boundary)
                </label>
                <select
                  value={toStation}
                  onChange={(e) => setToStation(e.target.value)}
                  className="w-full bg-white border border-[#D9E1EA] rounded-lg p-2.5 text-[#172033] text-xs font-semibold focus:outline-none focus:border-[#173F7A]"
                >
                  {availableStations.map((st) => (
                    <option key={`to-${st}`} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-[#667085] mt-1 block">Corridor boundary end limit</span>
              </div>
            </div>

            {/* Planning Period */}
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

            {/* Sections encompassed */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-[#172033]">
                  Corridor Track Sections Included ({selectedSectionIds.length} of {sections.length} active)
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedSectionIds(sections.map((s) => s.id))}
                  className="text-[11px] text-[#173F7A] font-bold hover:underline"
                >
                  Select All Sections
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {sections.map((sec) => {
                  const isSelected = selectedSectionIds.includes(sec.id);
                  return (
                    <div
                      key={sec.id}
                      onClick={() => handleToggleSection(sec.id)}
                      className={`p-3 rounded-lg border text-xs font-medium cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#EBF2FA] border-[#173F7A] text-[#173F7A] font-bold shadow-xs ring-1 ring-[#173F7A]/30'
                          : 'bg-[#F8FAFC] border-[#D9E1EA] text-[#667085] hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="truncate">{sec.name}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#173F7A] flex-shrink-0" />}
                      </div>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {sec.from_station} → {sec.to_station} ({sec.length_km || 25} km)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 1 Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[#D9E1EA]">
              <div>
                {!isStep1Complete && (
                  <p className="text-xs text-amber-700 flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    Please specify valid start/end dates and choose corridor sections.
                  </p>
                )}
              </div>
              <button
                onClick={() => isStep1Complete && setStep(2)}
                disabled={!isStep1Complete}
                className={`px-5 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors shadow-xs ${
                  isStep1Complete
                    ? 'bg-[#173F7A] hover:bg-[#1E4E8C] text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>Inspect Corridor Infrastructure</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 2: SHOW RAILWAY INFRASTRUCTURE BETWEEN STATIONS
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-6 bg-white border border-[#D9E1EA] p-6 rounded-xl shadow-xs">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#173F7A] text-white text-xs font-mono">STEP 2</span>
                  Railway Infrastructure Inside Corridor: {fromStation} → {toStation}
                </h2>
                <p className="text-xs text-[#667085] mt-1">
                  Exposes internal entities across lines. Each department maintains its natural reference system mapped to the corridor chainage.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-300 font-semibold">
                  Length: {infraData?.total_length_km || 0} KM
                </span>
                <span className="text-xs font-mono bg-blue-50 text-[#173F7A] px-2.5 py-1 rounded border border-blue-200 font-semibold">
                  {infraData?.configured_lines.length || 0} Configured Lines
                </span>
              </div>
            </div>

            {loadingInfra ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#173F7A]" />
                <span className="text-xs text-slate-500 font-medium">Loading departmental railway infrastructure assets...</span>
              </div>
            ) : infraData ? (
              <div className="space-y-5">
                {/* 1. Configured Lines Display (Data-Driven: UP, DOWN, UP Fast, DOWN Fast, etc.) */}
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#D9E1EA] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#172033] uppercase font-mono tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#173F7A]" />
                      Data-Driven Configured Corridor Lines
                    </span>
                    <span className="text-[11px] text-slate-500">Dynamically loaded from section topology</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {infraData.configured_lines.map((ln) => (
                      <span
                        key={ln}
                        className="px-3 py-1.5 rounded-lg bg-white border border-[#D9E1EA] text-xs font-bold text-[#173F7A] shadow-xs flex items-center gap-2"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#173F7A]" />
                        {ln}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 2. Department Infrastructure Tabs */}
                <div className="flex items-center gap-2 border-b border-[#D9E1EA] pb-2">
                  <button
                    onClick={() => setSelectedInfraDept('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedInfraDept === 'all'
                        ? 'bg-[#173F7A] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Infrastructure ({infraData.departments.engineering.count + infraData.departments.signalling.count + infraData.departments.traction.count})
                  </button>
                  <button
                    onClick={() => setSelectedInfraDept('ENG')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      selectedInfraDept === 'ENG'
                        ? 'bg-amber-700 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Engineering / P-Way ({infraData.departments.engineering.count})
                  </button>
                  <button
                    onClick={() => setSelectedInfraDept('SNT')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      selectedInfraDept === 'SNT'
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    S&T Signals ({infraData.departments.signalling.count})
                  </button>
                  <button
                    onClick={() => setSelectedInfraDept('TRD')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      selectedInfraDept === 'TRD'
                        ? 'bg-red-700 text-white shadow-xs'
                        : 'bg-red-50 text-red-900 border border-red-200 hover:bg-red-100'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    TRD OHE & 25kV ({infraData.departments.traction.count})
                  </button>
                </div>

                {/* 3. Three Department Cards Display */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Civil Engineering */}
                  {(selectedInfraDept === 'all' || selectedInfraDept === 'ENG') && (
                    <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/30 flex flex-col">
                      <div className="bg-amber-100/70 px-4 py-2.5 border-b border-amber-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-amber-800" />
                          <span className="font-bold text-xs text-amber-900">Civil Engineering (P-Way)</span>
                        </div>
                        <span className="text-[10px] font-mono bg-white text-amber-800 px-2 py-0.5 rounded font-bold border border-amber-200">
                          Chainage (KM)
                        </span>
                      </div>
                      <div className="p-3 divide-y divide-amber-100 text-xs flex-1 max-h-72 overflow-y-auto">
                        {infraData.departments.engineering.entities.length > 0 ? (
                          infraData.departments.engineering.entities.map((item) => (
                            <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800">{item.asset_type}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold">
                                  {item.track_line} Line
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-600 font-mono">
                                {item.start_ref} → {item.end_ref}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                KM {item.chainage_start_km?.toFixed(1) || '0.0'} to KM {item.chainage_end_km?.toFixed(1) || '0.0'} • {item.section_name}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-6 text-center text-slate-400 text-xs">No P-Way assets in selection</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Signalling & Telecom */}
                  {(selectedInfraDept === 'all' || selectedInfraDept === 'SNT') && (
                    <div className="border border-blue-200 rounded-xl overflow-hidden bg-blue-50/30 flex flex-col">
                      <div className="bg-blue-100/70 px-4 py-2.5 border-b border-blue-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Radio className="w-4 h-4 text-blue-800" />
                          <span className="font-bold text-xs text-blue-900">Signalling & Telecom (S&T)</span>
                        </div>
                        <span className="text-[10px] font-mono bg-white text-blue-800 px-2 py-0.5 rounded font-bold border border-blue-200">
                          Signal Spans
                        </span>
                      </div>
                      <div className="p-3 divide-y divide-blue-100 text-xs flex-1 max-h-72 overflow-y-auto">
                        {infraData.departments.signalling.entities.length > 0 ? (
                          infraData.departments.signalling.entities.map((item) => (
                            <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800">{item.asset_type}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-semibold">
                                  {item.track_line} Line
                                </span>
                              </div>
                              <div className="text-[11px] text-blue-800 font-mono font-bold">
                                {item.start_ref} → {item.end_ref}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Mapped to KM {item.chainage_start_km?.toFixed(1) || '0.0'}–{item.chainage_end_km?.toFixed(1) || '0.0'} • {item.section_name}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-6 text-center text-slate-400 text-xs">No Signal assets in selection</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TRD (Traction Distribution) */}
                  {(selectedInfraDept === 'all' || selectedInfraDept === 'TRD') && (
                    <div className="border border-red-200 rounded-xl overflow-hidden bg-red-50/30 flex flex-col">
                      <div className="bg-red-100/70 px-4 py-2.5 border-b border-red-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-red-800" />
                          <span className="font-bold text-xs text-red-900">Traction Distribution (TRD)</span>
                        </div>
                        <span className="text-[10px] font-mono bg-white text-red-800 px-2 py-0.5 rounded font-bold border border-red-200">
                          OHE & 25kV
                        </span>
                      </div>
                      <div className="p-3 divide-y divide-red-100 text-xs flex-1 max-h-72 overflow-y-auto">
                        {infraData.departments.traction.entities.length > 0 ? (
                          infraData.departments.traction.entities.map((item) => (
                            <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800">{item.asset_type}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-100 text-red-900 font-semibold">
                                  {item.track_line} Line
                                </span>
                              </div>
                              <div className="text-[11px] text-red-800 font-mono font-bold">
                                {item.start_ref} → {item.end_ref}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                KM {item.chainage_start_km?.toFixed(1) || '0.0'}–{item.chainage_end_km?.toFixed(1) || '0.0'} • 25kV OHE Catenary
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-6 text-center text-slate-400 text-xs">No TRD assets in selection</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Railway Domain Distinction Banner */}
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg flex items-start gap-2.5 text-xs text-[#173F7A]">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-700" />
                  <div>
                    <strong className="font-semibold text-blue-900">Common Corridor Coordinate Mapping:</strong> While Engineering uses chainage (KM), S&T uses signal spans (e.g. S1 → S2), and TRD uses OHE masts & 25kV electrical sections (e.g. M18 → M27), SANGAM correlates them along the continuous corridor chainage without forcing unnatural signal boundaries on other departments.
                  </div>
                </div>
              </div>
            ) : null}

            {/* Step 2 Actions */}
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
                className="px-5 py-2.5 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded-lg font-bold text-xs flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <span>Show Maintenance Tasks Inside Corridor</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 3: SHOW MAINTENANCE TASKS INSIDE THE CORRIDOR
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="space-y-6 bg-white border border-[#D9E1EA] p-6 rounded-xl shadow-xs">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#173F7A] text-white text-xs font-mono">STEP 3</span>
                  Pending Maintenance Tasks Inside Corridor ({corridorTasks.length})
                </h2>
                <p className="text-xs text-[#667085] mt-1">
                  Each task retains its natural departmental location, track line, and protection requirements (Traffic Block, Power Block, S&T Disconnection).
                </p>
              </div>

              {/* Department Filter Pills */}
              <div className="flex items-center gap-2">
                {['ALL', 'ENG', 'SNT', 'TRD'].map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setTaskFilterDept(dept)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      taskFilterDept === dept
                        ? 'bg-[#173F7A] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            {/* Tasks Table */}
            <div className="border border-[#D9E1EA] rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-[#D9E1EA] text-[11px] font-mono uppercase font-bold text-[#667085]">
                    <tr>
                      <th className="p-3">Task ID</th>
                      <th className="p-3">Dept</th>
                      <th className="p-3">Location & Spatial Ref</th>
                      <th className="p-3">Track / Line</th>
                      <th className="p-3">Maintenance Type</th>
                      <th className="p-3">Required Protection</th>
                      <th className="p-3 text-right">Duration</th>
                      <th className="p-3 text-center">Joint Eligible</th>
                      <th className="p-3 text-right">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9E1EA]">
                    {filteredTasks.length > 0 ? (
                      filteredTasks.map((t) => {
                        const deptCode = (t.department_code || 'GEN').toUpperCase();
                        const isPower = t.requires_power_isolation || t.block_type_required === 'Power Block';
                        return (
                          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-[#173F7A]">
                              {t.task_code}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                  deptCode === 'ENG'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : deptCode === 'SNT'
                                    ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                    : 'bg-red-100 text-red-900 border border-red-200'
                                }`}
                              >
                                {deptCode}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-800">
                                {t.location_display || `${t.section_name || 'Corridor'}`}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                KM {t.chainage_from_km?.toFixed(1) || '0.0'} → {t.chainage_to_km?.toFixed(1) || '0.0'}
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold font-mono text-[11px] border border-slate-200">
                                {t.track_line || 'UP'}
                              </span>
                            </td>
                            <td className="p-3 font-medium text-slate-800">
                              {t.maintenance_type}
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                  isPower
                                    ? 'bg-red-50 text-red-800 border border-red-300'
                                    : t.block_type_required === 'S&T Disconnection'
                                    ? 'bg-blue-50 text-blue-800 border border-blue-300'
                                    : 'bg-amber-50 text-amber-800 border border-amber-300'
                                }`}
                              >
                                {isPower && <Zap className="w-3 h-3 text-red-600" />}
                                {t.block_type_required || (isPower ? 'Power Block' : 'Traffic Block')}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono font-semibold text-slate-700">
                              {t.estimated_duration_min} min
                            </td>
                            <td className="p-3 text-center">
                              {t.is_joint_block_eligible !== false ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Yes
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                                  <ShieldAlert className="w-3.5 h-3.5" /> Sole
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-[#173F7A]">
                              {t.priority_score?.toFixed(1) || '—'}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400 text-xs">
                          No pending maintenance tasks found in the selected corridor sections.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Step 3 Actions */}
            <div className="flex justify-between pt-4 border-t border-[#D9E1EA]">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                onClick={() => setStep(4)}
                className="px-5 py-2.5 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded-lg font-bold text-xs flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <span>Run Coordination Analysis</span>
                <GitMerge className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 4: SHOW WHICH TASKS CAN WORK TOGETHER (COORDINATION ANALYSIS)
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 4 && (
          <div className="space-y-6 bg-white border border-[#D9E1EA] p-6 rounded-xl shadow-xs">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#173F7A] text-white text-xs font-mono">STEP 4</span>
                  Pair-by-Pair Coordination Analysis
                </h2>
                <p className="text-xs text-[#667085] mt-1">
                  Evaluates physical spatial overlap, track relationship, power block isolation requirements, and protection compatibility to detect Candidate Joint Work.
                </p>
              </div>

              {coordinationData && (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-mono font-bold text-xs">
                    {coordinationData.candidate_joint_pairs} Joint Work Candidates
                  </span>
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-300 rounded font-mono font-bold text-xs">
                    {coordinationData.total_coordination_pairs} Evaluated Pairs
                  </span>
                </div>
              )}
            </div>

            {loadingCoordination ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#173F7A]" />
                <span className="text-xs text-slate-500 font-medium">Computing corridor coordination possibilities...</span>
              </div>
            ) : coordinationData && coordinationData.pairs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {coordinationData.pairs.map((p, idx) => {
                  const isJoint = p.result === 'CANDIDATE JOINT WORK';
                  const isParallel = p.result === 'PARALLEL SAME-DEPT WORK';
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-all space-y-3 ${
                        isJoint
                          ? 'bg-emerald-50/40 border-emerald-300 shadow-xs ring-1 ring-emerald-400/20'
                          : isParallel
                          ? 'bg-blue-50/30 border-blue-200'
                          : 'bg-slate-50/50 border-slate-200 opacity-75'
                      }`}
                    >
                      {/* Pair Header */}
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                        <div className="flex items-center gap-2 text-xs font-mono font-bold">
                          <span className="text-[#173F7A]">{p.task_a.code}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {p.task_a.dept}
                          </span>
                          <span className="text-slate-400 font-sans">↕</span>
                          <span className="text-[#173F7A]">{p.task_b.code}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {p.task_b.dept}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded uppercase ${
                            isJoint
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : isParallel
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {p.result}
                        </span>
                      </div>

                      {/* Locations & Lines */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white/70 p-2.5 rounded-lg border border-slate-200/60">
                        <div>
                          <div className="font-semibold text-slate-800">{p.task_a.type}</div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">{p.task_a.location}</div>
                          <div className="text-[10px] font-bold text-[#173F7A]">{p.task_a.track} Line</div>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{p.task_b.type}</div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">{p.task_b.location}</div>
                          <div className="text-[10px] font-bold text-[#173F7A]">{p.task_b.track} Line</div>
                        </div>
                      </div>

                      {/* Analysis Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                        <div className="p-1.5 rounded bg-white/60 border border-slate-200">
                          <span className="text-slate-400 block uppercase">Spatial Overlap</span>
                          <strong className={p.spatial_overlap === 'YES' ? 'text-emerald-700' : 'text-slate-700'}>
                            {p.spatial_overlap} {p.overlap_km > 0 ? `(${p.overlap_km.toFixed(1)} km)` : ''}
                          </strong>
                        </div>
                        <div className="p-1.5 rounded bg-white/60 border border-slate-200">
                          <span className="text-slate-400 block uppercase">Track Relation</span>
                          <strong className="text-slate-800">{p.track_relation}</strong>
                        </div>
                        <div className="p-1.5 rounded bg-white/60 border border-slate-200">
                          <span className="text-slate-400 block uppercase">Power Isolation</span>
                          <strong className={p.requires_power_cut ? 'text-red-700' : 'text-slate-600'}>
                            {p.requires_power_cut ? 'REQUIRED' : 'NO'}
                          </strong>
                        </div>
                        <div className="p-1.5 rounded bg-white/60 border border-slate-200">
                          <span className="text-slate-400 block uppercase">Protection</span>
                          <strong className="text-slate-800 truncate block" title={p.protection_check}>
                            {p.protection_check}
                          </strong>
                        </div>
                      </div>

                      {/* Rationale explanation */}
                      <p className="text-[11px] text-slate-600 leading-tight">
                        {p.reason}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                No active task pairs available to evaluate for coordination.
              </div>
            )}

            {/* Step 4 Actions */}
            <div className="flex justify-between pt-4 border-t border-[#D9E1EA]">
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                onClick={() => setStep(5)}
                className="px-5 py-2.5 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded-lg font-bold text-xs flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <span>Proceed to Optimization Objective</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 5: OPTIMIZATION OBJECTIVE STRATEGY & RUN SOLVER
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 5 && (
          <div className="space-y-6 bg-white border border-[#D9E1EA] p-6 rounded-xl shadow-xs">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#173F7A] text-white text-xs font-mono">STEP 5</span>
                Choose Optimization Objective Priority & Synthesize Plan
              </h2>
              <p className="text-xs text-[#667085]">
                Select the strategic balancing profile for SANGAM's mathematical CP-SAT scheduler.
              </p>
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

            {/* Summary Pill Before Run */}
            <div className="p-4 bg-[#F8FAFC] border border-[#D9E1EA] rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Corridor Context</span>
                  <strong className="text-slate-800">{fromStation} → {toStation}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Tasks Ready</span>
                  <strong className="text-emerald-700">{readyTasks.length} Eligible Tasks</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Corridor Windows</span>
                  <strong className="text-blue-700">{activeWindows.length} Available Slots ({trains.length} Trains Checked)</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Crews & Machines</span>
                  <strong className="text-slate-800">{availableResources.length} Ready</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Joint Combinations</span>
                  <strong className="text-[#173F7A]">{coordinationData?.candidate_joint_pairs || 0} Identified</strong>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-[#D9E1EA]">
              <button
                onClick={() => setStep(4)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                onClick={handleStartGeneration}
                className="px-6 py-2.5 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded-lg font-bold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Synthesize Coordinated Plan with CP-SAT</span>
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 6: GENERATING PLAN PROGRESS MODAL
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 6 && (
          <div className="space-y-6 bg-white border border-[#D9E1EA] p-8 rounded-xl text-center max-w-xl mx-auto shadow-sm">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 text-[#173F7A] flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#172033]">Synthesizing Coordinated Block Plan</h2>
              <p className="text-xs text-[#667085] mt-1">
                Evaluating spatial envelopes, OHE power isolations, candidate windows, and timetable paths...
              </p>
            </div>

            {/* Progress Stage Steps */}
            <div className="space-y-2.5 text-left bg-[#F8FAFC] p-4 rounded-lg border border-[#D9E1EA] text-xs">
              {[
                { stepNum: 1, text: 'Mapping corridor track lines (UP, DOWN, Fast) & departmental entities...' },
                { stepNum: 2, text: 'Resolving spatial coordinate overlaps along continuous corridor chainage...' },
                { stepNum: 3, text: 'Synthesizing TRD 25kV power block isolation envelopes with P-Way demands...' },
                { stepNum: 4, text: 'Running Google OR-Tools CP-SAT multi-department solver...' },
                { stepNum: 5, text: 'Finalizing conflict-free block schedule alternatives...' },
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
