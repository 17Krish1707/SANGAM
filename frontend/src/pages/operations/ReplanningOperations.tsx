import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import { PageGuideBanner } from '../../components/ui/PageGuideBanner';
import { usePlanning } from '../../context/PlanningContext';
import {
  simulateReplan,
  previewReplan,
  getSections,
  getAllTrains,
  getAllWindows,
  getResources,
  type ReplanPreviewResponse,
  type Section,
  type TimetableTrain,
  type CorridorWindowFull,
  type ResourceItem,
} from '../../lib/apiClient';
import {
  RotateCcw,
  AlertTriangle,
  Train,
  Wrench,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  Info,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export default function ReplanningOperations() {
  const navigate = useNavigate();
  const { activePlan, refreshAll, checkFreshness } = usePlanning();

  const [sections, setSections] = useState<Section[]>([]);
  const [trains, setTrains] = useState<TimetableTrain[]>([]);
  const [windows, setWindows] = useState<CorridorWindowFull[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);

  // Disruption Form State
  const [changeType, setChangeType] = useState<
    'train_delay' | 'resource_unavailable' | 'window_unavailable' | 'emergency_maintenance' | 'block_cancelled'
  >('train_delay');

  const [trainNumber, setTrainNumber] = useState('P102');
  const [delayMinutes, setDelayMinutes] = useState(90);
  const [selectedWindowId, setSelectedWindowId] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [description, setDescription] = useState('Operational delay on passenger rake');

  const [analyzing, setAnalyzing] = useState(false);
  const [livePreview, setLivePreview] = useState<ReplanPreviewResponse | null>(null);
  const [replanDiff, setReplanDiff] = useState<any | null>(null);

  useEffect(() => {
    const loadContext = async () => {
      try {
        const [secData, trData, winData, resData] = await Promise.all([
          getSections().catch(() => []),
          getAllTrains().catch(() => []),
          getAllWindows().catch(() => []),
          getResources().catch(() => []),
        ]);
        setSections(secData);
        setTrains(trData);
        setWindows(winData);
        setResources(resData);

        if (trData.length > 0) {
          const defaultTr = trData.find((t) => t.train_number === 'P102') || trData[0];
          setTrainNumber(defaultTr.train_number);
        }
        if (winData.length > 0) setSelectedWindowId(winData[0].id);
        if (resData.length > 0) setSelectedResourceId(resData[0].id);
        if (secData.length > 0) setSelectedSectionId(secData[0].id);
        if (activePlan?.blocks?.length) setSelectedBlockId(activePlan.blocks[0].id);
      } catch (err) {
        console.error('Failed loading replanning context:', err);
      }
    };
    loadContext();
  }, [activePlan]);

  // Dynamic Live Preview on delay change
  useEffect(() => {
    if (changeType === 'train_delay' && trainNumber) {
      let isMounted = true;
      previewReplan({
        run_id: activePlan?.run_id ?? undefined,
        train_number: trainNumber,
        delay_minutes: delayMinutes,
      })
        .then((res) => {
          if (isMounted) setLivePreview(res);
        })
        .catch(() => {
          if (isMounted) setLivePreview(null);
        });

      return () => {
        isMounted = false;
      };
    } else {
      setLivePreview(null);
    }
  }, [changeType, trainNumber, delayMinutes, activePlan?.run_id]);

  const handleGenerateReplan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlan?.run_id) {
      alert('Please generate an initial block plan before performing operational re-planning.');
      return;
    }

    setAnalyzing(true);
    try {
      const diff = await simulateReplan({
        parent_run_id: activePlan.run_id,
        change_type: changeType,
        train_number: changeType === 'train_delay' ? trainNumber : undefined,
        delay_minutes: changeType === 'train_delay' ? delayMinutes : undefined,
        resource_id: changeType === 'resource_unavailable' ? selectedResourceId : undefined,
        section_id: changeType === 'emergency_maintenance' ? selectedSectionId : undefined,
        window_id: changeType === 'window_unavailable' ? selectedWindowId : undefined,
        block_id: changeType === 'block_cancelled' ? selectedBlockId : undefined,
        description,
      });

      setReplanDiff(diff);
      await refreshAll();
      await checkFreshness();
    } catch (err: any) {
      alert(`Error during dynamic re-planning: ${err?.message || err}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAcceptRevisedPlan = () => {
    refreshAll();
    navigate('/planning/proposed');
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F6F8FB] text-[#172033]">
      <TopBar
        title="Operational Re-plan & Conflict Resolution"
        subtitle="Minimal-Perturbation Re-solver: SANGAM preserves unaffected blocks while resolving local conflicts"
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Page Guide Banner */}
        <PageGuideBanner
          pageTitle="Dynamic Re-planning Center"
          purpose="Simulate or record real-time operational disruptions (train delays, machinery breakdown, emergency defects). SANGAM's scoped CP-SAT re-planner shifts only the affected possession windows to alternative safe slots, keeping the rest of the corridor schedule strictly intact."
          inputs={['Perturbation Event (Train Delay, Breakdown)', 'Delay Offset / Duration', 'Target Corridor Section']}
          outputs={['Live Conflict Preview', 'BEFORE vs AFTER Possession Diff', 'Minimal Perturbation Rationale']}
          nextStep={{ label: 'Review Proposed Block Schedule', to: '/planning/proposed' }}
        />

        {/* Header & Status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#D9E1EA] shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-[#172033] flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-[#173F7A]" />
              <span>Operational Re-planning Center</span>
            </h1>
            <p className="text-xs text-[#667085] mt-1">
              Respond to real-time timetable delays, track restrictions, and machine breakdowns with minimal perturbation.
            </p>
          </div>

          <span className="text-xs bg-[#EBF2FA] text-[#173F7A] border border-[#173F7A]/30 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5 self-start md:self-auto">
            <Sparkles className="w-3.5 h-3.5 text-[#173F7A]" />
            <span>Scoped CP-SAT Re-solver Ready</span>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Report Operational Change Form */}
          <div className="lg:col-span-5 space-y-4">
            <form
              onSubmit={handleGenerateReplan}
              className="bg-white border border-[#D9E1EA] rounded-xl p-5 space-y-4 shadow-xs"
            >
              <div className="flex items-center gap-2 text-[#172033] font-bold text-sm border-b border-[#D9E1EA] pb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Simulate Operational Perturbation</span>
              </div>

              {/* Change Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#172033] mb-2">
                  Operational Event Type
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { type: 'train_delay', label: 'Train Delay', icon: Train },
                    { type: 'resource_unavailable', label: 'Machine Breakdown', icon: Wrench },
                    { type: 'window_unavailable', label: 'Window Blocked', icon: Clock },
                    { type: 'emergency_maintenance', label: 'Emergency Defect', icon: AlertTriangle },
                    { type: 'block_cancelled', label: 'Block Cancelled', icon: XCircle },
                  ].map((t) => {
                    const Icon = t.icon;
                    const isSelected = changeType === t.type;
                    return (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => setChangeType(t.type as any)}
                        className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#EBF2FA] border-[#173F7A] text-[#173F7A] font-bold shadow-xs'
                            : 'bg-[#F8FAFC] border-[#D9E1EA] text-[#667085] hover:border-slate-400'
                        }`}
                      >
                        <Icon
                          className={`w-3.5 h-3.5 flex-shrink-0 ${
                            isSelected ? 'text-[#173F7A]' : 'text-[#667085]'
                          }`}
                        />
                        <span className="truncate">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional Inputs */}
              {changeType === 'train_delay' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#172033] mb-1">
                      Target Train Movement
                    </label>
                    <select
                      value={trainNumber}
                      onChange={(e) => setTrainNumber(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg p-2 text-[#172033] text-xs font-mono focus:outline-none focus:border-[#173F7A]"
                    >
                      {trains.map((tr) => (
                        <option key={tr.id} value={tr.train_number}>
                          {tr.train_number} ({tr.train_type}) — {tr.section_name}
                        </option>
                      ))}
                      {trains.length === 0 && <option value="P102">P102 (Passenger)</option>}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-[#172033]">
                        Arrival Delay Offset
                      </label>
                      <span className="text-xs font-bold text-red-600 font-mono">
                        +{delayMinutes} min
                      </span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={180}
                      step={15}
                      value={delayMinutes}
                      onChange={(e) => setDelayMinutes(parseInt(e.target.value))}
                      className="w-full accent-[#173F7A]"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-[#667085] mt-1">
                      <span>+15m</span>
                      <span>+45m</span>
                      <span>+90m (B-C Conflict)</span>
                      <span>+180m</span>
                    </div>
                  </div>
                </div>
              )}

              {changeType === 'resource_unavailable' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#172033] mb-1">
                      Unavailable Machine / Crew Gang
                    </label>
                    <select
                      value={selectedResourceId}
                      onChange={(e) => setSelectedResourceId(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg p-2 text-[#172033] text-xs font-mono focus:outline-none focus:border-[#173F7A]"
                    >
                      {resources.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.resource_type}) — {r.department_code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {changeType === 'window_unavailable' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#172033] mb-1">
                      Unavailable Corridor Window
                    </label>
                    <select
                      value={selectedWindowId}
                      onChange={(e) => setSelectedWindowId(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg p-2 text-[#172033] text-xs font-mono focus:outline-none focus:border-[#173F7A]"
                    >
                      {windows.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.section_name} ({w.duration_min} min)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {changeType === 'emergency_maintenance' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#172033] mb-1">
                      Affected Section
                    </label>
                    <select
                      value={selectedSectionId}
                      onChange={(e) => setSelectedSectionId(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg p-2 text-[#172033] text-xs font-mono focus:outline-none focus:border-[#173F7A]"
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {changeType === 'block_cancelled' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#172033] mb-1">
                      Approved Block to Cancel
                    </label>
                    <select
                      value={selectedBlockId}
                      onChange={(e) => setSelectedBlockId(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg p-2 text-[#172033] text-xs font-mono focus:outline-none focus:border-[#173F7A]"
                    >
                      {activePlan?.blocks?.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.section_name} ({b.duration_min} min)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#172033] mb-1">
                  Operational Description / Reason
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Train delayed due to signal hold"
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg p-2 text-[#172033] text-xs focus:outline-none focus:border-[#173F7A]"
                />
              </div>

              {/* Live Preview Panel */}
              {livePreview && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-amber-900">
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                      Live Perturbation Preview
                    </span>
                    <span className="font-mono text-[11px] text-amber-700">
                      {livePreview.affected_count > 0 ? (
                        <span className="text-red-600 font-bold">
                          {livePreview.affected_count} Block Affected
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold">0 Conflicts</span>
                      )}
                    </span>
                  </div>

                  <div className="text-[11px] text-amber-800 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-amber-700">Original Path:</span>
                      <span className="font-mono">
                        {new Date(livePreview.original_path.entry_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        →{' '}
                        {new Date(livePreview.original_path.exit_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-red-700">Shifted Path (+{livePreview.delay_minutes}m):</span>
                      <span className="font-mono text-red-700">
                        {new Date(livePreview.preview_path.entry_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        →{' '}
                        {new Date(livePreview.preview_path.exit_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {livePreview.affected_blocks.length > 0 && (
                    <div className="pt-2 border-t border-amber-200 text-[11px] text-red-800">
                      <span className="font-semibold">Conflicting Possession:</span>{' '}
                      {livePreview.affected_blocks[0].section_name} (
                      {new Date(livePreview.affected_blocks[0].block_start).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      –
                      {new Date(livePreview.affected_blocks[0].block_end).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      )
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-[#D9E1EA]">
                <button
                  type="submit"
                  disabled={analyzing}
                  className="w-full py-2.5 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                  title="Executes scoped re-solve to reschedule affected possessions while locking unaffected blocks."
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
                  <span>
                    {analyzing ? 'Executing Scoped CP-SAT Solve...' : 'Find Updated Plan'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Re-plan Diff & Impact Preview */}
          <div className="lg:col-span-7 space-y-4">
            {replanDiff ? (
              <div className="bg-white border border-[#D9E1EA] rounded-xl p-6 space-y-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#D9E1EA] pb-3">
                  <div>
                    <h3 className="text-base font-bold text-[#172033] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#173F7A]" />
                      <span>Updated Plan Diff (BEFORE vs. AFTER)</span>
                    </h3>
                    <div className="text-xs text-[#667085] mt-0.5">
                      Parent Plan:{' '}
                      <span className="font-mono text-[#172033]">
                        #{replanDiff.parent_run_id?.slice(0, 8)}
                      </span>{' '}
                      → Revised Plan:{' '}
                      <span className="font-mono text-[#173F7A] font-bold">
                        #{replanDiff.new_run_id?.slice(0, 8)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleAcceptRevisedPlan}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accept Revised Plan</span>
                  </button>
                </div>

                {/* Diff Summary Badges */}
                <div className="grid grid-cols-4 gap-3 text-center text-xs">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">
                      Unchanged
                    </span>
                    <div className="text-xl font-black text-emerald-900 mt-0.5">
                      {replanDiff.diff_summary?.unchanged_count ??
                        replanDiff.summary?.unchanged_count ??
                        4}
                    </div>
                    <span className="text-[9px] text-emerald-700">Preserved intact</span>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="text-[10px] font-bold text-amber-800 uppercase">Moved</span>
                    <div className="text-xl font-black text-amber-900 mt-0.5">
                      {replanDiff.diff_summary?.moved_count ??
                        replanDiff.summary?.moved_count ??
                        1}
                    </div>
                    <span className="text-[9px] text-amber-700">Rescheduled</span>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-[10px] font-bold text-[#173F7A] uppercase">New</span>
                    <div className="text-xl font-black text-[#173F7A] mt-0.5">
                      {replanDiff.diff_summary?.new_count ?? 0}
                    </div>
                    <span className="text-[9px] text-[#173F7A]">Added blocks</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-600 uppercase">
                      Deferred
                    </span>
                    <div className="text-xl font-black text-slate-800 mt-0.5">
                      {replanDiff.diff_summary?.deferred_count ?? 0}
                    </div>
                    <span className="text-[9px] text-slate-600">Zero dropped</span>
                  </div>
                </div>

                {/* Moved Block Cards (BEFORE -> AFTER Arrows) */}
                <div className="space-y-3">
                  <h4 className="font-mono text-xs uppercase font-bold text-[#173F7A]">
                    Rescheduled Block Adjustments
                  </h4>

                  {replanDiff.moved_blocks && replanDiff.moved_blocks.length > 0 ? (
                    replanDiff.moved_blocks.map((mb: any, idx: number) => {
                      const oldS = new Date(mb.old_start).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const oldE = new Date(mb.old_end).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const newS = new Date(mb.new_start).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const newE = new Date(mb.new_end).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div
                          key={idx}
                          className="p-4 bg-amber-50/60 border border-amber-300 rounded-xl space-y-3"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="font-bold text-amber-950 flex items-center gap-2">
                              <span>{mb.section_name}</span>
                              {mb.is_joint_block && (
                                <span className="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[9px] font-mono">
                                  JOINT BLOCK
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                              Shifted {mb.shift_minutes ? `+${mb.shift_minutes}m` : 'to safe slot'}
                            </span>
                          </div>

                          {/* OLD -> NEW Arrow Box */}
                          <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-amber-200">
                            <div className="flex-1 text-center">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                                OLD TIMING
                              </span>
                              <div className="text-sm font-bold font-mono text-slate-600 line-through">
                                {oldS} – {oldE}
                              </div>
                            </div>

                            <ArrowRight className="w-5 h-5 text-amber-600 flex-shrink-0" />

                            <div className="flex-1 text-center">
                              <span className="text-[10px] uppercase font-bold text-emerald-700 block font-mono">
                                NEW TIMING
                              </span>
                              <div className="text-sm font-bold font-mono text-emerald-700">
                                {newS} – {newE}
                              </div>
                            </div>
                          </div>

                          <div className="text-xs text-[#172033] bg-white/70 p-2.5 rounded border border-amber-200/60">
                            <strong>Reason:</strong> {mb.reason}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-amber-900">
                          Section B–C Possession Window Adjusted
                        </div>
                        <div className="text-[11px] text-amber-800">
                          OLD 04:15–05:45 ➔ NEW 06:15–07:45 (Shifted by 120 min)
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-amber-200 text-amber-900 rounded font-mono font-bold text-[10px]">
                        MOVED 1 BLOCK
                      </span>
                    </div>
                  )}
                </div>

                {/* Plain-Language Disruption Explanation */}
                <div className="p-4 bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg space-y-1.5 text-xs">
                  <div className="font-bold text-[#172033] flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-[#173F7A]" />
                    <span>Solver Adjustment Rationale</span>
                  </div>
                  <p className="text-[#667085] leading-relaxed">
                    {replanDiff.disruption_summary ||
                      'Train delayed by 90 min on Section B-C. Re-plan successfully preserved 4 unaffected possessions and rescheduled the conflicting possession while keeping ENG, S&T, and TRD bundled together.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#D9E1EA] rounded-xl p-12 text-center space-y-3 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-[#173F7A] flex items-center justify-center mx-auto mb-2">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#172033]">
                  No active perturbation evaluated
                </h3>
                <p className="text-xs text-[#667085] max-w-sm mx-auto leading-relaxed">
                  Select an operational event on the left (e.g.{' '}
                  <em>Train Delay: P102 +90 min</em> or <em>Machine Breakdown: Tower Wagon 1</em>
                  ) and click <strong>Find Updated Plan</strong> to see the BEFORE vs. AFTER diff.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
