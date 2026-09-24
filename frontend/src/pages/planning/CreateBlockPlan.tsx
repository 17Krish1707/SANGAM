import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import WorkflowBar from '../../components/WorkflowBar';
import { usePlanning } from '../../context/PlanningContext';
import {
  generatePlans,
  getTasks,
  getSections,
  getCorridorInfrastructure,
  type MaintenanceTask,
  type Section,
  type CorridorInfrastructureData,
} from '../../lib/apiClient';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2,
  Check,
} from 'lucide-react';

export default function CreateBlockPlan() {
  const navigate = useNavigate();
  const { setWorkflowStage, refreshAll, loadSpecificPlan } = usePlanning();

  // 5 Guided Steps:
  // 1: Select Corridor
  // 2: Relevant Maintenance Work
  // 3: Coordination Opportunities
  // 4: Available Block Windows
  // 5: Generate Plans
  const [step, setStep] = useState<number>(1);

  // Step 1: Corridor & Date
  const [fromStation, setFromStation] = useState<string>('Dadar');
  const [toStation, setToStation] = useState<string>('Vikhroli');
  const [selectedDate, setSelectedDate] = useState<string>('2026-09-24');
  const [sections, setSections] = useState<Section[]>([]);

  // Step 2: Maintenance Work selection
  const [allTasks, setAllTasks] = useState<MaintenanceTask[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showInfraPanel, setShowInfraPanel] = useState<boolean>(false);
  const [infraData, setInfraData] = useState<CorridorInfrastructureData | null>(null);

  // Step 3: Coordination Opportunities
  const [includedBundles, setIncludedBundles] = useState<Record<string, boolean>>({
    'bundle-dm-up': true,
    'bundle-ms-dn': true,
    'bundle-sk-up': true,
  });
  const [showIncompatible, setShowIncompatible] = useState<boolean>(false);

  // Step 5: Optimization
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    setWorkflowStage(4);
    const loadData = async () => {
      try {
        const [secList, taskList, infra] = await Promise.all([
          getSections().catch(() => []),
          getTasks().catch(() => []),
          getCorridorInfrastructure('Dadar', 'Vikhroli').catch(() => null),
        ]);
        setSections(secList);
        setAllTasks(taskList);
        setInfraData(infra);

        // Pre-select the 3 primary demonstration tasks (ENG-01, SNT-01, TRD-01) by default
        const demoTaskIds = taskList
          .filter((t) => ['ENG-01', 'SNT-01', 'TRD-01'].includes(t.task_code))
          .map((t) => t.id);
        if (demoTaskIds.length > 0) {
          setSelectedTaskIds(demoTaskIds);
        } else if (taskList.length > 0) {
          setSelectedTaskIds(taskList.slice(0, 3).map((t) => t.id));
        }
      } catch (err) {
        console.error('Failed loading wizard data:', err);
      }
    };
    loadData();
  }, [setWorkflowStage]);

  // Tasks in corridor
  const corridorTasks = useMemo(() => {
    return allTasks.filter((t) => t.status !== 'Completed');
  }, [allTasks]);

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const selectAllTasks = () => {
    setSelectedTaskIds(corridorTasks.map((t) => t.id));
  };

  const clearTaskSelection = () => {
    setSelectedTaskIds([]);
  };

  // Meaningful coordination bundles
  const coordinationBundles = useMemo(() => {
    const selTasks = corridorTasks.filter((t) => selectedTaskIds.includes(t.id));
    const bundles = [];

    // Bundle 1: Dadar–Matunga UP (ENG-01, SNT-01, TRD-01)
    const dmUpTasks = selTasks.filter(
      (t) => (t.section_name?.includes('Dadar') || t.section_name === 'Dadar–Matunga') && ((t as any).track_line === 'UP' || !(t as any).track_line)
    );
    if (dmUpTasks.length >= 2) {
      const sepMin = dmUpTasks.reduce((acc, t) => acc + (t.estimated_duration_min || 60), 0);
      const jointMin = Math.max(...dmUpTasks.map((t) => t.estimated_duration_min || 60));
      bundles.push({
        id: 'bundle-dm-up',
        title: dmUpTasks.map((t) => t.task_code).join(' + '),
        section: 'Dadar–Matunga',
        line: 'UP Line',
        overlap: 'KM 0.8 – 1.2',
        separateMin: sepMin,
        jointMin: Math.max(60, jointMin),
        savingsMin: sepMin - Math.max(60, jointMin),
        tasks: dmUpTasks,
        reasons: [
          'Same UP line on Dadar–Matunga corridor section',
          'Physical spatial overlap along KM 0.8 – 1.2',
          'Compatible protections: Traffic Block + Power Block + S&T Disconnection',
          'Can share one integrated possession window without mutual interference',
        ],
      });
    }

    // Bundle 2: Matunga–Sion DOWN (ENG-02, SNT-02)
    const msDnTasks = selTasks.filter(
      (t) => (t.section_name?.includes('Sion') || t.section_name === 'Matunga–Sion') && (t as any).track_line === 'DOWN'
    );
    if (msDnTasks.length >= 2) {
      const sepMin = msDnTasks.reduce((acc, t) => acc + (t.estimated_duration_min || 60), 0);
      const jointMin = Math.max(...msDnTasks.map((t) => t.estimated_duration_min || 60));
      bundles.push({
        id: 'bundle-ms-dn',
        title: msDnTasks.map((t) => t.task_code).join(' + '),
        section: 'Matunga–Sion',
        line: 'DOWN Line',
        overlap: 'KM 2.2 – 2.6',
        separateMin: sepMin,
        jointMin: jointMin,
        savingsMin: sepMin - jointMin,
        tasks: msDnTasks,
        reasons: [
          'Same DOWN line on Matunga–Sion segment',
          'Physical spatial overlap at Point PM-102 (KM 2.2 – 2.6)',
          'Civil P-Way weld repair and S&T point machine calibration can share track closure',
        ],
      });
    }

    // Bundle 3: Sion–Kurla UP (ENG-03, TRD-03)
    const skUpTasks = selTasks.filter(
      (t) => t.section_name?.includes('Kurla') && (t as any).track_line === 'UP'
    );
    if (skUpTasks.length >= 2) {
      const sepMin = skUpTasks.reduce((acc, t) => acc + (t.estimated_duration_min || 60), 0);
      const jointMin = Math.max(...skUpTasks.map((t) => t.estimated_duration_min || 60));
      bundles.push({
        id: 'bundle-sk-up',
        title: skUpTasks.map((t) => t.task_code).join(' + '),
        section: 'Sion–Kurla',
        line: 'UP Line',
        overlap: 'KM 4.8 – 5.5',
        separateMin: sepMin,
        jointMin: jointMin,
        savingsMin: sepMin - jointMin,
        tasks: skUpTasks,
        reasons: [
          'Same UP line approach to Kurla Jn',
          'Spatial overlap KM 4.8 – 5.5 along Turnout T-201 and OHE Span SK-CW01',
          'Tower Wagon wire renewal and track screening executed under joint traffic/power isolation',
        ],
      });
    }

    return bundles;
  }, [corridorTasks, selectedTaskIds]);

  // Meaningful rejected combinations (collapsed by default)
  const rejectedCombinations = [
    {
      pair: 'ENG-02 + TRD-02',
      reason: 'Incompatible track direction (ENG-02 on DOWN line vs TRD-02 on UP line)',
    },
    {
      pair: 'ENG-01 + ENG-02',
      reason: 'Different corridor sections (Dadar–Matunga vs Matunga–Sion) without continuous possession',
    },
    {
      pair: 'TRD-01 + TRD-02',
      reason: 'Shared scarce resource constraint (Single Tower Wagon TW-01 required by both)',
    },
  ];

  // Available Windows before optimization
  const candidateWindows = [
    {
      id: 'win-1',
      timeSpan: '00:40 – 01:55',
      durationMin: 75,
      line: 'UP Line',
      section: 'Dadar–Matunga',
      affectedTrains: 0,
      affectedTrainsDesc: '0 scheduled trains (Zero conflict window)',
      badge: 'Optimal Window',
      badgeColor: 'emerald',
    },
    {
      id: 'win-2',
      timeSpan: '02:10 – 03:25',
      durationMin: 75,
      line: 'UP Line',
      section: 'Dadar–Matunga',
      affectedTrains: 1,
      affectedTrainsDesc: '1 train requires regulation: Train 12021 (+6 min at Dadar)',
      badge: 'Minor Adjustment',
      badgeColor: 'amber',
    },
    {
      id: 'win-3',
      timeSpan: '03:45 – 05:00',
      durationMin: 75,
      line: 'UP Line',
      section: 'Dadar–Matunga',
      affectedTrains: 0,
      affectedTrainsDesc: '0 scheduled trains (Zero conflict window)',
      badge: 'Available',
      badgeColor: 'blue',
    },
  ];

  // Step 5 Handler: Trigger CP-SAT Solver
  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    setGenError(null);

    try {
      const resp = await generatePlans({
        start_date: `${selectedDate}T00:00:00`,
        end_date: `${selectedDate}T23:59:59`,
        section_ids: sections.map((s) => s.id),
        task_ids: selectedTaskIds.length > 0 ? selectedTaskIds : undefined,
        objective_profile: 'balanced',
        run_types: ['sangam_optimized', 'greedy_baseline', 'independent_baseline'],
      });

      const sangamRun = resp.runs.find((r) => r.run_type === 'sangam_optimized');
      if (sangamRun?.run_id) {
        await loadSpecificPlan(sangamRun.run_id);
        await refreshAll();
        setWorkflowStage(5);
        navigate('/planning/proposed');
      } else {
        throw new Error('CP-SAT solver returned no viable schedule.');
      }
    } catch (err: any) {
      console.error('Plan generation failed:', err);
      setGenError(err.message || 'Optimization solver failed. Please verify candidate windows and constraints.');
    } finally {
      setIsGenerating(false);
    }
  };

  const stepsList = [
    { num: 1, label: 'Select Corridor' },
    { num: 2, label: 'Maintenance Work' },
    { num: 3, label: 'Coordination' },
    { num: 4, label: 'Available Windows' },
    { num: 5, label: 'Generate Plans' },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50">
      <TopBar title="Create Block Plan" subtitle="Guided Multi-Department Corridor Possession Synthesis" />
      <WorkflowBar activeStage={4} />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Stepper Header */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {stepsList.map((s, idx) => {
              const isCurrent = step === s.num;
              const isDone = step > s.num;

              return (
                <div key={s.num} className="flex items-center gap-2">
                  <button
                    onClick={() => setStep(s.num)}
                    className={`flex items-center gap-2 text-xs font-semibold transition-colors ${
                      isCurrent
                        ? 'text-[#173F7A]'
                        : isDone
                        ? 'text-emerald-700'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                        isCurrent
                          ? 'bg-[#173F7A] text-white ring-2 ring-[#173F7A]/20'
                          : isDone
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : s.num}
                    </div>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {idx < stepsList.length - 1 && (
                    <div className="w-6 sm:w-12 h-0.5 bg-slate-200 mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 1: SELECT CORRIDOR
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-[#173F7A] text-xs font-bold uppercase tracking-wider">
                STEP 1
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">Select Railway Corridor &amp; Date</h2>
              <p className="text-xs text-slate-500">
                Choose the operational corridor boundary stations and target planning date.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  From Station
                </label>
                <select
                  value={fromStation}
                  onChange={(e) => setFromStation(e.target.value)}
                  className="w-full text-sm font-semibold border border-slate-300 rounded-lg py-2 px-3 bg-white text-slate-900 focus:ring-1 focus:ring-[#173F7A]"
                >
                  <option value="Dadar">Dadar (KM 0.0)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  To Station
                </label>
                <select
                  value={toStation}
                  onChange={(e) => setToStation(e.target.value)}
                  className="w-full text-sm font-semibold border border-slate-300 rounded-lg py-2 px-3 bg-white text-slate-900 focus:ring-1 focus:ring-[#173F7A]"
                >
                  <option value="Vikhroli">Vikhroli (KM 14.8)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Planning Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full text-sm font-semibold border border-slate-300 rounded-lg py-2 px-3 bg-white text-slate-900 focus:ring-1 focus:ring-[#173F7A]"
                />
              </div>
            </div>

            {/* Corridor Summary Card */}
            <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                Corridor Alignment Selected
              </span>
              <div className="text-sm font-bold text-slate-900 flex flex-wrap items-center gap-2">
                <span>Dadar</span>
                <span className="text-slate-400">→</span>
                <span>Matunga</span>
                <span className="text-slate-400">→</span>
                <span>Sion</span>
                <span className="text-slate-400">→</span>
                <span>Kurla</span>
                <span className="text-slate-400">→</span>
                <span>Ghatkopar</span>
                <span className="text-slate-400">→</span>
                <span>Vikhroli</span>
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-4 pt-1">
                <span>Total Length: <strong className="text-slate-800">14.8 km</strong></span>
                <span>Tracks: <strong className="text-slate-800">UP + DOWN Double Line</strong></span>
                <span>Traction: <strong className="text-slate-800">25 kV AC OHE Electrified</strong></span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#173F7A] hover:bg-[#123262] text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                Continue to Maintenance Work
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 2: RELEVANT MAINTENANCE WORK
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-[#173F7A] text-xs font-bold uppercase tracking-wider">
                  STEP 2
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">Select Maintenance Jobs to Plan</h2>
                <p className="text-xs text-slate-500">
                  Select which pending maintenance demands should be optimized into block possessions.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllTasks}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md border border-slate-300"
                >
                  Select All
                </button>
                <button
                  onClick={clearTaskSelection}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md border border-slate-300"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {/* Maintenance Jobs Table with Checkboxes */}
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {corridorTasks.map((t) => {
                const isChecked = selectedTaskIds.includes(t.id);
                const dept = t.department_code || t.department || t.department_id || 'ENG';
                const line = (t as any).track_line || 'UP';

                return (
                  <div
                    key={t.id}
                    onClick={() => toggleTaskSelection(t.id)}
                    className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isChecked ? 'bg-blue-50/60 hover:bg-blue-50' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by row click
                        className="w-4 h-4 rounded text-[#173F7A] focus:ring-[#173F7A]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-[#173F7A]">{t.task_code}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            dept === 'ENG' ? 'bg-blue-100 text-blue-800' : dept === 'SNT' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {dept}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {line}
                          </span>
                          <span className="font-semibold text-xs text-slate-900">{t.maintenance_type}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {t.section_name} • {(t as any).location_display || `KM ${(t as any).chainage_from_km ?? 0.0}–${(t as any).chainage_to_km ?? 1.0}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <span className="font-bold text-xs text-slate-700 whitespace-nowrap">
                        {t.estimated_duration_min} min
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        t.requires_power_isolation
                          ? 'bg-amber-100 text-amber-800'
                          : (t as any).requires_signal_disconnection
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {t.requires_power_isolation ? 'Power Block' : (t as any).requires_signal_disconnection ? 'S&T Disconnection' : 'Traffic Block'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Expandable Corridor Infrastructure Panel */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowInfraPanel(!showInfraPanel)}
                className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors"
              >
                <span>View corridor infrastructure ({infraData?.total_length_km ?? 14.8} km assets)</span>
                {showInfraPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showInfraPanel && (
                <div className="p-4 bg-white divide-y divide-slate-100 text-xs space-y-3">
                  <div>
                    <h5 className="font-bold text-blue-900 mb-1">Civil Track &amp; Turnouts (P-Way)</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                      {infraData?.departments?.engineering?.entities?.slice(0, 4).map((e) => (
                        <div key={e.id} className="p-2 bg-slate-50 rounded border border-slate-200">
                          <strong>{e.asset_type} ({e.track_line})</strong>: {e.notes}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-2">
                    <h5 className="font-bold text-purple-900 mb-1">Signals &amp; Point Machines (S&amp;T)</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                      {infraData?.departments?.signalling?.entities?.slice(0, 4).map((e) => (
                        <div key={e.id} className="p-2 bg-slate-50 rounded border border-slate-200">
                          <strong>{e.asset_type} ({e.track_line})</strong>: {e.notes}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-2">
                    <h5 className="font-bold text-amber-900 mb-1">OHE Masts &amp; Catenary Sections (TRD)</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                      {infraData?.departments?.traction?.entities?.slice(0, 4).map((e) => (
                        <div key={e.id} className="p-2 bg-slate-50 rounded border border-slate-200">
                          <strong>{e.asset_type} ({e.track_line})</strong>: {e.notes}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stepper Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                disabled={selectedTaskIds.length === 0}
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#173F7A] hover:bg-[#123262] text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                Continue to Coordination Opportunities ({selectedTaskIds.length} tasks)
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 3: COORDINATION OPPORTUNITIES
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-[#173F7A] text-xs font-bold uppercase tracking-wider">
                STEP 3
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">Coordination Opportunities</h2>
              <p className="text-xs text-slate-500">
                Identify tasks that can share a single possession instead of taking separate line closures.
              </p>
            </div>

            {/* Joint Opportunities */}
            <div className="space-y-4">
              {coordinationBundles.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                  No co-located multi-task bundles found for the selected tasks. Tasks will be scheduled in individual slots.
                </div>
              ) : (
                coordinationBundles.map((b) => {
                  const isIncluded = includedBundles[b.id] ?? true;

                  return (
                    <div
                      key={b.id}
                      className="p-5 bg-emerald-50/50 border-2 border-emerald-200 rounded-xl space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded bg-emerald-700 text-white font-bold text-xs tracking-wider">
                            JOINT WORK OPPORTUNITY
                          </span>
                          <span className="font-bold text-sm text-slate-900">{b.title}</span>
                        </div>

                        <button
                          onClick={() =>
                            setIncludedBundles((prev) => ({ ...prev, [b.id]: !isIncluded }))
                          }
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                            isIncluded
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {isIncluded ? '✓ Included Together' : '+ Include Together'}
                        </button>
                      </div>

                      {/* Criteria Checklist */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                        {b.reasons.map((r, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>

                      {/* Time Comparison */}
                      <div className="p-3 bg-white rounded-lg border border-emerald-200 flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-600">
                          Separate blocks: <del className="text-red-600">{b.separateMin} min</del>
                        </span>
                        <span className="text-emerald-800 font-bold text-sm">
                          Joint block: {b.jointMin} min (Saves {b.savingsMin} min track possession)
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Collapsed Incompatible Combinations */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowIncompatible(!showIncompatible)}
                className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 transition-colors"
              >
                <span>Other combinations (cannot combine: {rejectedCombinations.length})</span>
                {showIncompatible ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showIncompatible && (
                <div className="p-4 bg-white divide-y divide-slate-100 text-xs space-y-2">
                  {rejectedCombinations.map((r, i) => (
                    <div key={i} className="pt-2 first:pt-0 flex items-center justify-between text-slate-600">
                      <span className="font-bold text-slate-800">{r.pair}</span>
                      <span className="text-slate-500 italic">{r.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stepper Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#173F7A] hover:bg-[#123262] text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                Continue to Available Windows
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 4: AVAILABLE BLOCK WINDOWS
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 4 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-[#173F7A] text-xs font-bold uppercase tracking-wider">
                STEP 4
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">Available Block Windows</h2>
              <p className="text-xs text-slate-500">
                Candidate line possession windows computed from train timetable headways on {selectedDate}.
              </p>
            </div>

            <div className="space-y-3">
              {candidateWindows.map((win, idx) => (
                <div
                  key={win.id}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {idx + 1}. {win.timeSpan}
                      </span>
                      <span className="px-2 py-0.5 rounded font-mono font-bold bg-blue-100 text-blue-900">
                        {win.durationMin} min
                      </span>
                      <span className="px-2 py-0.5 rounded font-bold bg-slate-200 text-slate-800">
                        {win.line}
                      </span>
                      <span className="text-slate-500">({win.section})</span>
                    </div>
                    <p className={`font-semibold ${win.affectedTrains === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {win.affectedTrainsDesc}
                    </p>
                  </div>

                  <div>
                    <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                      win.badgeColor === 'emerald'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : win.badgeColor === 'amber'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {win.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Stepper Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => setStep(5)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#173F7A] hover:bg-[#123262] text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                Proceed to Plan Generation
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 5: GENERATE PLANS
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 5 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-[#173F7A] text-xs font-bold uppercase tracking-wider">
                STEP 5
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">Generate Optimized Plans</h2>
              <p className="text-xs text-slate-500">
                Mathematical CP-SAT solver evaluates all inputs simultaneously to synthesize conflict-free joint block schedules.
              </p>
            </div>

            {/* Solver Input Summary Card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Optimization Input Bundle</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="text-slate-500 block">Selected Tasks</span>
                  <strong className="text-sm font-bold text-slate-900">{selectedTaskIds.length}</strong>
                </div>
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="text-slate-500 block">Coordinated Bundles</span>
                  <strong className="text-sm font-bold text-emerald-700">{coordinationBundles.length} Bundles</strong>
                </div>
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="text-slate-500 block">Candidate Windows</span>
                  <strong className="text-sm font-bold text-[#173F7A]">{candidateWindows.length} Windows</strong>
                </div>
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="text-slate-500 block">Corridor Sections</span>
                  <strong className="text-sm font-bold text-slate-900">5 Sections (14.8 km)</strong>
                </div>
              </div>
            </div>

            {genError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{genError}</span>
              </div>
            )}

            {/* Launch Action */}
            <div className="p-6 bg-blue-50/50 border border-blue-200 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
              <Sparkles className="w-8 h-8 text-[#173F7A]" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Ready to Synthesize Block Plans</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Google OR-Tools CP-SAT will evaluate work co-location, safety isolations, and train headways to generate Plan A (Recommended), Plan B, and Plan C.
                </p>
              </div>

              <button
                disabled={isGenerating}
                onClick={handleGeneratePlan}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#173F7A] hover:bg-[#123262] text-white text-sm font-bold rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Solving CP-SAT Joint Block Optimization...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Optimized Plans
                  </>
                )}
              </button>
            </div>

            {/* Stepper Back Button */}
            <div className="flex items-center justify-start pt-2">
              <button
                disabled={isGenerating}
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Available Windows
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
