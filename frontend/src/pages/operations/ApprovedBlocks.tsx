import { useState, useEffect } from 'react';
import TopBar from '../../components/TopBar';
import WorkflowBar from '../../components/WorkflowBar';
import { usePlanning } from '../../context/PlanningContext';
import {
  getAllApprovedBlocks,
  updateBlockOperationalStatus,
  type ApprovedBlockItem,
} from '../../lib/apiClient';
import {
  CheckSquare,
  Play,
  CheckCircle2,
  FileText,
  Search,
  ShieldCheck,
  Wrench,
  Shield,
  Check,
  RefreshCw,
} from 'lucide-react';

export default function ApprovedBlocks() {
  const { setWorkflowStage, refreshAll } = usePlanning();
  const [approvedBlocks, setApprovedBlocks] = useState<ApprovedBlockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const loadApproved = async () => {
    setLoading(true);
    try {
      const data = await getAllApprovedBlocks();
      setApprovedBlocks(data || []);
    } catch (err) {
      console.error('Failed loading approved blocks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setWorkflowStage(6);
    loadApproved();
  }, [setWorkflowStage]);

  const handleTakePossession = async (b: ApprovedBlockItem) => {
    const id = b.block_id || b.id || b.block_code;
    try {
      await updateBlockOperationalStatus(id, 'in_progress', 'Line possession taken by work gangs with safety staff posted.');
      setToast(`Possession active for ${b.section_name} (${b.track_line} Line). Status: In Progress`);
      await loadApproved();
      await refreshAll();
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      alert(`Error updating possession: ${err.message || err}`);
    }
  };

  const handleCompleteBlock = async (b: ApprovedBlockItem) => {
    const id = b.block_id || b.id || b.block_code;
    try {
      await updateBlockOperationalStatus(id, 'completed', 'Certified track fit for normal train traffic.');
      setToast(`Possession completed on ${b.section_name}. Track handed back to traffic master.`);
      await loadApproved();
      await refreshAll();
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      alert(`Error completing block: ${err.message || err}`);
    }
  };

  const filtered = approvedBlocks.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const id = (b.block_id || b.id || b.block_code || '').toLowerCase();
    return (
      id.includes(q) ||
      b.section_name.toLowerCase().includes(q) ||
      b.track_line.toLowerCase().includes(q) ||
      b.tasks?.some((t) => t.task_code.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F6F8FB] text-[#172033]">
      <TopBar title="Approved Blocks" subtitle="Operational Block Register & Live Possession Tracking" />
      <WorkflowBar activeStage={6} />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Header & Print Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#D9E1EA] shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-[#172033] flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[#173F7A]" />
              <span>Operational Block Register</span>
            </h1>
            <p className="text-xs text-[#667085] mt-1">
              Sanctioned engineering possessions, live execution tracking, and track fitness handovers.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadApproved}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors border border-[#D9E1EA] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#173F7A] ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Print Register Circular</span>
            </button>
          </div>
        </div>

        {toast && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {/* Search Bar */}
        <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#D9E1EA] shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by block ID, section, task..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#172033] focus:outline-none focus:border-[#173F7A]"
            />
          </div>

          <div className="text-xs text-[#667085] font-mono">
            Total Sanctioned Blocks: <strong className="text-[#172033]">{approvedBlocks.length}</strong>
          </div>
        </div>

        {/* ── APPROVED BLOCKS LIST (Format specified in Section 11) ── */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-[#D9E1EA] rounded-xl p-12 text-center text-xs text-[#667085] shadow-xs">
            {loading
              ? 'Loading approved blocks...'
              : 'No approved blocks currently in register. Use Proposed Plans to review and approve an operational plan.'}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((b) => {
              const execStatus = b.execution_status || 'approved';
              const blockId = b.block_id || b.block_code || b.id;
              const dateDisplay = b.date_fmt || (b.block_start ? new Date(b.block_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '24 Sep');
              const startFmt = b.start_time_fmt || b.block_start?.slice(11, 16);
              const endFmt = b.end_time_fmt || b.block_end?.slice(11, 16);

              return (
                <div
                  key={blockId}
                  className="bg-white border border-[#D9E1EA] hover:border-[#173F7A]/40 rounded-xl p-5 shadow-xs transition-all space-y-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#EDF2F7]">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm text-[#173F7A] bg-[#EBF2FA] px-3 py-1 rounded-md border border-[#D9E1EA]">
                        {blockId}
                      </span>
                      <div>
                        <div className="font-bold text-base text-[#172033] flex items-center gap-2">
                          <span>{b.section_name}</span>
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                            {b.track_line} Line
                          </span>
                        </div>
                        <div className="text-xs text-[#667085] font-mono mt-0.5">
                          {dateDisplay} • {startFmt}–{endFmt} ({b.duration_min} min)
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {execStatus === 'in_progress' ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5 animate-pulse">
                          <Play className="w-3 h-3 fill-amber-600 text-amber-600" />
                          IN PROGRESS
                        </span>
                      ) : execStatus === 'completed' ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          COMPLETED
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          APPROVED
                        </span>
                      )}

                      {/* Operational Execution Action Buttons */}
                      {execStatus === 'approved' && (
                        <button
                          type="button"
                          onClick={() => handleTakePossession(b)}
                          className="px-3.5 py-1.5 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Take Possession</span>
                        </button>
                      )}

                      {execStatus === 'in_progress' && (
                        <button
                          type="button"
                          onClick={() => handleCompleteBlock(b)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Complete & Restore Track</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Task & Protection Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Tasks */}
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 space-y-2">
                      <div className="font-bold text-[#173F7A] font-mono text-[11px] uppercase flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Included Tasks ({b.tasks?.length || 0})</span>
                      </div>
                      <div className="space-y-1.5">
                        {b.tasks?.map((t) => (
                          <div
                            key={t.id}
                            className="bg-white p-2 rounded border border-[#E2E8F0] flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#172033]">{t.task_code}</span>
                              <span className="text-[#475569]">{t.maintenance_type || (t as any).work_type}</span>
                            </div>
                            <div className="flex items-center gap-2 font-mono text-[11px] text-[#64748B]">
                              <span>{t.location_display || ((t as any).km_start ? `KM ${(t as any).km_start}–${(t as any).km_end}` : '')}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EBF2FA] text-[#173F7A]">
                                {t.department}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Protection & Safety Details */}
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 space-y-2">
                      <div className="font-bold text-[#173F7A] font-mono text-[11px] uppercase flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" />
                        <span>Sanctioned Protection</span>
                      </div>
                      <div className="space-y-2">
                        <div className="bg-white p-2 rounded border border-[#E2E8F0]">
                          <div className="font-semibold text-[#172033]">Applied Protections:</div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {b.protections?.map((p, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>

                        {(b.approval_note || b.handover_notes) && (
                          <div className="bg-white p-2 rounded border border-[#E2E8F0] text-[#64748B] text-[11px]">
                            <strong>Log Note:</strong> {b.approval_note || b.handover_notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
