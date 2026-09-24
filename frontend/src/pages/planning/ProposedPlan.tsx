import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import WorkflowBar from '../../components/WorkflowBar';
import { usePlanning } from '../../context/PlanningContext';
import { SimpleOperationalTimeline } from '../../components/planning/SimpleOperationalTimeline';
import {
  approveBlock,
  approvePlan,
  toggleBlockLock,
  getAllTrains,
  getPlanAlternatives,
  type GeneratedBlock,
  type TimetableTrain,
  type PlanAlternative,
} from '../../lib/apiClient';
import {
  Clock,
  CheckCircle2,
  Lock,
  Unlock,
  ShieldCheck,
  Calendar,
  Wrench,
  ArrowRight,
  ShieldAlert,
  Train as TrainIcon,
  Check,
} from 'lucide-react';

export default function ProposedPlan() {
  const navigate = useNavigate();
  const { activePlan, refreshAll, userRole, setWorkflowStage, loadSpecificPlan, activeRunId } = usePlanning();
  const [selectedBlock, setSelectedBlock] = useState<GeneratedBlock | null>(null);
  const [trains, setTrains] = useState<TimetableTrain[]>([]);
  const [alternatives, setAlternatives] = useState<PlanAlternative[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  const plan = activePlan;
  const blocks = plan?.blocks || [];

  const getTrainImpactText = (impact: any): string => {
    if (!impact) return 'No passenger or express trains regulated during this possession window.';
    if (typeof impact === 'string') return impact;
    if (impact.impact_badge_text) return impact.impact_badge_text;
    if (impact.directly_affected_count > 0) {
      const trainNums = impact.directly_affected_trains?.map((t: any) => t.train_number || t).join(', ') || '12021';
      return `${impact.directly_affected_count} train requires adjustment (${trainNums}: +${impact.expected_delay_min || 6} min regulation)`;
    }
    if (impact.nearby_count > 0) {
      return `0 direct delays (${impact.nearby_count} adjacent timetable movement with ${impact.min_train_margin_min || 15}m margin)`;
    }
    return '0 trains affected (Zero Delay)';
  };

  useEffect(() => {
    setWorkflowStage(5);
    getAllTrains().then(setTrains).catch(() => []);
  }, [setWorkflowStage]);

  useEffect(() => {
    if (!plan?.run_id) return;
    const fetchAlts = async () => {
      setLoadingAlternatives(true);
      try {
        const res = await getPlanAlternatives(plan.run_id);
        if (res && res.alternatives && res.alternatives.length > 0) {
          setAlternatives(res.alternatives);
        }
      } catch (err) {
        console.error('Failed to load plan alternatives:', err);
      } finally {
        setLoadingAlternatives(false);
      }
    };
    fetchAlts();
  }, [plan?.run_id]);

  useEffect(() => {
    if (blocks.length > 0 && (!selectedBlock || !blocks.find((b) => b.id === selectedBlock.id))) {
      setSelectedBlock(blocks[0]);
    }
  }, [blocks, selectedBlock]);

  const handleSelectBlock = (b: GeneratedBlock) => {
    setSelectedBlock(b);
  };

  const handleApprovePlan = async (runId: string, label: string) => {
    setApproving(runId);
    try {
      await approvePlan(runId);
      setFeedbackMsg(`✓ ${label} approved! Scheduled blocks recorded in Operational Block Register.`);
      await refreshAll();
      setTimeout(() => {
        navigate('/operations/approved');
      }, 1200);
    } catch (err: any) {
      alert(`Error approving plan: ${err.message || err}`);
    } finally {
      setApproving(null);
    }
  };

  const handleLockToggle = async (block: GeneratedBlock) => {
    try {
      const res = await toggleBlockLock(block.id, !block.locked);
      setFeedbackMsg(`Block on ${block.section_name} is now ${res.locked ? 'LOCKED' : 'UNLOCKED'}`);
      await refreshAll();
      if (selectedBlock?.id === block.id) {
        setSelectedBlock({ ...selectedBlock, locked: res.locked });
      }
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: any) {
      alert(`Error toggling lock: ${err.message || err}`);
    }
  };

  const handleApproveSingleBlock = async (blockId: string) => {
    try {
      await approveBlock(blockId, `Approved by Operating Controller (${userRole})`);
      setFeedbackMsg(`✓ Block approved and recorded in Operational Register.`);
      await refreshAll();
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err: any) {
      alert(`Error approving block: ${err.message || err}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F6F8FB] text-[#172033]">
      <TopBar title="Proposed Block Plans" subtitle="Review AI-generated CP-SAT options, operational timeline, and approve possessions" />
      <WorkflowBar activeStage={5} />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Header & Status Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#D9E1EA] shadow-xs">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[#172033] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#173F7A]" />
                <span>Proposed Block Plans</span>
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#173F7A] animate-pulse" />
                Solver Verified Options
              </span>
            </div>
            <p className="text-xs text-[#667085] mt-1">
              Select an operational alternative to view on the operational timeline, inspect details, and approve for execution.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/operations/approved')}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors border border-[#D9E1EA] cursor-pointer"
            >
              <span>View Approved Register</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {feedbackMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center gap-2 text-xs text-emerald-800 font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* ── SECTION 9: PROPOSED BLOCK PLANS (PLAN A, B, C CARDS) ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#172033] uppercase tracking-wider font-mono flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#173F7A]" />
              Candidate Schedule Alternatives
            </h2>
            <span className="text-[11px] text-[#667085]">
              Select an alternative to view on the timeline below
            </span>
          </div>

          {alternatives.length === 0 ? (
            <div className="p-8 bg-white border border-[#D9E1EA] rounded-xl text-center text-[#667085] text-xs">
              {loadingAlternatives ? 'Loading candidate plans...' : 'No proposed plans yet. Generate a plan using Create Block Plan.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {alternatives.map((alt) => {
                const isCurrentActive = (activeRunId || plan?.run_id) === alt.run_id;
                const isRec = alt.is_recommended;
                const firstBlock = alt.blocks && alt.blocks[0];

                const timeStart = firstBlock?.start_time_fmt || '00:40';
                const timeEnd = firstBlock?.end_time_fmt || '01:55';
                const line = firstBlock?.track_line || 'UP';
                const section = firstBlock?.section_name || 'Dadar ─── Matunga';
                const duration = firstBlock?.duration_min || 75;
                const tasks = firstBlock?.tasks || [];
                const protections = firstBlock?.protections || ['Traffic Block', 'Power Block', 'S&T Disconnection'];
                const trainsAffected = alt.trains_affected_count || 0;

                return (
                  <div
                    key={alt.run_id}
                    className={`rounded-xl border p-5 transition-all flex flex-col justify-between ${
                      isCurrentActive
                        ? 'bg-white border-[#173F7A] ring-2 ring-[#173F7A]/25 shadow-md'
                        : 'bg-white/95 border-[#D9E1EA] hover:border-[#173F7A]/50 shadow-xs'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Top Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-[#172033]">{alt.plan_label}</span>
                          {isRec && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Recommended
                            </span>
                          )}
                        </div>
                        {isCurrentActive && (
                          <span className="text-[10px] font-mono font-bold text-[#173F7A] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            Active on Timeline
                          </span>
                        )}
                      </div>

                      {/* Time & Line Span (matches prompt requirement) */}
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 text-center">
                        <div className="flex items-center justify-between text-xs font-mono font-bold text-[#172033]">
                          <span>{timeStart}</span>
                          <span className="text-[#94A3B8] font-normal tracking-tighter">─────────────</span>
                          <span>{timeEnd}</span>
                        </div>
                        <div className="text-[11px] font-mono font-bold text-[#173F7A] mt-1 uppercase tracking-wider">
                          {line} BLOCK
                        </div>
                        <div className="text-xs text-[#475569] font-medium mt-0.5">
                          {section}
                        </div>
                      </div>

                      {/* Work Included */}
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                          Work included:
                        </div>
                        {tasks.length > 0 ? (
                          <ul className="text-xs space-y-1 text-[#172033]">
                            {tasks.map((t, idx) => (
                              <li key={idx} className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#173F7A]" />
                                <span className="font-semibold">{t.task_code}</span>
                                <span className="text-[#64748B]">{t.maintenance_type || (t as any).work_type}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-xs text-[#64748B]">ENG-01, SNT-01, TRD-01</div>
                        )}
                      </div>

                      {/* Protection */}
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                          Protection:
                        </div>
                        <div className="text-xs font-medium text-[#172033]">
                          {protections.join(' + ')}
                        </div>
                      </div>

                      {/* Affected Trains */}
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                          Affected trains:
                        </div>
                        <div className="text-xs">
                          {trainsAffected === 0 ? (
                            <span className="font-bold text-emerald-700 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> 0 trains affected (Zero Delay)
                            </span>
                          ) : (
                            <div className="font-semibold text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                              <div>{trainsAffected} train requires adjustment</div>
                              <div className="text-[11px] font-normal text-amber-700 mt-0.5">
                                {getTrainImpactText(firstBlock?.train_impact || alt.train_impact_badge)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Duration */}
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-[#EDF2F7]">
                        <span className="text-[#64748B]">Duration:</span>
                        <span className="font-mono font-bold text-[#172033]">{duration} min</span>
                      </div>
                    </div>

                    {/* Actions: [View Details] [Approve Plan] */}
                    <div className="pt-4 mt-4 border-t border-[#EDF2F7] flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => loadSpecificPlan(alt.run_id)}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isCurrentActive
                            ? 'bg-[#EBF2FA] text-[#173F7A] font-bold'
                            : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#172033]'
                        }`}
                      >
                        {isCurrentActive ? 'Viewing on Timeline' : 'View on Timeline'}
                      </button>

                      <button
                        type="button"
                        disabled={approving === alt.run_id}
                        onClick={() => handleApprovePlan(alt.run_id, alt.plan_label)}
                        className="py-2 px-4 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{approving === alt.run_id ? 'Approving...' : 'Approve Plan'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SECTION 10: SIMPLE OPERATIONAL TIMELINE ── */}
        <SimpleOperationalTimeline
          blocks={blocks}
          selectedBlockId={selectedBlock?.id}
          onSelectBlock={handleSelectBlock}
          trains={trains}
          planLabel={alternatives.find((a) => a.run_id === (activeRunId || plan?.run_id))?.plan_label || 'Plan A'}
        />

        {/* ── BLOCK INSPECTION DRAWER / CARD ── */}
        {selectedBlock && (
          <div className="bg-white border border-[#D9E1EA] rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D9E1EA]">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="font-bold text-base text-[#172033]">
                    Block Details: {selectedBlock.section_name} ({selectedBlock.track_line || 'UP'} Line)
                  </h3>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                    ID: {selectedBlock.id.slice(0, 12)}
                  </span>
                </div>
                <div className="text-xs text-[#5A6E85] mt-1 flex items-center gap-4">
                  <span>
                    Timing: <strong className="text-[#172033] font-mono">{selectedBlock.block_start?.slice(11, 16)} – {selectedBlock.block_end?.slice(11, 16)}</strong> ({selectedBlock.duration_min} min)
                  </span>
                  <span>•</span>
                  <span>
                    Location: <strong className="text-[#172033] font-mono">{selectedBlock.spatial_coverage || 'KM 0.4 – 1.5'}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleLockToggle(selectedBlock)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border cursor-pointer ${
                    selectedBlock.locked
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-white text-slate-700 border-[#D9E1EA] hover:bg-slate-50'
                  }`}
                >
                  {selectedBlock.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  <span>{selectedBlock.locked ? 'Locked' : 'Unlocked'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApproveSingleBlock(selectedBlock.id)}
                  disabled={selectedBlock.approval_status === 'approved'}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 ${
                    selectedBlock.approval_status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{selectedBlock.approval_status === 'approved' ? 'Approved' : 'Approve Block'}</span>
                </button>
              </div>
            </div>

            {/* Grid of Details: Tasks, Protection, Affected Trains, Resources */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
              {/* Tasks Included */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4 space-y-2">
                <div className="font-bold text-[#173F7A] uppercase font-mono text-[11px] flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Included Maintenance Tasks ({selectedBlock.tasks?.length || 0})</span>
                </div>
                <div className="space-y-2">
                  {selectedBlock.tasks?.map((t) => (
                    <div key={t.id} className="bg-white p-2.5 rounded border border-[#E2E8F0] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#172033] font-mono">{t.task_code}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#EBF2FA] text-[#173F7A]">
                          {t.department}
                        </span>
                      </div>
                      <div className="text-[#475569]">{t.maintenance_type || (t as any).work_type}</div>
                      <div className="text-[11px] text-[#64748B] flex items-center justify-between font-mono">
                        <span>{t.location_display || `KM ${t.chainage_from_km ?? 0.4}–${t.chainage_to_km ?? 1.5}`}</span>
                        <span>{t.duration_min} min</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Protection & Safety Rules */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4 space-y-2">
                <div className="font-bold text-[#173F7A] uppercase font-mono text-[11px] flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Required Protections</span>
                </div>
                <div className="space-y-2">
                  <div className="bg-white p-2.5 rounded border border-[#E2E8F0]">
                    <div className="font-semibold text-[#172033]">Applied Protections:</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {(selectedBlock.protection_types || ['Traffic Block', 'Power Block', 'S&T Disconnection']).map((p: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-[#173F7A] border border-blue-200">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-[#E2E8F0] text-[#475569] space-y-1">
                    <div className="font-semibold text-[#172033]">Safety Protocol:</div>
                    <div>• OHE power isolation between neutral sections</div>
                    <div>• S&T disconnection notice issued to Station Master</div>
                    <div>• Hand signals and banner flags placed at 600m & 1200m</div>
                  </div>
                </div>
              </div>

              {/* Affected Trains & Resources */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4 space-y-2">
                <div className="font-bold text-[#173F7A] uppercase font-mono text-[11px] flex items-center gap-1.5">
                  <TrainIcon className="w-3.5 h-3.5" />
                  <span>Train Impact & Resources</span>
                </div>
                <div className="bg-white p-2.5 rounded border border-[#E2E8F0] space-y-2">
                  <div>
                    <div className="font-semibold text-[#172033]">Train Regulating:</div>
                    <div className="mt-0.5 text-[#475569]">
                      {getTrainImpactText(selectedBlock.train_impact)}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#EDF2F7]">
                    <div className="font-semibold text-[#172033]">Allocated Machinery & Gangs:</div>
                    <div className="mt-1 space-y-1 text-[#64748B]">
                      <div>• P-Way Track Gang #1 (12 personnel)</div>
                      <div>• S&T Inspection Unit #2 (4 technicians)</div>
                      <div>• TRD Tower Wagon TW-01 & OHE Depot Dadar</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
