import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import { PageGuideBanner } from '../../components/ui/PageGuideBanner';
import { usePlanning } from '../../context/PlanningContext';
import {
  simulateReplan,
  getSections,
  getAllTrains,
  getAllWindows,
  getResources,
  type ReplanDiffResponse,
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
  HelpCircle,
  Info,
} from 'lucide-react';

export default function ReplanningOperations() {
  const navigate = useNavigate();
  const { activePlan, refreshAll } = usePlanning();

  const [sections, setSections] = useState<Section[]>([]);
  const [trains, setTrains] = useState<TimetableTrain[]>([]);
  const [windows, setWindows] = useState<CorridorWindowFull[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);

  // Disruption Form State
  const [changeType, setChangeType] = useState<
    'train_delay' | 'window_unavailable' | 'resource_unavailable' | 'emergency_maintenance' | 'block_cancelled'
  >('train_delay');

  const [trainNumber, setTrainNumber] = useState('P102');
  const [delayMinutes, setDelayMinutes] = useState(60);
  const [selectedWindowId, setSelectedWindowId] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [description, setDescription] = useState('Operating train delay / asset constraint perturbation');

  const [analyzing, setAnalyzing] = useState(false);
  const [replanDiff, setReplanDiff] = useState<ReplanDiffResponse | null>(null);

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

        if (trData.length > 0) setTrainNumber(trData[0].train_number);
        if (winData.length > 0) setSelectedWindowId(winData[0].id);
        if (resData.length > 0) setSelectedResourceId(resData[0].id);
        if (secData.length > 0) setSelectedSectionId(secData[0].id);
        if (activePlan?.blocks.length) setSelectedBlockId(activePlan.blocks[0].id);
      } catch (err) {
        console.error('Failed loading replanning context:', err);
      }
    };
    loadContext();
  }, [activePlan]);

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
      <TopBar title="Operational Re-plan" subtitle="Dynamic Corridor Perturbation Management & Minimal-Perturbation Re-solver" />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Page Guide Banner */}
        <PageGuideBanner
          pageTitle="Operational Re-plan"
          purpose="Simulate or record operational disruptions such as train delays, machinery breakdowns, emergency defects, or cancelled possessions. SANGAM's differential re-planner re-optimizes affected work while preserving unaffected and locked blocks where possible."
          inputs={['Disruption Event Type', 'Delayed Train / Unavailable Resource', 'Duration of Delay / Outage', 'Operational Notes']}
          outputs={['Differential Schedule Diff (Unchanged / Moved / New / Deferred)', 'Solver Adjustment Rationale', 'Revised Block Schedule']}
          nextStep={{ label: 'Accept Revised Plan and Return to Proposed Plan', to: '/planning/proposed' }}
        />

        {/* Header & Status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#D9E1EA] shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-[#172033] flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-[#173F7A]" />
              <span>Dynamic Re-planning Center</span>
            </h1>
            <p className="text-xs text-[#667085] mt-1">
              Respond to real-time timetable delays, track restrictions, and machine breakdowns with minimal perturbation.
            </p>
          </div>

          <span className="text-xs bg-[#EBF2FA] text-[#173F7A] border border-[#173F7A]/30 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5 self-start md:self-auto">
            <Sparkles className="w-3.5 h-3.5 text-[#173F7A]" />
            <span>Differential Re-solver Active</span>
          </span>
        </div>

        {/* Operational Help Card */}
        <div className="p-4 bg-white rounded-lg border border-[#D9E1EA] shadow-xs flex items-start gap-3">
          <HelpCircle className="w-4 h-4 text-[#173F7A] flex-shrink-0 mt-0.5" />
          <div className="text-xs text-[#667085] leading-relaxed">
            <strong className="text-[#172033]">How SANGAM re-plans:</strong> Rather than re-optimizing everything from scratch and scrambling approved crew rosters, SANGAM locks non-affected possessions and only adjusts blocks directly in the perturbation path.
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Report Operational Change Form */}
          <div className="lg:col-span-5 space-y-4">
            <form onSubmit={handleGenerateReplan} className="bg-white border border-[#D9E1EA] rounded-xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 text-[#172033] font-bold text-sm border-b border-[#D9E1EA] pb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Report Operational Change</span>
              </div>

              {/* Change Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#172033] mb-2">Operational Event Type</label>
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
                        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-[#173F7A]' : 'text-[#667085]'}`} />
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
                    <label className="block text-xs font-semibold text-[#172033] mb-1">Delayed Train</label>
                    <select
                      value={trainNumber}
                      onChange={(e) => setTrainNumber(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] text-xs font-mono focus:outline-none focus:border-[#173F7A]"
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
                      <label className="text-xs font-semibold text-[#172033]">Arrival Delay (Minutes)</label>
                      <span className="text-xs font-bold text-amber-700 font-mono">+{delayMinutes} min</span>
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
                  </div>
                </div>
              )}

              {changeType === 'resource_unavailable' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#172033] mb-1">Unavailable Machine or Gang</label>
                    <select
                      value={selectedResourceId}
                      onChange={(e) => setSelectedResourceId(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] text-xs font-mono focus:outline-none focus:border-[#173F7A]"
                    >
                      {resources.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.resource_type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {changeType === 'window_unavailable' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#172033] mb-1">Unavailable Corridor Window</label>
                    <select
                      value={selectedWindowId}
                      onChange={(e) => setSelectedWindowId(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] text-xs font-mono focus:outline-none focus:border-[#173F7A]"
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
                    <label className="block text-xs font-semibold text-[#172033] mb-1">Affected Section</label>
                    <select
                      value={selectedSectionId}
                      onChange={(e) => setSelectedSectionId(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] text-xs font-mono focus:outline-none focus:border-[#173F7A]"
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {changeType === 'block_cancelled' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#172033] mb-1">Approved Block to Cancel</label>
                    <select
                      value={selectedBlockId}
                      onChange={(e) => setSelectedBlockId(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] text-xs font-mono focus:outline-none focus:border-[#173F7A]"
                    >
                      {activePlan?.blocks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.section_name} ({b.duration_min} min)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#172033] mb-1">Operational Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Train delayed due to signal hold"
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] text-xs focus:outline-none focus:border-[#173F7A]"
                />
              </div>

              <div className="pt-2 border-t border-[#D9E1EA]">
                <button
                  type="submit"
                  disabled={analyzing}
                  className="w-full py-2.5 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                  title="Re-optimizes affected work while preserving unaffected/locked blocks where possible."
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
                  <span>{analyzing ? 'Evaluating Disruption Impact...' : 'Generate Revised Plan'}</span>
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
                      <span>Differential Schedule Comparison</span>
                    </h3>
                    <div className="text-xs text-[#667085] mt-0.5">
                      Parent Plan: <span className="font-mono text-[#172033]">#{replanDiff.parent_run_id?.slice(0, 8)}</span> → Revised Plan: <span className="font-mono text-[#173F7A] font-bold">#{replanDiff.new_run_id?.slice(0, 8)}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleAcceptRevisedPlan}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accept Revised Plan</span>
                  </button>
                </div>

                {/* Diff Summary Badges */}
                <div className="grid grid-cols-4 gap-3 text-center text-xs">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Unchanged</span>
                    <div className="text-lg font-bold text-emerald-900 mt-0.5">{replanDiff.summary.unchanged_count}</div>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="text-[10px] font-bold text-amber-800 uppercase">Moved</span>
                    <div className="text-lg font-bold text-amber-900 mt-0.5">{replanDiff.summary.moved_count}</div>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-[10px] font-bold text-[#173F7A] uppercase">New Slots</span>
                    <div className="text-lg font-bold text-[#173F7A] mt-0.5">{replanDiff.summary.new_count}</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-600 uppercase">Deferred</span>
                    <div className="text-lg font-bold text-slate-800 mt-0.5">{replanDiff.summary.deferred_count}</div>
                  </div>
                </div>

                {/* Plain-Language Disruption Explanation */}
                <div className="p-4 bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg space-y-2 text-xs">
                  <div className="font-bold text-[#172033] flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-[#173F7A]" />
                    <span>Solver Adjustment Rationale</span>
                  </div>
                  <p className="text-[#667085] leading-relaxed">
                    {replanDiff.disruption_summary}
                  </p>
                </div>

                {/* Status breakdown items */}
                <div className="space-y-2 text-xs">
                  <h4 className="font-mono text-[10px] uppercase font-bold text-[#173F7A]">
                    Perturbation Cascade Breakdown
                  </h4>

                  {replanDiff.summary.moved_count > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <div>
                          <span className="font-bold text-amber-900">Block Possession Adjusted</span>
                          <div className="text-[11px] text-amber-800">
                            Possession adjusted to respect safety clearance with updated timetable movements.
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[10px] font-bold">
                        MOVED
                      </span>
                    </div>
                  )}

                  {replanDiff.summary.unchanged_count > 0 && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <div>
                          <span className="font-bold text-emerald-900">
                            {replanDiff.summary.unchanged_count} Possession{replanDiff.summary.unchanged_count > 1 ? 's' : ''} Maintained Intact
                          </span>
                          <div className="text-[11px] text-emerald-800">
                            Gangs and machinery on independent corridor sections proceed without disruption.
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                        UNCHANGED
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#D9E1EA] rounded-xl p-12 text-center space-y-3 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-[#173F7A] flex items-center justify-center mx-auto mb-2">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#172033]">No active disruption simulation</h3>
                <p className="text-xs text-[#667085] max-w-sm mx-auto leading-relaxed">
                  Select an operational event on the left (e.g. <em>Train Delay: P102 +60 min</em> or <em>Machine Breakdown</em>) and click <strong>Generate Revised Plan</strong> to compute cascading impacts.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
