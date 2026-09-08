import { useState, useEffect } from 'react';
import TopBar from '../../components/TopBar';
import WorkflowBar from '../../components/WorkflowBar';
import { PageGuideBanner } from '../../components/ui/PageGuideBanner';
import { usePlanning } from '../../context/PlanningContext';
import {
  type GeneratedBlock,
  updateBlockOperationalStatus,
} from '../../lib/apiClient';
import {
  CheckSquare,
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  X,
  Search,
} from 'lucide-react';

export default function ApprovedBlocks() {
  const { activePlan, refreshAll, setWorkflowStage } = usePlanning();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  // Modals
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completingBlock, setCompletingBlock] = useState<GeneratedBlock | null>(null);
  const [completeNote, setCompleteNote] = useState('Certified track fit for normal train operations at maximum permissible speed.');
  const [completionTime, setCompletionTime] = useState(new Date().toISOString().slice(0, 16));

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingBlock, setCancellingBlock] = useState<GeneratedBlock | null>(null);
  const [cancelReason, setCancelReason] = useState('Operating emergency / train delay hold');

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setWorkflowStage(6);
  }, [setWorkflowStage]);

  const blocks = activePlan?.blocks || [];

  const handleStartBlock = async (b: GeneratedBlock) => {
    try {
      await updateBlockOperationalStatus(b.id, 'in_progress', 'Controller granted line possession to work gangs');
      setToast(`Possession taken for ${b.section_name}. Status: In Progress`);
      await refreshAll();
      setTimeout(() => setToast(null), 3500);
    } catch (err: any) {
      alert(`Failed taking possession: ${err.message || err}`);
    }
  };

  const handleOpenComplete = (b: GeneratedBlock) => {
    setCompletingBlock(b);
    setCompletionTime(new Date().toISOString().slice(0, 16));
    setCompleteNote('Certified track fit for normal train operations at maximum permissible speed.');
    setCompleteModalOpen(true);
  };

  const handleConfirmComplete = async () => {
    if (!completingBlock) return;
    try {
      await updateBlockOperationalStatus(
        completingBlock.id,
        'completed',
        `${completeNote} [Time: ${completionTime}]`
      );
      setCompleteModalOpen(false);
      setToast(`Possession completed on ${completingBlock.section_name}. Track handed back to traffic.`);
      await refreshAll();
      setTimeout(() => setToast(null), 3500);
    } catch (err: any) {
      alert(`Failed completing block: ${err.message || err}`);
    }
  };

  const handleOpenCancel = (b: GeneratedBlock) => {
    setCancellingBlock(b);
    setCancelReason('Operating emergency / train delay hold');
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingBlock) return;
    try {
      await updateBlockOperationalStatus(cancellingBlock.id, 'cancelled', cancelReason);
      setCancelModalOpen(false);
      setToast(`Possession on ${cancellingBlock.section_name} cancelled.`);
      await refreshAll();
      setTimeout(() => setToast(null), 3500);
    } catch (err: any) {
      alert(`Failed cancelling block: ${err.message || err}`);
    }
  };

  const filtered = blocks.filter((b) => {
    const st = (b as any).execution_status || (b.approval_status === 'approved' ? 'approved' : 'scheduled');
    if (filterStatus !== 'all' && st !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!b.section_name?.toLowerCase().includes(q) && !b.id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F6F8FB] text-[#172033]">
      <TopBar title="Approved Blocks" subtitle="Operational Block Register & Live Possession Execution" />
      <WorkflowBar activeStage={6} />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Page Guide Banner */}
        <PageGuideBanner
          pageTitle="Approved Blocks"
          purpose="Track and execute sanctioned track possessions. Once operating control grants the block, click 'Take Possession' to record active maintenance. Upon track clearance and fitness certification, click 'Complete' to close the possession and restore normal train traffic."
          inputs={['Sanctioned Possession Windows', 'Line Clear Handover Timestamp', 'Track Fitness Safety Certificate']}
          outputs={['Live In-Progress Status', 'Possession Register Log', 'Maintenance Job Completion Closure']}
          nextStep={{ label: 'View Sanction Reports', to: '/reports' }}
        />

        {/* Header & Print Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#D9E1EA] shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-[#172033] flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[#173F7A]" />
              <span>Operational Block Register</span>
            </h1>
            <p className="text-xs text-[#667085] mt-1">
              Active engineering possessions, live track possession tracking, and completion sign-offs.
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-colors border border-[#D9E1EA] cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[#173F7A]" />
            <span>Print Possession Log</span>
          </button>
        </div>

        {toast && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-[#173F7A] font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toast}</span>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#D9E1EA] shadow-xs text-xs">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search section or block ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded pl-8 pr-3 py-1.5 text-xs text-[#172033] focus:outline-none focus:border-[#173F7A]"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#F8FAFC] border border-[#D9E1EA] rounded px-3 py-1.5 text-xs text-[#172033] font-medium focus:outline-none focus:border-[#173F7A]"
            >
              <option value="all">All Operational Statuses</option>
              <option value="scheduled">Scheduled / Approved</option>
              <option value="in_progress">In Progress (Possession Taken)</option>
              <option value="completed">Completed / Handed Over</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="text-xs text-[#667085] font-mono">
            Showing <strong className="text-[#172033] font-bold">{filtered.length}</strong> of {blocks.length} possessions
          </div>
        </div>

        {/* Blocks Table */}
        {blocks.length > 0 ? (
          <div className="bg-white border border-[#D9E1EA] rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#667085] font-mono text-[11px] uppercase tracking-wider border-b border-[#D9E1EA]">
                  <tr>
                    <th className="px-4 py-3">Section / Corridor</th>
                    <th className="px-4 py-3">Scheduled Timing</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Department Work</th>
                    <th className="px-4 py-3">Execution State</th>
                    <th className="px-4 py-3 text-right">Operational Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E1EA]">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[#667085]">
                        No matching blocks for active filter.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((b) => {
                      const isJoint = b.is_joint_block || (b.departments && b.departments.length > 1);
                      const execStatus = (b as any).execution_status || (b.approval_status === 'approved' ? 'scheduled' : 'scheduled');

                      return (
                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-mono font-bold text-xs text-[#173F7A]">
                              {b.section_name}
                            </div>
                            <div className="text-[10px] text-[#667085] font-mono mt-0.5">
                              ID: {b.id.slice(0, 8)}
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono text-[#172033]">
                            <div>
                              {new Date(b.block_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                            <div className="text-[#667085] font-semibold">
                              {new Date(b.block_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                              {new Date(b.block_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono font-bold text-[#173F7A]">
                            {b.duration_min} min
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-700">
                                {b.tasks?.length || 0} tasks
                              </span>
                              {isJoint ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                  Joint ({b.departments?.join(' · ')})
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                  {b.departments?.[0] || 'ENG'}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            {execStatus === 'in_progress' ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full animate-pulse">
                                <Play className="w-3 h-3 fill-amber-600 text-amber-600" />
                                In Progress
                              </span>
                            ) : execStatus === 'completed' ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Completed
                              </span>
                            ) : execStatus === 'cancelled' ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-800 bg-red-100 border border-red-300 px-2.5 py-0.5 rounded-full">
                                <XCircle className="w-3.5 h-3.5 text-red-600" />
                                Cancelled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#173F7A] bg-[#EBF2FA] border border-[#173F7A]/30 px-2.5 py-0.5 rounded-full">
                                <Clock className="w-3.5 h-3.5" />
                                Scheduled / Approved
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {execStatus !== 'completed' && execStatus !== 'cancelled' && (
                                <>
                                  {execStatus !== 'in_progress' && (
                                    <button
                                      onClick={() => handleStartBlock(b)}
                                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                                      title="Marks an approved block as currently in progress. Maintenance has started and control has granted the block."
                                    >
                                      <Play className="w-3 h-3 fill-white" />
                                      <span>Take Possession</span>
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleOpenComplete(b)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                                    title="Closes the block after maintenance and handover are complete."
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Complete</span>
                                  </button>

                                  <button
                                    onClick={() => handleOpenCancel(b)}
                                    className="px-2 py-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded text-xs font-semibold cursor-pointer"
                                    title="Cancel this block possession"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}

                              {execStatus === 'completed' && (
                                <span className="text-[11px] text-[#667085] italic">
                                  Closed & Signed Off
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#D9E1EA] p-10 text-center shadow-xs">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-[#173F7A] flex items-center justify-center mx-auto mb-3">
              <CheckSquare className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#172033]">Operational Block Register is empty</h3>
            <p className="text-xs text-[#667085] max-w-md mx-auto mt-1 leading-relaxed">
              Approved blocks appear here for live track execution. Go to <strong>Proposed Plan</strong> and click <strong>Approve Block</strong> on a recommended possession.
            </p>
          </div>
        )}
      </main>

      {/* ── COMPLETE / SIGN-OFF MODAL ── */}
      {completeModalOpen && completingBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-[#D9E1EA] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#D9E1EA] pb-3">
              <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Sign-off Block Possession
              </h2>
              <button onClick={() => setCompleteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#667085] leading-relaxed">
              Confirming track clearance and handover of engineering possession on <strong className="text-[#172033]">{completingBlock.section_name}</strong> back to operational traffic.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#172033] mb-1">Completion & Handover Time *</label>
                <input
                  type="datetime-local"
                  value={completionTime}
                  onChange={(e) => setCompletionTime(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] font-mono text-xs focus:outline-none focus:border-[#173F7A]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#172033] mb-1">Handover / Track Fitness Note *</label>
                <textarea
                  rows={3}
                  value={completeNote}
                  onChange={(e) => setCompleteNote(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] text-xs resize-none focus:outline-none focus:border-[#173F7A]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D9E1EA]">
              <button
                onClick={() => setCompleteModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmComplete}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs shadow-xs"
              >
                Sign Off & Complete Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CANCEL BLOCK MODAL ── */}
      {cancelModalOpen && cancellingBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-[#D9E1EA] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#D9E1EA] pb-3">
              <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Cancel Possession Authorization
              </h2>
              <button onClick={() => setCancelModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#667085] leading-relaxed">
              Cancelling possession authorization for <strong className="text-[#172033]">{cancellingBlock.section_name}</strong>. The work will be returned to the planning backlog.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">Cancellation Reason *</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] text-xs focus:outline-none focus:border-[#173F7A]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D9E1EA]">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
              >
                Keep Block
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-xs shadow-xs"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
